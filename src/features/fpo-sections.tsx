// Reusable FPO content sections — ported from the web app's
// src/components/fpo-sections.tsx. Each export renders the content for one chip;
// the parent screen shows the chips and renders the chosen section.
import React, { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  AlertTriangle, Banknote, BookOpenCheck, Building2, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, ExternalLink, GraduationCap, Handshake, Inbox, LandPlot,
  Landmark, Mail, MessageCircle, Package, Pencil, Phone, Plus, Send, ShieldCheck, Sparkles,
  Sprout, Star, Target, Trash2, TrendingUp, Truck, UserPlus, Users, Users2, Volume2, XCircle,
} from "lucide-react-native";
import { useApp } from "../lib/app-state";
import { tr } from "../lib/i18n";
import { isSchemeEligible } from "../lib/mockData";
import { explainMatch, matchScore } from "../lib/matching";
import { formatQuantity, parseQuantity } from "../lib/quantity";
import {
  contentRepo, farmerRepo, fpoRepo, marketRepo, membershipRepo, networkRepo, orderRepo,
  readinessRepo, requestRepo, reviewRepo, serviceRepo,
} from "../db";
import type { ServiceRequestRow } from "../db/repositories/serviceRepository";
import type { ReviewRow } from "../db/repositories/reviewRepository";
import type { EngagementRow, MembershipRow } from "../db/repositories/membershipRepository";
import type { FpoMeetingRow } from "../db/repositories/fpoRepository";
import { describeWriteError } from "../db/authz";
import type { RequestRow, ResponseRow } from "../db/repositories/requestRepository";
import { useDbQuery } from "../db/useDbQuery";
import type {
  FPO, FpoCumulative, FpoMeeting, FPOSupply, LedgerEntry, NewLedgerEntry,
  OpportunityDetail, Scheme, Supplier,
} from "../db/types";
import { useSpeech } from "../hooks/useSpeech";
import { colors, radius, spacing } from "../theme";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, ConfirmDialog,
  Dialog, Field, Gauge, Input, Muted, Progress, Select, Table, Text, toast,
} from "../components/ui";
import { CourseCard, EmptyHint, SectionCard, SectionCardRow, Segmented } from "../components/common";
import { BarChart } from "../components/charts";
import { MarketLinkedGrowthPlanning, Kv } from "./market-readiness";
import { ConnectionsPanel } from "./connections";
import { OrdersPanel } from "./orders";

const inr = (n: number) => n.toLocaleString("en-IN");

/** The active FPO, loaded from SQLite. `null` until the first read resolves. */
function useActiveFpo(): { fpoId: string; fpo: FPO | null } {
  const { activeFpoId } = useApp();
  const fpo = useDbQuery<FPO | null>(
    () => fpoRepo.getFpoById(activeFpoId),
    [activeFpoId],
    null,
  );
  return { fpoId: activeFpoId, fpo };
}

/* ========= MANAGE & GROW ========= */

/** Badge showing how many replies a posted request has drawn. */
function ResponseBadge({ total, pending }: { total: number; pending: number }) {
  const { lang } = useApp();
  if (total === 0) return <Muted>No replies yet</Muted>;
  if (pending > 0) {
    return <Badge color={colors.fpoForeground} bg={colors.fpo}>{`${pending} ${tr("awaiting you", lang)}`}</Badge>;
  }
  return <Badge color={colors.mutedForeground} bg={colors.muted}>{`${total} ${tr("replied", lang)}`}</Badge>;
}

export function PostRequestSection() {
  const { session, lang } = useApp();
  const { fpo } = useActiveFpo();
  const supply = useDbQuery<RequestRow[]>(
    () => requestRepo.listMyRequests(session, "commodity_supply"), [session?.partyId], []);
  const needs = useDbQuery<RequestRow[]>(
    () => requestRepo.listMyRequests(session, "input_demand"), [session?.partyId], []);
  const [toDelete, setToDelete] = useState<RequestRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (toDelete == null || deleting) return;
    setDeleting(true);
    try {
      await requestRepo.deleteRequest(session, toDelete.id);
      toast.success("Posting deleted.");
      setToDelete(null);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not delete that posting."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Commodity supply request" />
        </CardHeader>
        <CardContent>
          <Muted style={{ marginBottom: spacing.sm }}>
            What your FPO can supply. Buyers searching for these commodities see these
            postings and can reply to them.
          </Muted>
          <Table
            minWidth={580}
            columns={[
              { key: "commodity", label: "Commodity", flex: 1.3 },
              { key: "grade", label: "Grade" },
              { key: "qty", label: "Qty (MT)", align: "right" },
              { key: "window", label: "Harvest window", flex: 1.4 },
              { key: "replies", label: "Replies", flex: 1.3 },
              { key: "action", label: "", flex: 0.6 },
            ]}
            rows={supply.map((x) => ({
              commodity: x.item,
              grade: x.grade,
              qty: String(x.qty),
              window: x.windowLabel,
              replies: <ResponseBadge total={x.responseCount} pending={x.pendingCount} />,
              action: (
                <Button size="sm" variant="ghost" accent={colors.destructive}
                  icon={<Trash2 size={11} color={colors.destructive} />}
                  onPress={() => setToDelete(x)}>
                  {""}
                </Button>
              ),
            }))}
          />
          <AddCommodityForm onAdd={async (x) => {
            try {
              await requestRepo.createRequest(session, {
                kind: "commodity_supply",
                item: x.commodity,
                grade: x.grade,
                qty: x.qty_mt,
                unit: "MT",
                windowLabel: x.harvest_window,
                district: fpo?.district ?? null,
              });
              toast.success(`${x.commodity} ${tr("posted. Matching buyers can now reply.", lang)}`);
            } catch (e) {
              toast.error(describeWriteError(e, "Could not post that supply request."));
            }
          }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Inputs requirement request" />
        </CardHeader>
        <CardContent>
          <Muted style={{ marginBottom: spacing.sm }}>
            Inputs the FPO needs to procure for its members. Suppliers in these
            categories see these postings and can quote against them.
          </Muted>
          <Table
            minWidth={580}
            columns={[
              { key: "item", label: "Item", flex: 1.6 },
              { key: "category", label: "Category" },
              { key: "qty", label: "Qty" },
              { key: "window", label: "Window" },
              { key: "replies", label: "Quotes", flex: 1.3 },
              { key: "action", label: "", flex: 0.6 },
            ]}
            rows={needs.map((n) => ({
              item: n.item,
              category: n.category,
              qty: formatQuantity(n.qty, n.unit, n.qtyLabel),
              window: n.windowLabel,
              replies: <ResponseBadge total={n.responseCount} pending={n.pendingCount} />,
              action: (
                <Button size="sm" variant="ghost" accent={colors.destructive}
                  icon={<Trash2 size={11} color={colors.destructive} />}
                  onPress={() => setToDelete(n)}>
                  {""}
                </Button>
              ),
            }))}
          />
          <AddNeedForm onAdd={async (n) => {
            try {
              // Input quantities are typed freehand ("120 kg"), so the numeric
              // value for matching is parsed out and the text kept for display.
              const q = parseQuantity(n.qty);
              await requestRepo.createRequest(session, {
                kind: "input_demand",
                item: n.item,
                category: n.category,
                qty: q.qty,
                qtyLabel: q.label,
                unit: q.unit,
                windowLabel: n.window,
                district: fpo?.district ?? null,
              });
              toast.success(`${n.item} ${tr("posted. Suppliers can now quote.", lang)}`);
            } catch (e) {
              toast.error(describeWriteError(e, "Could not post that input request."));
            }
          }} />
        </CardContent>
      </Card>

      <ConfirmDialog
        visible={toDelete != null}
        title="Delete this posting?"
        message={toDelete == null ? "" : `${toDelete.item}${toDelete.responseCount > 0 ? ` and its ${toDelete.responseCount} ${toDelete.responseCount === 1 ? "reply" : "replies"}` : ""} will be removed. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

/* ========= RESPONSES INBOX ========= */

/**
 * Replies other parties have sent to this FPO's postings.
 *
 * This is the receiving half of the loop: a buyer replying to a supply request
 * and a supplier quoting an input request both land here, and accepting or
 * rejecting writes back to a row the other party can see.
 */
export function ResponsesSection() {
  const { session, lang } = useApp();
  const responses = useDbQuery<ResponseRow[]>(
    () => requestRepo.listInboxResponses(session), [session?.partyId], []);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function decide(r: ResponseRow, decision: "accepted" | "rejected") {
    if (busyId != null) return;
    setBusyId(r.id);
    try {
      await requestRepo.decideResponse(session, r.id, decision);
      toast.success(decision === "accepted"
        ? `${tr("Accepted", lang)} ${r.responderName}.`
        : `${tr("Declined", lang)} ${r.responderName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not record that decision."));
    } finally {
      setBusyId(null);
    }
  }

  const pending = responses.filter((r) => r.status === "pending");
  const decided = responses.filter((r) => r.status !== "pending");

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Inbox size={16} color={colors.fpo} />} title="Replies to your postings" />
        </CardHeader>
        <CardContent>
          {pending.length === 0 && (
            <Muted>
              No replies waiting. Post a commodity supply or an input requirement and
              matching buyers and suppliers can respond here.
            </Muted>
          )}
          {pending.map((r) => (
            <View key={r.id} style={s.compactCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700" numberOfLines={1}>{r.responderName}</Text>
                  <Muted numberOfLines={1}>
                    {`${tr(r.responderKind === "buyer" ? "Buyer" : r.responderKind === "supplier" ? "Supplier" : r.responderKind, lang)} · ${r.requestItem} · ${r.requestQtyLabel}`}
                  </Muted>
                </View>
                <Badge color={colors.fpoForeground} bg={colors.fpo}>Pending</Badge>
              </View>

              {(r.offeredQty != null || r.message !== "") && (
                <Muted numberOfLines={1} style={{ marginTop: 4 }}>
                  {r.offeredQty != null
                    ? `Offered: ${r.offeredQty}${r.offeredPrice != null ? ` at ₹${r.offeredPrice}` : ""}${r.message !== "" ? ` · "${r.message}"` : ""}`
                    : `"${r.message}"`}
                </Muted>
              )}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <Button size="sm" accent={colors.fpo} disabled={busyId === r.id}
                  onPress={() => decide(r, "accepted")}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" accent={colors.fpo} disabled={busyId === r.id}
                  onPress={() => decide(r, "rejected")}>
                  Decline
                </Button>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <OrdersPanel accent={colors.fpo} />

      <ConnectionsPanel accent={colors.fpo} />

      {decided.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Already decided</CardTitle></CardHeader>
          <CardContent>
            <Table
              minWidth={480}
              columns={[
                { key: "who", label: "Party", flex: 1.6 },
                { key: "item", label: "Posting", flex: 1.4 },
                { key: "status", label: "Outcome", flex: 1 },
              ]}
              rows={decided.map((r) => ({
                who: r.responderName,
                item: r.requestItem,
                status: r.status === "accepted"
                  ? <Badge color="#ffffff" bg={colors.farmer}>Accepted</Badge>
                  : <Badge color={colors.mutedForeground} bg={colors.muted}>Declined</Badge>,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function MeetingSection() {
  const { session, lang } = useApp();
  const { fpoId } = useActiveFpo();
  const meetings = useDbQuery<FpoMeetingRow[]>(() => fpoRepo.listMeetings(fpoId), [fpoId], []);
  const [toDelete, setToDelete] = useState<FpoMeetingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (toDelete == null || deleting) return;
    setDeleting(true);
    try {
      await fpoRepo.deleteMeeting(session, fpoId, toDelete.id);
      toast.success("Meeting deleted.");
      setToDelete(null);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not delete that meeting."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<CalendarDays size={16} color={colors.fpo} />} title="FPO Meetings" />
      </CardHeader>
      <CardContent>
        {meetings.length === 0 && <Muted>No meetings logged yet.</Muted>}
        {meetings.map((m) => (
          <View key={m.id} style={s.itemCard}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{m.agenda || "Meeting"}</Text>
                <Muted>{`${m.date} · ${m.time}`}</Muted>
              </View>
              <Button size="sm" variant="ghost" accent={colors.destructive}
                icon={<Trash2 size={11} color={colors.destructive} />}
                onPress={() => setToDelete(m)}>
                {""}
              </Button>
            </View>
            <Muted style={{ marginTop: 4 }}>{`Venue: ${m.venue}`}</Muted>
            <View style={{ flexDirection: "row", marginTop: spacing.sm }}>
              {m.invitedCount === 0
                ? <Muted>Not sent</Muted>
                : <Badge color={colors.mutedForeground} bg={colors.muted}>{`${m.invitedCount} ${tr("invited", lang)}`}</Badge>}
            </View>
          </View>
        ))}
        <AddMeetingForm
          onAdd={async (m) => {
            try {
              const meetingId = await fpoRepo.insertMeeting(fpoId, m);
              return meetingId;
            } catch (e) {
              toast.error(describeWriteError(e, "Could not log that meeting."));
              return null;
            }
          }}
          onNotify={async (meetingId) => {
            try {
              const sent = await membershipRepo.inviteMembersToMeeting(session, meetingId);
              toast.success(sent === 0
                ? "Meeting logged. No active members to notify yet."
                : `Meeting logged. ${sent} ${tr("member", lang)} ${sent === 1 ? tr("farmer", lang) : tr("farmers", lang)} ${tr("notified.", lang)}`);
            } catch (e) {
              toast.error(describeWriteError(e, "Meeting logged, but could not send those invitations."));
            }
          }}
        />
      </CardContent>

      <ConfirmDialog
        visible={toDelete != null}
        title="Delete this meeting?"
        message={toDelete == null ? "" : `${toDelete.agenda || "This meeting"} on ${toDelete.date}${toDelete.invitedCount > 0 ? ` and its ${toDelete.invitedCount} invitation${toDelete.invitedCount === 1 ? "" : "s"}` : ""} will be removed. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}

export function BookkeepingSection() {
  const { session } = useApp();
  const { fpoId, fpo } = useActiveFpo();
  const ledger = useDbQuery<LedgerEntry[]>(() => fpoRepo.listLedger(fpoId), [fpoId], []);
  // Parties this FPO has actually dealt with — its members, its accepted
  // connections and anyone it has traded with. A picker over these replaces the
  // free-text "Buyer/Seller ID" field, which is why counterparties used to be a
  // mix of farmer ids, buyer ids and words like FPO-POOL.
  const counterparties = useDbQuery<{ partyId: number; name: string; kind: string }[]>(
    () => orderRepo.listTradedParties(session), [session?.partyId], []);
  const [toDelete, setToDelete] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toEdit, setToEdit] = useState<LedgerEntry | null>(null);

  async function confirmDelete() {
    if (toDelete == null || deleting) return;
    setDeleting(true);
    try {
      await fpoRepo.deleteLedgerEntry(session, fpoId, toDelete.id);
      toast.success("Ledger entry deleted.");
      setToDelete(null);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not delete that entry."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<BookOpenCheck size={16} color={colors.fpo} />} title="Digital bookkeeping" />
        <View style={{ marginTop: spacing.sm }}>
          <Gauge value={fpo?.complianceScore ?? 0} label="Compliance health" />
        </View>
      </CardHeader>
      <CardContent>
        <AddEntry
          onAdd={async (entry) => {
            try {
              const id = await fpoRepo.insertLedgerEntry(fpoId, entry);
              toast.success("Ledger entry added.");
              return id;
            } catch (e) {
              toast.error(describeWriteError(e, "Could not add that entry."));
              return null;
            }
          }}
          running={ledger.length > 0 ? ledger[ledger.length - 1].balance : 0}
          counterparties={counterparties}
        />

        <Muted style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          Entries created by a paid order are posted automatically and carry the
          counterparty and order reference, so they match the other side&apos;s records.
        </Muted>

        {ledger.length === 0 && <Muted>No ledger entries yet.</Muted>}
        {ledger.map((e) => (
          <View key={e.id} style={s.itemCard}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{e.desc || e.type}</Text>
                <Muted>
                  {`${e.date} · ${e.counterpartyName !== "" ? e.counterpartyName : (e.counterpartyLabel ?? "—")}`}
                </Muted>
                {e.refId != null && <Text size="xxs" color={colors.mutedForeground} noTranslate>{`Ref ${e.refId}`}</Text>}
              </View>
              {e.type === "Income"
                ? <Badge color="#ffffff" bg={colors.farmer}>Income</Badge>
                : <Badge color={colors.mutedForeground} bg={colors.muted}>Expense</Badge>}
            </View>
            <View style={[s.rowBetween, { marginTop: spacing.sm }]}>
              <Muted>{`Balance: ₹${inr(e.balance)}`}</Muted>
              <Text size="sm" weight="700" noTranslate>{`₹${inr(e.amount)}`}</Text>
            </View>
            <View style={{ flexDirection: "row", marginTop: spacing.sm }}>
              <Button size="sm" variant="ghost" accent={colors.fpo}
                icon={<Pencil size={11} color={colors.fpo} />}
                onPress={() => setToEdit(e)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" accent={colors.destructive}
                icon={<Trash2 size={11} color={colors.destructive} />}
                onPress={() => setToDelete(e)}>
                Delete
              </Button>
            </View>
          </View>
        ))}
      </CardContent>

      <ConfirmDialog
        visible={toDelete != null}
        title="Delete this entry?"
        message={toDelete == null ? "" : `${toDelete.desc || toDelete.type} · ₹${inr(toDelete.amount)} on ${toDelete.date}. This also removes the matching entry from the farmer's transaction history, if there is one. This cannot be undone.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <EditEntryDialog
        entry={toEdit}
        fpoId={fpoId}
        counterparties={counterparties}
        onClose={() => setToEdit(null)}
      />
    </Card>
  );
}

/**
 * Edits an existing ledger entry's description/type/amount. The counterparty
 * is fixed at creation — changing it would mean deciding whether to move or
 * discard a linked farmer transaction, which the FPO can already do more
 * directly by deleting the entry and adding a new one.
 *
 * When the entry has a linked farmer transaction (an Expense against a member,
 * see AddEntry), its crop and quantity are prefilled and editable here too, so
 * the farmer's transaction history reflects the correction, not just the ledger.
 */
function EditEntryDialog({
  entry, fpoId, counterparties, onClose,
}: {
  entry: LedgerEntry | null;
  fpoId: string;
  counterparties: { partyId: number; name: string; kind: string }[];
  onClose: () => void;
}) {
  const { session } = useApp();
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Income");
  const [crop, setCrop] = useState("");
  const [qty, setQty] = useState("");
  const [hasFarmerTxn, setHasFarmerTxn] = useState(false);
  const [saving, setSaving] = useState(false);

  const cpKind = entry?.counterpartyPartyId != null
    ? counterparties.find((c) => c.partyId === entry.counterpartyPartyId)?.kind
    : undefined;
  const isMemberProcurement = hasFarmerTxn && type === "Expense" && cpKind === "farmer";

  useEffect(() => {
    if (entry == null) return;
    setDesc(entry.desc);
    setAmt(String(entry.amount));
    setType(entry.type);
    let cancelled = false;
    fpoRepo.getFarmerTxnForLedgerEntry(entry.id).then((t) => {
      if (cancelled) return;
      setHasFarmerTxn(t != null);
      setCrop(t?.crop ?? "");
      setQty(t != null ? String(t.qtyQ) : "");
    });
    return () => { cancelled = true; };
  }, [entry]);

  async function save() {
    if (entry == null || saving) return;
    const amount = Number(amt);
    if (!desc || !amount) return;
    setSaving(true);
    try {
      await fpoRepo.updateLedgerEntry(session, fpoId, entry.id, {
        date: entry.date,
        desc,
        type,
        amount,
        counterpartyPartyId: entry.counterpartyPartyId ?? null,
        counterpartyLabel: entry.counterpartyLabel ?? null,
        farmerCrop: isMemberProcurement && crop.trim() !== "" ? crop.trim() : undefined,
        farmerQtyQ: isMemberProcurement && qty.trim() !== "" ? Number(qty) : undefined,
      });
      toast.success("Ledger entry updated.");
      onClose();
    } catch (e) {
      toast.error(describeWriteError(e, "Could not update that entry."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog visible={entry != null} onClose={onClose} title="Edit entry">
      <Field label="Description"><Input value={desc} onChangeText={setDesc} placeholder="Description" /></Field>
      <Field label="Type"><Select value={type} options={["Income", "Expense"] as const} onChange={setType} /></Field>
      <Field label="Amount ₹"><Input value={amt} onChangeText={setAmt} placeholder="Amount ₹" keyboardType="numeric" /></Field>
      {isMemberProcurement && (
        <>
          <Muted style={{ marginBottom: spacing.sm }}>
            This also updates the produce record on the farmer&apos;s own transaction history.
          </Muted>
          <Field label="Crop"><Input value={crop} onChangeText={setCrop} placeholder="e.g. Onion" /></Field>
          <Field label="Quantity (quintals)">
            <Input value={qty} onChangeText={setQty} placeholder="e.g. 12" keyboardType="numeric" />
          </Field>
        </>
      )}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button variant="outline" style={{ flex: 1 }} disabled={saving} onPress={onClose}>Cancel</Button>
        <Button accent={colors.fpo} style={{ flex: 1 }} disabled={saving} onPress={save}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </View>
    </Dialog>
  );
}

export function ExpansionPlannerSection() {
  const [tab, setTab] = useState<"sizing" | "growth">("sizing");
  return (
    <>
      {/* SectionCards rather than a Segmented pill switch: these are the two headline
          tools of this screen and need the visual weight, and it matches the selector
          pattern used on the FPO tab screens themselves. */}
      <SectionCardRow>
        <SectionCard
          title="Opportunity Sizing"
          accent={colors.fpo}
          active={tab === "sizing"}
          onPress={() => setTab("sizing")}
          icon={<Target size={22} color={tab === "sizing" ? "#fff" : colors.fpo} />}
        />
        <SectionCard
          title="Market-Linked Growth Planning"
          accent={colors.fpo}
          active={tab === "growth"}
          onPress={() => setTab("growth")}
          icon={<TrendingUp size={22} color={tab === "growth" ? "#fff" : colors.fpo} />}
          lines={3}
        />
      </SectionCardRow>
      {tab === "sizing" ? <OpportunitySizingPanel /> : <MarketLinkedGrowthPlanning />}
    </>
  );
}

function OpportunitySizingPanel() {
  const { speak } = useSpeech();
  const { session, lang } = useApp();
  const { fpo } = useActiveFpo();
  const tier = fpo?.tier ?? "Tier 3";
  const scores = useDbQuery<Record<string, number>>(
    () => fpoRepo.getTierScores(tier), [tier],
    { financial: 0, operational: 0, infra: 0, governance: 0, market: 0 },
  );
  const opportunities = useDbQuery<OpportunityDetail[]>(
    () => fpoRepo.getTierOpportunities(tier), [tier], [],
  );
  const mentors = useDbQuery(() => contentRepo.listMentors(), [], []);
  const [openOpp, setOpenOpp] = useState<OpportunityDetail | null>(null);
  const [openMentor, setOpenMentor] = useState<string | null>(null);
  const [mentorMsg, setMentorMsg] = useState("");

  const mentor = mentors.find((x) => x.name === openMentor);

  return (
    <Card>
      <CardHeader>
        <View style={s.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <Sparkles size={16} color={colors.fpo} />
            <CardTitle>Business Expansion Planner</CardTitle>
          </View>
          <Badge color={colors.mutedForeground} bg={colors.muted}>AI (simulated)</Badge>
        </View>
      </CardHeader>
      <CardContent>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
          <Badge color={colors.fpoForeground} bg={colors.fpo}>{tier}</Badge>
          <Muted>5 dimensions</Muted>
        </View>

        {Object.entries(scores).map(([k, v]) => (
          <View key={k} style={{ marginBottom: spacing.md }}>
            <View style={s.rowBetween}>
              <Text size="xs" style={{ textTransform: "capitalize" }}>{tr(k, lang)}</Text>
              <Text size="xs" weight="600" noTranslate>{`${v}/100`}</Text>
            </View>
            <View style={{ marginTop: 4 }}><Progress value={v as number} color={colors.fpo} /></View>
          </View>
        ))}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm }}>
          <Target size={16} color={colors.fpo} />
          <Text size="sm" weight="600">Opportunity Sizing</Text>
        </View>

        {opportunities.map((o) => (
          <View key={o.label} style={s.oppCard}>
            <View style={s.rowBetween}>
              <Text size="xxs" weight="700" color={colors.fpo}>{`${tr("Opportunity", lang)} · ${tr(o.label, lang)}`}</Text>
              <Text size="sm" weight="700" noTranslate>{o.amount}</Text>
            </View>
            <Muted style={{ marginTop: 4 }}>{o.action}</Muted>
            <Button variant="ghost" size="sm" accent={colors.fpo} style={{ marginTop: 4, paddingHorizontal: 0 }}
              icon={<ChevronRight size={12} color={colors.fpo} />}
              onPress={() => setOpenOpp(o)}>
              View expansion plan
            </Button>
          </View>
        ))}
      </CardContent>

      <Dialog visible={openOpp != null} onClose={() => setOpenOpp(null)}
        title={openOpp ? `${tr("Opportunity", lang)} · ${tr(openOpp.label, lang)}` : undefined}>
        {openOpp != null && (
          <>
            <View style={{ flexDirection: "row" }}>
              <Badge color={colors.fpoForeground} bg={colors.fpo}>{openOpp.amount}</Badge>
            </View>
            <Text size="sm" weight="500">{openOpp.action}</Text>

            <Text size="xxs" weight="700" color={colors.mutedForeground}>Step-by-step path</Text>
            {openOpp.steps.map((st, i) => (
              <View key={i} style={s.step}>
                <Text size="sm" weight="700" color={colors.fpo} noTranslate>{`${i + 1}.`}</Text>
                <Text size="sm" style={{ flex: 1 }}>{st}</Text>
              </View>
            ))}

            <View style={s.infoBox}>
              <Muted>Investment</Muted>
              <Text size="sm" weight="500">{openOpp.investment}</Text>
            </View>
            <View style={s.infoBox}>
              <Muted>Expected outcome</Muted>
              <Text size="sm" weight="500">{openOpp.outcome}</Text>
            </View>

            <Button variant="outline" accent={colors.fpo}
              icon={<Volume2 size={16} color={colors.fpo} />}
              onPress={() => speak([
                `${openOpp.label} opportunity.`,
                openOpp.action,
                "Step by step path.",
                ...openOpp.steps.map((st, i) => `${i + 1}. ${st}`),
                `Investment: ${openOpp.investment}.`,
                `Expected outcome: ${openOpp.outcome}.`,
              ].join(" "))}>
              Listen
            </Button>

            <Text size="sm" weight="700" style={{ marginTop: spacing.sm }}>Scrutinise with an Expert</Text>
            {mentors.map((m) => (
              <View key={m.name} style={s.mentorCard}>
                <Text size="sm" weight="700">{m.name}</Text>
                <Muted>{m.expertise}</Muted>
                <Muted>{m.org}</Muted>
                <Button full size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                  onPress={() => { setOpenOpp(null); setOpenMentor(m.name); setMentorMsg(`Namaste ${m.name.split(" ")[1]}, can you review our expansion plan?`); }}>
                  Connect
                </Button>
              </View>
            ))}
          </>
        )}
      </Dialog>

      <Dialog visible={openMentor != null} onClose={() => setOpenMentor(null)}
        title={openMentor ? `Connect with ${openMentor}` : undefined}>
        {mentor != null && (
          <>
            <View style={s.contactBox}>
              <View style={s.contactRow}><Phone size={16} color={colors.fpo} /><Text size="sm" noTranslate>{mentor.phone}</Text></View>
              <View style={s.contactRow}><Mail size={16} color={colors.fpo} /><Text size="sm" noTranslate>{mentor.email}</Text></View>
            </View>
            <Input value={mentorMsg} onChangeText={setMentorMsg} multiline numberOfLines={3} />
            <Button accent={colors.fpo} icon={<Send size={16} color="#ffffff" />}
              onPress={async () => {
                try {
                  await contactAdvisor(session, "mentor", mentor.name, mentorMsg);
                  toast.success(`${tr("Message sent to", lang)} ${mentor.name}. ${tr("Replies appear under Replies.", lang)}`);
                  setOpenMentor(null);
                } catch (e) {
                  toast.error(describeWriteError(e, `${tr("Could not reach", lang)} ${mentor.name}.`));
                }
              }}>
              Send message
            </Button>
          </>
        )}
      </Dialog>
    </Card>
  );
}

/**
 * Opens an advisory connection with a service provider and posts the first
 * message into its thread. Mentors and experts both route through here — they are
 * `service_providers` rows with a party, so the message is stored rather than
 * discarded when the dialog closes.
 */
async function contactAdvisor(
  session: Parameters<typeof networkRepo.requestConnection>[0],
  providerType: "mentor" | "expert",
  name: string,
  message: string,
): Promise<void> {
  const id = await networkRepo.providerPartyIdByName(providerType, name);
  if (id == null) throw new Error("provider not reachable");
  await networkRepo.requestConnection(session, {
    otherPartyId: id,
    relationType: "advisory",
    message,
    openThread: true,
  });
}

/* ========= FIND PARTNERS ========= */

/**
 * Open buyer demands this FPO can actually supply, plus the buyer directory.
 *
 * The demands half is new: a buyer's posted requirement was previously invisible
 * to every FPO in the app, so a demand could never be answered. Replying here
 * writes a `request_responses` row that lands in that buyer's inbox.
 */
export function LocateBuyerSection() {
  const { session, lang } = useApp();
  const { fpo } = useActiveFpo();
  const groups = useDbQuery(() => marketRepo.buyersByCategory(), [], {});
  const fpoCommodities = useMemo(() => fpo?.commodities ?? [], [fpo]);

  // One query per commodity the FPO deals in, flattened — a buyer demand only
  // matters to this FPO if it is for something the FPO grows.
  const demands = useDbQuery<RequestRow[]>(
    async () => {
      const lists = await Promise.all(fpoCommodities.map((c) =>
        requestRepo.listOpenRequests({
          kind: "commodity_demand", item: c, excludePartyId: session?.partyId,
        })));
      return lists.flat();
    },
    [fpoCommodities, session?.partyId],
    [],
  );

  const distances = useDbQuery<Map<string, number>>(
    () => readinessRepo.distanceMatrix(), [], new Map());
  const [replyTo, setReplyTo] = useState<RequestRow | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatBusyId, setChatBusyId] = useState<string | null>(null);

  async function chatWithBuyer(b: { id: string; name: string; commodities: string[] }) {
    if (chatBusyId != null) return;
    setChatBusyId(b.id);
    try {
      const partyId = await networkRepo.partyIdFor("buyer", b.id);
      if (partyId == null) {
        toast.error("That buyer is not reachable yet.");
        return;
      }
      await networkRepo.requestConnection(session, {
        otherPartyId: partyId,
        relationType: "trade",
        message: `We deal in ${b.commodities.filter((c) => fpoCommodities.includes(c)).join(", ") || b.commodities[0]}. Would like to connect.`,
        openThread: true,
      });
      toast.success(`${tr("Chat request sent to", lang)} ${b.name}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setChatBusyId(null);
    }
  }

  // The FPO's available quantity for the demanded commodity, used for the score.
  const availableFor = (commodity: string) =>
    (fpo?.supply ?? [])
      .filter((sup) => sup.commodity.toLowerCase() === commodity.toLowerCase())
      .reduce((sum, sup) => sum + sup.qty_mt, 0);

  const bestGradeFor = (commodity: string) =>
    (fpo?.supply ?? []).find((sup) => sup.commodity.toLowerCase() === commodity.toLowerCase())?.grade ?? null;

  async function send() {
    if (replyTo == null || sending) return;
    setSending(true);
    try {
      await requestRepo.respond(session, replyTo.id, {
        message: message.trim() === "" ? null : message.trim(),
        offeredQty: availableFor(replyTo.item),
        offeredUnit: "MT",
      });
      setReplyTo(null);
      setMessage("");
      toast.success("Reply sent. The buyer can now accept or decline it.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that reply."));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<ClipboardList size={16} color={colors.fpo} />} title="Open buyer requirements" />
        </CardHeader>
        <CardContent>
          {demands.length === 0 && (
            <Muted>No buyer has an open requirement for your commodities right now.</Muted>
          )}
          {demands.map((d) => {
            const available = availableFor(d.item);
            const breakdown = matchScore({
              requiredQty: d.qty,
              availableQty: available,
              requiredGrade: d.grade,
              offeredGrade: bestGradeFor(d.item),
              distanceKm: readinessRepo.kmBetween(distances, fpo?.district, d.district),
            });
            return (
              <View key={d.id} style={s.itemCard}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text size="sm" weight="700">{d.authorName}</Text>
                    <Muted>{`Wants ${d.qty} ${d.unit} ${d.item}${d.grade !== "" ? ` · Grade ${d.grade}` : ""}`}</Muted>
                  </View>
                  <Badge color={colors.fpoForeground} bg={colors.fpo}>{`${breakdown.score}${tr("% match", lang)}`}</Badge>
                </View>
                <Muted style={{ marginTop: spacing.sm }}>{explainMatch(breakdown, lang)}</Muted>
                <Muted>{`You have ${available} MT open${d.windowLabel !== "" ? ` · needed by ${d.windowLabel}` : ""}`}</Muted>
                <Button size="sm" accent={colors.fpo} style={{ marginTop: spacing.md }}
                  onPress={() => {
                    setReplyTo(d);
                    setMessage(`We can supply ${Math.min(available, d.qty)} MT of ${d.item}.`);
                  }}>
                  Reply to this requirement
                </Button>
              </View>
            );
          })}
        </CardContent>
      </Card>

      {(["Spot", "Relationship", "Development"] as const).map((cat) => {
        const list = (groups[cat] ?? []).filter((b) => b.commodities.some((c) => fpoCommodities.includes(c)));
        if (list.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Handshake size={16} color={colors.fpo} />
                <Badge color={colors.fpoForeground} bg={colors.fpo}>{cat}</Badge>
                <CardTitle>
                  {cat === "Spot" ? "Spot buyers" : cat === "Relationship" ? "Relationship buyers" : "Development buyers"}
                </CardTitle>
              </View>
            </CardHeader>
            <CardContent>
              {list.map((b) => (
                <View key={b.id} style={s.itemCard}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text size="sm" weight="700">{b.name}</Text>
                      <Muted>{`${tr(b.type, lang)} · ${b.location}`}</Muted>
                    </View>
                  </View>
                  <Muted style={{ marginTop: spacing.sm }}>
                    {"Commodity: "}
                    <Text size="xs">{b.commodities.find((c) => fpoCommodities.includes(c)) ?? b.commodities[0]}</Text>
                    {" · Volume: "}
                    <Text size="xs">{`${b.typicalVolumeMT} MT/yr`}</Text>
                  </Muted>
                  {b.qualitySpecs !== "" && <Muted>{"Wants: "}<Text size="xs">{b.qualitySpecs}</Text></Muted>}
                  {/* No match badge here: this is a directory of who exists, not a
                      ranking. Scores belong on the requirement cards above, where
                      there is a quantity and a grade to score against. */}
                  <Button size="sm" variant="outline" accent={colors.fpo} style={{ marginTop: spacing.md }}
                    disabled={chatBusyId === b.id} onPress={() => chatWithBuyer(b)}>
                    {chatBusyId === b.id ? "Sending…" : "Chat"}
                  </Button>
                </View>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Dialog visible={replyTo != null} onClose={() => setReplyTo(null)}
        title={replyTo ? `Reply to ${replyTo.authorName}` : undefined}>
        {replyTo != null && (
          <>
            <Kv k="Requirement" v={`${replyTo.qty} ${replyTo.unit} ${replyTo.item}`} />
            <Kv k="You can offer" v={`${availableFor(replyTo.item)} MT`} />
            <Input value={message} onChangeText={setMessage} multiline numberOfLines={3} />
            <Button accent={colors.fpo} disabled={sending}
              icon={<Send size={16} color="#ffffff" />} onPress={send}>
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </>
        )}
      </Dialog>
    </>
  );
}

export function LocateSupplierSection() {
  const { session, lang } = useApp();
  const suppliers = useDbQuery<Supplier[]>(() => marketRepo.listSuppliers(), [], []);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function connect(sup: Supplier) {
    if (busyId != null) return;
    setBusyId(sup.id);
    try {
      const partyId = await networkRepo.partyIdFor("supplier", sup.id);
      if (partyId == null) {
        toast.error("That supplier is not reachable yet.");
        return;
      }
      await networkRepo.requestConnection(session, {
        otherPartyId: partyId,
        relationType: "supply",
        message: `We would like a quote for ${sup.categories.join(", ")}.`,
        openThread: true,
      });
      toast.success(`${tr("Quote request sent to", lang)} ${sup.name}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Matched input suppliers" />
      </CardHeader>
      <CardContent>
        {suppliers.map((sup) => (
          <View key={sup.id} style={s.itemCard}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{sup.name}</Text>
                <Muted>{`${sup.brand} · ${sup.location}`}</Muted>
              </View>

            </View>
            <View style={{ marginTop: spacing.sm, gap: 2 }}>
              <Muted>{"Category: "}<Text size="xs">{sup.categories.join(", ")}</Text></Muted>
              <Muted>{"Products: "}<Text size="xs">{sup.products}</Text></Muted>
              <Muted>{"Price: "}<Text size="xs">{sup.priceRange}</Text></Muted>
              <Muted>{"Lead time: "}<Text size="xs">{`${sup.leadTimeDays} days · MOQ ${sup.minOrder}`}</Text></Muted>
            </View>
            <Button size="sm" accent={colors.fpo} style={{ marginTop: spacing.md }}
              disabled={busyId === sup.id} onPress={() => connect(sup)}>
              {busyId === sup.id ? "Sending…" : "Request a quote"}
            </Button>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export function LogisticsSection() {
  const providers = useDbQuery(() => contentRepo.listLogisticsProviders(), [], []);
  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<Truck size={16} color={colors.fpo} />} title="Logistics service providers" />
      </CardHeader>
      <CardContent>
        {providers.map((p) => (
          <View key={p.name} style={s.itemCard}>
            <Text size="sm" weight="700">{p.name}</Text>
            <Muted>{`${p.svc} · ${p.location}`}</Muted>
            <View style={[s.contactRow, { marginTop: spacing.sm }]}>
              <Phone size={12} color={colors.mutedForeground} />
              <Muted noTranslate>{p.phone}</Muted>
            </View>
            <View style={s.contactRow}>
              <Mail size={12} color={colors.mutedForeground} />
              <Muted noTranslate>{p.email}</Muted>
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export function AccessCreditSection() {
  const { session, lang } = useApp();
  const { fpo } = useActiveFpo();
  // Lenders read from `service_providers` now, so each one carries a party and
  // an application has somewhere to land.
  const lenders = useDbQuery(() => serviceRepo.listProviders("lender"), [], []);
  const applications = useDbQuery<ServiceRequestRow[]>(
    () => serviceRepo.listMyRequests(session), [session?.partyId], []);
  const [busy, setBusy] = useState<number | null>(null);

  const statusWith = (partyId: number) =>
    applications.find((a) => a.providerPartyId === partyId && a.serviceType === "credit");

  async function apply(partyId: number, name: string, amount: number | null) {
    if (busy != null) return;
    setBusy(partyId);
    try {
      await serviceRepo.request(session, {
        providerPartyId: partyId,
        serviceType: "credit",
        subject: `Working capital for ${fpo?.name ?? "our FPO"}`,
        details: `Compliance score ${fpo?.complianceScore ?? 0}/100. ${fpo?.members ?? 0} members.`,
        amountRequested: amount,
      });
      toast.success(`${tr("Application sent to", lang)} ${name}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that application."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Banknote size={16} color={colors.fpo} />} title="Credit Facilitation" />
        </CardHeader>
        <CardContent>
          {lenders.map((l) => {
            const application = statusWith(l.partyId);
            return (
              <View key={l.id} style={s.itemCard}>
                <View style={s.rowBetween}>
                  <Text size="sm" weight="700" style={{ flex: 1 }}>{l.name}</Text>
                  {application != null && (
                    <Badge
                      color={application.status === "approved" ? "#ffffff" : colors.mutedForeground}
                      bg={application.status === "approved" ? colors.farmer : colors.muted}>
                      {tr(application.status.replace("_", " "), lang)}
                    </Badge>
                  )}
                </View>
                <Muted>{l.note}</Muted>
                {l.feeNote !== "" && (
                  <View style={{ flexDirection: "row", marginTop: 6 }}>
                    <Badge color={colors.mutedForeground} bg={colors.muted}>{l.feeNote}</Badge>
                  </View>
                )}
                <Button size="sm" variant="outline" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                  disabled={busy === l.partyId}
                  onPress={() => apply(l.partyId, l.name, 4800000)}>
                  {application == null ? "Apply" : "Update application"}
                </Button>
              </View>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

export function GovtSchemesSection() {
  const { fpo } = useActiveFpo();
  const allSchemes = useDbQuery<Scheme[]>(() => contentRepo.listFpoSchemes(), [], []);
  const [body, setBody] = useState<"all" | "Central" | "State (Maharashtra)">("all");
  const schemes = allSchemes.filter((x) => body === "all" || x.body === body);

  return (
    <>
      {/* Filters sit above the card at full width with large touch targets, matching
          the Farmer Government Schemes screen (src/screens/farmer/SchemesScreen.tsx). */}
      <Segmented
        options={["all", "Central", "State (Maharashtra)"] as const}
        value={body}
        onChange={setBody}
        accent={colors.fpo}
        size="lg"
        labelOf={(b) => (b === "all" ? "All" : b === "Central" ? "Central" : "State")}
      />

      <Card>
      <CardHeader>
        <TitleWithIcon icon={<Landmark size={16} color={colors.fpo} />} title="Government Schemes" />
      </CardHeader>
      <CardContent>
        {schemes.map((sch) => {
          // Real business rule preserved from mockData.isSchemeEligible() — pure
          // logic over the row data, so it stays in code rather than moving to SQL.
          const eligible = fpo != null && isSchemeEligible(sch, fpo);
          return (
            <View key={sch.name} style={s.itemCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{sch.name}</Text>
                  <View style={{ flexDirection: "row", marginTop: 4 }}>
                    <Badge
                      color={sch.body === "Central" ? colors.primary : colors.fpo}
                      bg={sch.body === "Central" ? colors.fpoSoft : colors.farmerSoft}
                    >
                      {sch.body}
                    </Badge>
                  </View>
                </View>
                {eligible
                  ? <Badge color="#ffffff" bg={colors.farmer}>Eligible</Badge>
                  : <Badge color={colors.destructive} bg="#FDECEA">Not Eligible</Badge>}
              </View>
              <Text size="sm" style={{ marginTop: spacing.sm }}>{sch.desc}</Text>
              <Muted style={{ marginTop: spacing.sm }}>Eligibility</Muted>
              <Text size="xs">{sch.eligibility}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                {eligible
                  ? <CheckCircle2 size={12} color={colors.farmer} />
                  : <XCircle size={12} color={colors.destructive} />}
                <Muted>{eligible ? "This FPO currently qualifies." : "This FPO does not currently qualify."}</Muted>
              </View>
              <Button size="sm" variant="outline" accent={colors.fpo} style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
                icon={<ExternalLink size={14} color={colors.fpo} />}
                onPress={async () => {
                  if (!sch.url) {
                    toast.error("No portal link available for this scheme.");
                    return;
                  }
                  const ok = await Linking.canOpenURL(sch.url);
                  if (ok) await Linking.openURL(sch.url);
                  else toast.error("Could not open the scheme portal.");
                }}>
                Apply
              </Button>
            </View>
          );
        })}
      </CardContent>
      </Card>
    </>
  );
}

export function ComplianceSection() {
  const { session, lang } = useApp();
  const explainer = useDbQuery(() => contentRepo.listComplianceExplainer(), [], []);
  const partners = useDbQuery(() => serviceRepo.listProviders("compliance"), [], []);
  const requests = useDbQuery<ServiceRequestRow[]>(
    () => serviceRepo.listMyRequests(session), [session?.partyId], []);
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<ShieldCheck size={16} color={colors.fpo} />} title="Compliances required for an FPO" />
        </CardHeader>
        <CardContent>
          {explainer.map((c) => (
            <View key={c.title} style={s.itemCard}>
              <Text size="sm" weight="600">{c.title}</Text>
              <Muted style={{ marginTop: 4 }}>{c.detail}</Muted>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Connect with Professionals</CardTitle></CardHeader>
        <CardContent>
          {partners.map((p) => {
            const existing = requests.find(
              (r) => r.providerPartyId === p.partyId && r.serviceType === "compliance");
            return (
              <View key={p.id} style={s.itemCard}>
                <View style={s.rowBetween}>
                  <Text size="sm" weight="600" style={{ flex: 1 }}>{p.name}</Text>
                  {existing != null && (
                    <Badge color={colors.mutedForeground} bg={colors.muted}>
                      {tr(existing.status.replace("_", " "), lang)}
                    </Badge>
                  )}
                </View>
                <Muted>{p.note}</Muted>
                {p.feeNote !== "" && (
                  <View style={{ flexDirection: "row", marginTop: 6 }}>
                    <Badge color={colors.fpo} bg={colors.fpoSoft}>{p.feeNote}</Badge>
                  </View>
                )}
                <Button full size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                  disabled={busy === p.partyId}
                  onPress={async () => {
                    setBusy(p.partyId);
                    try {
                      await serviceRepo.request(session, {
                        providerPartyId: p.partyId,
                        serviceType: "compliance",
                        subject: p.note === "" ? "Compliance support" : p.note,
                      });
                      toast.success(`${tr("Request sent to", lang)} ${p.name}.`);
                    } catch (e) {
                      toast.error(describeWriteError(e, "Could not send that request."));
                    } finally {
                      setBusy(null);
                    }
                  }}>
                  {existing == null ? "Request service" : "Update request"}
                </Button>
              </View>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

/* ========= LEARN & EXPERT ========= */

export function CapacityBuildingSection() {
  const [tab, setTab] = useState<null | "value" | "mgmt">(null);
  const valueCourses = useDbQuery(() => contentRepo.listCourses("value"), [], []);
  const mgmtCourses = useDbQuery(() => contentRepo.listCourses("mgmt"), [], []);
  return (
    <>
      {/* Cards, not pill capsules — consistent with every other section selector
          in the FPO view (FpoHelpScreen, FpoMyScreen, FpoPartnersScreen). */}
      <SectionCardRow>
        <SectionCard
          title="Value Addition Hub"
          accent={colors.fpo}
          active={tab === "value"}
          onPress={() => setTab(tab === "value" ? null : "value")}
          icon={<Sprout size={22} color={tab === "value" ? "#fff" : colors.fpo} />}
        />
        <SectionCard
          title="Professional Management Courses"
          accent={colors.fpo}
          active={tab === "mgmt"}
          onPress={() => setTab(tab === "mgmt" ? null : "mgmt")}
          icon={<GraduationCap size={22} color={tab === "mgmt" ? "#fff" : colors.fpo} />}
        />
      </SectionCardRow>

      {tab === null && <EmptyHint>Tap an option above.</EmptyHint>}

      {tab === "value" && (
        <Card>
          <CardHeader><CardTitle>Value Addition Hub</CardTitle></CardHeader>
          <CardContent>
            <View style={{ gap: spacing.md }}>
              {valueCourses.map((c) => (
                <CourseCard key={c.name} name={c.name} by={c.by} progress={c.progress} thumb={c.thumb} accent={colors.fpo} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {tab === "mgmt" && (
        <Card>
          <CardHeader><CardTitle>Professional Management Courses</CardTitle></CardHeader>
          <CardContent>
            <View style={{ gap: spacing.md }}>
              {mgmtCourses.map((c) => (
                <CourseCard key={c.name} name={c.name} by={c.by} progress={c.progress} thumb={c.thumb} accent={colors.fpo} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function ExpertNetworkSection() {
  const { session, lang } = useApp();
  const [openExpert, setOpenExpert] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const experts = useDbQuery(() => contentRepo.listExperts(), [], []);
  const expert = experts.find((e) => e.name === openExpert);

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<MessageCircle size={16} color={colors.fpo} />} title="Expert network & testimonials" />
      </CardHeader>
      <CardContent>
        {experts.map((t) => (
          <View key={t.name} style={s.itemCard}>
            <Text size="sm" weight="600">{t.name}</Text>
            <Muted>{t.role}</Muted>
            <Text size="sm" style={{ marginTop: spacing.sm }}>{`"${t.note}"`}</Text>
            <Button full size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
              onPress={() => { setOpenExpert(t.name); setMsg(`${tr("Namaste", lang)} ${t.name.split(" ")[0]}, ${tr("we'd love your guidance on…", lang)}`); }}>
              Connect
            </Button>
          </View>
        ))}
      </CardContent>

      <Dialog visible={openExpert != null} onClose={() => setOpenExpert(null)}
        title={expert ? `${tr("Connect with", lang)} ${expert.name}` : undefined}>
        {expert != null && (
          <>
            <View style={s.contactBox}>
              <Muted>{expert.role}</Muted>
              <View style={s.contactRow}><Phone size={16} color={colors.fpo} /><Text size="sm" noTranslate>{expert.phone}</Text></View>
              <View style={s.contactRow}><Mail size={16} color={colors.fpo} /><Text size="sm" noTranslate>{expert.email}</Text></View>
            </View>
            <Input value={msg} onChangeText={setMsg} multiline numberOfLines={3} />
            <Button accent={colors.fpo} icon={<Send size={16} color="#ffffff" />}
              onPress={async () => {
                try {
                  await contactAdvisor(session, "expert", expert.name, msg);
                  toast.success(`${tr("Message sent to", lang)} ${expert.name}.`);
                  setOpenExpert(null);
                } catch (e) {
                  toast.error(describeWriteError(e, `${tr("Could not reach", lang)} ${expert.name}.`));
                }
              }}>
              Send message
            </Button>
          </>
        )}
      </Dialog>
    </Card>
  );
}

/* ========= KNOW MY FPO ========= */

/**
 * A blank or "None" processing capability means the FPO has none. Anything else
 * is the description of what it has — which is how the single free-text field on
 * screen maps onto the two columns behind it.
 */
function readProcessing(text: string): { has: boolean; type: string | null } {
  const t = text.trim();
  const has = t !== "" && t.toLowerCase() !== "none";
  return { has, type: has ? t : null };
}

export function FpoProfileSection() {
  const { width } = useWindowDimensions();
  const { session } = useApp();
  const { fpoId, fpo } = useActiveFpo();
  const cum = useDbQuery<FpoCumulative>(
    () => fpoRepo.cumulativeFor(fpoId), [fpoId],
    { totalMembers: 0, totalLandAcres: 0, cropwise: [] },
  );
  const chartW = width - spacing.lg * 4;

  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [inc, setInc] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [processing, setProcessing] = useState("");
  const [saving, setSaving] = useState(false);

  // The FPO now arrives asynchronously from SQLite, so the editable fields are
  // populated when it lands rather than in the useState initialisers.
  useEffect(() => {
    if (fpo == null) return;
    setName(fpo.name);
    setRegNo(fpo.regNo);
    setDistrict(fpo.district);
    setBlock(fpo.block);
    setInc(fpo.incorporated);
    setWarehouse(String(fpo.warehouseMT));
    setProcessing(fpo.processing.has ? fpo.processing.type ?? "None" : "None");
  }, [fpo]);

  async function save() {
    if (saving) return;
    if (name.trim() === "") {
      toast.error("Name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const proc = readProcessing(processing);
      await fpoRepo.updateFpoProfile(session, {
        name: name.trim(),
        regNo: regNo.trim(),
        district: district.trim(),
        block: block.trim(),
        incorporated: inc.trim(),
        warehouseMT: Number(warehouse) || 0,
        processingHas: proc.has,
        processingType: proc.type,
      });
      toast.success("FPO details saved.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not save FPO details."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Building2 size={16} color={colors.fpo} />} title="FPO Details" />
        </CardHeader>
        <CardContent>
          <Field label="Name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Registration No."><Input value={regNo} onChangeText={setRegNo} /></Field>
          {/* Two fields, not one "District / Block": the combined value read well
              but could not be split back into two columns once edited. */}
          <Field label="District"><Input value={district} onChangeText={setDistrict} /></Field>
          <Field label="Block"><Input value={block} onChangeText={setBlock} /></Field>
          <Field label="Incorporated"><Input value={inc} onChangeText={setInc} /></Field>
          <Field label="Warehouse capacity (MT)"><Input value={warehouse} onChangeText={setWarehouse} keyboardType="numeric" /></Field>
          <Field label="Processing capability"><Input value={processing} onChangeText={setProcessing} placeholder="None" /></Field>
          <Button accent={colors.fpo} style={{ alignSelf: "flex-end" }}
            disabled={saving} onPress={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.rowBetween}>
            <CardTitle>Cumulative FPO profile</CardTitle>
            <Badge color={colors.fpo} bg={colors.fpoSoft}>Aggregated stats</Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View style={s.cumBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Users2 size={16} color={colors.fpo} />
              <Text size="xxs" weight="700" color={colors.fpo}>Total member farmers</Text>
            </View>
            <Text size="xxxl" weight="700">{inr(cum.totalMembers)}</Text>
          </View>
          <View style={s.cumBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LandPlot size={16} color={colors.fpo} />
              <Text size="xxs" weight="700" color={colors.fpo}>Total landholding</Text>
            </View>
            <Text size="xxxl" weight="700">
              {inr(cum.totalLandAcres)}
              <Text size="base" weight="500" color={colors.mutedForeground}>{" acres"}</Text>
            </Text>
          </View>

          <Text size="sm" weight="700" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
            Total landholding crop-wise
          </Text>
          <Table
            columns={[{ key: "crop", label: "Crop" }, { key: "acres", label: "Acres", align: "right" }]}
            rows={cum.cropwise.map((c) => ({ crop: c.crop, acres: inr(c.acres) }))}
          />
          <View style={{ marginTop: spacing.md }}>
            <BarChart
              width={chartW}
              labels={cum.cropwise.map((c) => c.crop)}
              values={cum.cropwise.map((c) => c.acres)}
              color={colors.fpo}
            />
          </View>
        </CardContent>
      </Card>
    </>
  );
}

type Status = "Active" | "At-risk" | "Dormant";

export function RelationshipsSection() {
  const { session, lang } = useApp();
  const { fpoId } = useActiveFpo();
  // Engagement is derived from real transactions and trainings now — see the
  // v_member_engagement view — instead of read from a frozen roster whose rows
  // were matched to farmers by name.
  const members = useDbQuery<EngagementRow[]>(
    () => membershipRepo.listEngagement(fpoId), [fpoId], []);
  const applicants = useDbQuery<MembershipRow[]>(
    () => membershipRepo.listApplicants(session), [session?.partyId], []);
  // The reviews buyers actually wrote, not the separate seller_feedback table
  // that was keyed by the buyer's name in a text column.
  const myPartyId = session?.partyId ?? 0;
  const feedback = useDbQuery<ReviewRow[]>(
    () => (myPartyId === 0 ? Promise.resolve([]) : reviewRepo.listReviewsAbout(myPartyId)),
    [myPartyId], []);
  const reputation = useDbQuery(
    () => (myPartyId === 0 ? Promise.resolve({ rating: 0, reviewCount: 0 }) : reviewRepo.getReputation(myPartyId)),
    [myPartyId], { rating: 0, reviewCount: 0 });
  // Business logic preserved verbatim from the web app.
  const procurable = members.filter((m) => m.status === "Active").reduce((a, m) => a + m.soldThroughFPO * 1.6, 0);
  const [filters, setFilters] = useState<Record<Status, boolean>>({ "Active": true, "At-risk": true, "Dormant": true });
  const filtered = useMemo(() => members.filter((m) => filters[m.status]), [members, filters]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EngagementRow | null>(null);
  const [toRemove, setToRemove] = useState<EngagementRow | null>(null);

  async function decide(m: MembershipRow, decision: "active" | "rejected") {
    if (busyId != null) return;
    setBusyId(m.id);
    try {
      await membershipRepo.decide(session, m.id, decision);
      toast.success(decision === "active"
        ? `${m.farmerName} ${tr("is now a member.", lang)}`
        : `${m.farmerName}${tr("'s application was declined.", lang)}`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not record that decision."));
    } finally {
      setBusyId(null);
    }
  }

  async function intervene(m: EngagementRow) {
    try {
      await membershipRepo.openMemberThread(session, m.membershipId,
        `${tr("Namaste", lang)} ${m.name.split(" ")[0]}, ${tr("we noticed you have not sold through the FPO recently. Can we help?", lang)}`);
      toast.success(`${tr("Message sent to", lang)} ${m.name}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not reach that member."));
    }
  }

  async function removeMember() {
    const m = toRemove;
    if (m == null || removingId != null) return;
    setRemovingId(m.membershipId);
    try {
      await membershipRepo.removeMember(session, m.membershipId);
      toast.success(`${m.name} ${tr("has been removed from your FPO.", lang)}`);
      setToRemove(null);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not remove that member."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<UserPlus size={16} color={colors.fpo} />}
            title={`${tr("Membership applications", lang)} (${applicants.length})`} />
        </CardHeader>
        <CardContent>
          {applicants.length === 0 && (
            <Muted>No applications waiting. Farmers who apply from their My FPO screen appear here.</Muted>
          )}
          {applicants.map((m) => (
            <View key={m.id} style={s.itemCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{m.farmerName}</Text>
                  <Muted>{`${m.village}, ${m.district} · ${m.landAcres} ${tr("acres", lang)}`}</Muted>
                </View>
                <Badge color={colors.fpoForeground} bg={colors.fpo}>Pending</Badge>
              </View>
              {m.crops.length > 0 && <Muted style={{ marginTop: 4 }}>{`Crops: ${m.crops.join(", ")}`}</Muted>}
              {m.contactPhone !== "" && <Muted noTranslate>{m.contactPhone}</Muted>}
              {m.applicationNote !== "" && (
                <Text size="sm" style={{ marginTop: spacing.sm }}>{`"${m.applicationNote}"`}</Text>
              )}
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button size="sm" accent={colors.fpo} disabled={busyId === m.id}
                  onPress={() => decide(m, "active")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" accent={colors.fpo} disabled={busyId === m.id}
                  onPress={() => decide(m, "rejected")}>
                  Decline
                </Button>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Star size={16} color={colors.fpo} />} title="Seller feedback (from buyers)" />
        </CardHeader>
        <CardContent>
          {feedback.length === 0 && (
            <Muted>No reviews yet. A counterparty can review you once an order is delivered.</Muted>
          )}
          {feedback.length > 0 && (
            <>
              <View style={{ flexDirection: "row", marginBottom: spacing.sm }}>
                <Badge color={colors.fpoForeground} bg={colors.fpo}>
                  {`${reputation.rating}★ ${tr("from", lang)} ${reputation.reviewCount} ${reputation.reviewCount === 1 ? tr("review", lang) : tr("reviews", lang)}`}
                </Badge>
              </View>
              <Table
                minWidth={560}
                columns={[
                  { key: "buyer", label: "From", flex: 1.6 },
                  { key: "commodity", label: "Order", flex: 1.4 },
                  { key: "rating", label: "Rating" },
                  { key: "note", label: "Note", flex: 1.8 },
                ]}
                rows={feedback.map((f) => {
                  const stars = Math.round((f.quality + f.delivery + f.communication) / 3);
                  return {
                    buyer: f.authorName,
                    commodity: f.commodity !== "" ? `${f.qty} ${f.unit} ${f.commodity}` : "—",
                    rating: <Text size="xs" noTranslate>{"★".repeat(stars) + "☆".repeat(5 - stars)}</Text>,
                    note: <Muted>{f.note}</Muted>,
                  };
                })}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Users size={16} color={colors.fpo} />
              <CardTitle>Farmer engagement</CardTitle>
            </View>
            <Badge color={colors.fpo} bg={colors.fpoSoft}>{`${members.length} ${tr("on roll", lang)}`}</Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View style={s.noteBox}>
            <Text size="sm">
              <Text size="sm" weight="700">
                {`${tr("Procurable estimate this season from active members:", lang)} ~${Math.round(procurable)} MT.`}
              </Text>
              {" Engage at-risk members early to protect 18–25% of expected supply."}
            </Text>
          </View>

          <View style={s.filterBox}>
            <Text size="xxs" weight="700" color={colors.mutedForeground}>Filter by status</Text>
            {(["Active", "At-risk", "Dormant"] as Status[]).map((st) => (
              <Checkbox key={st} checked={filters[st]} accent={colors.fpo} label={st}
                onChange={(v) => setFilters((f) => ({ ...f, [st]: v }))} />
            ))}
            <Muted>{`${filtered.length} ${tr("shown", lang)}`}</Muted>
          </View>

          <Table
            minWidth={620}
            columns={[
              { key: "name", label: "Member", flex: 1.4 },
              { key: "village", label: "Village" },
              { key: "status", label: "Status", flex: 1.1 },
              { key: "sold", label: "Sold (q)", align: "right" },
              { key: "trainings", label: "Trainings", align: "right" },
              { key: "last", label: "Last txn", flex: 1.2 },
              { key: "action", label: "", flex: 1.6 },
            ]}
            rows={filtered.map((m) => ({
              name: m.name,
              village: m.village,
              status: <StatusChip s={m.status} />,
              sold: String(m.soldThroughFPO),
              trainings: String(m.trainings),
              last: m.lastTxn,
              action: (
                <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                  {m.status !== "Active" && (
                    <Button size="sm" variant="outline" accent={colors.fpo}
                      icon={<AlertTriangle size={11} color={colors.fpo} />}
                      onPress={() => intervene(m)}>
                      Intervene
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" accent={colors.fpo}
                    icon={<Pencil size={11} color={colors.fpo} />}
                    onPress={() => setEditing(m)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" accent={colors.destructive}
                    disabled={removingId === m.membershipId}
                    icon={<Trash2 size={11} color={colors.destructive} />}
                    onPress={() => setToRemove(m)}>
                    Remove
                  </Button>
                </View>
              ),
            }))}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        visible={toRemove != null}
        title="Remove this member?"
        message={toRemove == null ? "" : `${toRemove.name} will lose active membership of your FPO. Their transaction history is kept. This cannot be undone from here.`}
        confirmLabel="Remove"
        busy={removingId === toRemove?.membershipId}
        onConfirm={removeMember}
        onCancel={() => setToRemove(null)}
      />

      <Dialog visible={editing != null} onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : undefined}>
        {editing != null && (
          <EditMemberForm
            farmerId={editing.farmerId}
            village={editing.village}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}

function EditMemberForm({
  farmerId, village: initialVillage, onDone,
}: { farmerId: string; village: string; onDone: () => void }) {
  const { session, lang } = useApp();
  const [village, setVillage] = useState(initialVillage);
  const [landAcres, setLandAcres] = useState("");
  const [crops, setCrops] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      <Field label="Village"><Input value={village} onChangeText={setVillage} placeholder="Village" /></Field>
      <Field label="Landholding (acres)">
        <Input value={landAcres} onChangeText={setLandAcres} placeholder="e.g. 4.5" keyboardType="numeric" />
      </Field>
      <Field label="Crops (comma separated)">
        <Input value={crops} onChangeText={setCrops} placeholder="e.g. Onion, Soybean" />
      </Field>
      <Button full accent={colors.fpo} disabled={saving}
        onPress={async () => {
          setSaving(true);
          try {
            await farmerRepo.updateMemberProfile(session, farmerId, {
              village: village.trim() === "" ? null : village.trim(),
              landAcres: landAcres.trim() === "" ? null : parseFloat(landAcres),
              crops: crops.trim() === "" ? null : crops.split(",").map((c) => c.trim()).filter((c) => c !== ""),
            });
            toast.success(`${tr("Member details updated.", lang)}`);
            onDone();
          } catch (e) {
            toast.error(describeWriteError(e, "Could not update that member."));
          } finally {
            setSaving(false);
          }
        }}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </View>
  );
}

function StatusChip({ s: st }: { s: Status }) {
  const map: Record<Status, { fg: string; bg: string }> = {
    "Active": { fg: colors.farmer, bg: colors.farmerSoft },
    "At-risk": { fg: colors.accent, bg: "#FDF0E6" },
    "Dormant": { fg: colors.mutedForeground, bg: colors.muted },
  };
  return <Badge color={map[st].fg} bg={map[st].bg}>{st}</Badge>;
}

/* ========= shared bits ========= */

function TitleWithIcon({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <CardTitle>{title}</CardTitle>
    </View>
  );
}

function AddCommodityForm({ onAdd }: { onAdd: (s: FPOSupply) => void }) {
  const [c, setC] = useState(""); const [g, setG] = useState("A");
  const [q, setQ] = useState(""); const [h, setH] = useState("");
  return (
    <View style={s.form}>
      <Field label="Commodity"><Input value={c} onChangeText={setC} placeholder="Commodity" /></Field>
      <Field label="Grade"><Input value={g} onChangeText={setG} placeholder="Grade" /></Field>
      <Field label="Qty MT"><Input value={q} onChangeText={setQ} placeholder="Qty MT" keyboardType="numeric" /></Field>
      <Field label="Harvest window"><Input value={h} onChangeText={setH} placeholder="Harvest window" /></Field>
      <Button full accent={colors.fpo} icon={<Plus size={16} color="#ffffff" />}
        onPress={() => {
          if (!c || !q) return;   // same manual validation as the web app
          onAdd({ commodity: c, grade: g, qty_mt: Number(q), harvest_window: h || "—" });
          setC(""); setQ(""); setH("");
        }}>
        Add
      </Button>
    </View>
  );
}

/**
 * What the input form collects, before it becomes an `input_demand` request.
 * A form draft rather than a domain row — `qty` here is still the free text the
 * user typed ("120 kg"), which the caller parses.
 */
interface InputNeedDraft { item: string; category: string; qty: string; window: string }

function AddNeedForm({ onAdd }: { onAdd: (n: InputNeedDraft) => void }) {
  const [item, setItem] = useState(""); const [cat, setCat] = useState("Seeds");
  const [qty, setQty] = useState(""); const [win, setWin] = useState("");
  return (
    <View style={s.form}>
      <Field label="Item"><Input value={item} onChangeText={setItem} placeholder="Item" /></Field>
      <Field label="Category">
        <Select value={cat} options={["Seeds", "Fertilizer", "Pesticide", "Bio-input", "Equipment rental"]} onChange={setCat} />
      </Field>
      <Field label="Qty"><Input value={qty} onChangeText={setQty} placeholder="Qty" /></Field>
      <Field label="Window"><Input value={win} onChangeText={setWin} placeholder="Window" /></Field>
      <Button full accent={colors.fpo} icon={<Plus size={16} color="#ffffff" />}
        onPress={() => {
          if (!item || !qty) return;
          onAdd({ item, category: cat, qty, window: win || "—" });
          setItem(""); setQty(""); setWin("");
        }}>
        Add more
      </Button>
    </View>
  );
}

function AddMeetingForm({
  onAdd, onNotify,
}: {
  onAdd: (m: FpoMeeting) => Promise<number | null>;
  onNotify: (meetingId: number) => Promise<void>;
}) {
  const [date, setDate] = useState(""); const [time, setTime] = useState("");
  const [agenda, setAgenda] = useState(""); const [venue, setVenue] = useState("");
  return (
    <View style={s.form}>
      <Field label="Date"><Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></Field>
      <Field label="Time"><Input value={time} onChangeText={setTime} placeholder="10:00" /></Field>
      <Field label="Agenda"><Input value={agenda} onChangeText={setAgenda} placeholder="Agenda" /></Field>
      <Field label="Venue"><Input value={venue} onChangeText={setVenue} placeholder="Venue" /></Field>
      {/* Logging a meeting immediately invites every active member — one
          invitation row and one notification per member, so the count in the
          toast is the number actually written, not a figure read off a column. */}
      <Button full accent={colors.fpo} icon={<Plus size={16} color="#ffffff" />}
        onPress={async () => {
          if (!date || !agenda) return;
          const id = await onAdd({ date, time: time || "10:00", agenda, venue: venue || "FPO office" });
          if (id == null) return;
          setDate(""); setTime(""); setAgenda(""); setVenue("");
          await onNotify(id);
        }}>
        Log meeting and notify members
      </Button>
    </View>
  );
}

/** Sentinel for "the counterparty is not a party in this app". */
const OTHER = "__other";

function AddEntry({
  onAdd, running, counterparties,
}: {
  /** Returns the new ledger entry's id, or null if the write failed. */
  onAdd: (e: NewLedgerEntry) => Promise<number | null>;
  running: number;
  counterparties: { partyId: number; name: string; kind: string }[];
}) {
  const { fpoId } = useActiveFpo();
  const [desc, setDesc] = useState(""); const [amt, setAmt] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Income");
  const [cp, setCp] = useState<string>(OTHER);
  const [label, setLabel] = useState("");
  const [crop, setCrop] = useState(""); const [qty, setQty] = useState("");

  const options = [OTHER, ...counterparties.map((c) => String(c.partyId))];
  const labelOf = (v: string) => {
    if (v === OTHER) return "Someone else (type a name)";
    const c = counterparties.find((x) => String(x.partyId) === v);
    return c == null ? v : `${c.name} (${c.kind})`;
  };

  // An Expense against a farmer-member is a produce purchase: it should show
  // up on that farmer's own "My FPO" transaction history too, not just this
  // ledger — see farmerRepository.recordFarmerTransaction.
  const cpKind = counterparties.find((c) => String(c.partyId) === cp)?.kind;
  const isMemberProcurement = type === "Expense" && cpKind === "farmer";

  return (
    <View style={s.form}>
      <Field label="Description"><Input value={desc} onChangeText={setDesc} placeholder="Description" /></Field>
      <Field label="Type"><Select value={type} options={["Income", "Expense"] as const} onChange={setType} /></Field>
      {/* A picker of real parties, with a free-text fallback for the entries that
          genuinely name no party — a pooled procurement, a payout to all members. */}
      <Field label="Counterparty">
        <Select value={cp} options={options} onChange={setCp} labelOf={labelOf} />
      </Field>
      {cp === OTHER && (
        <Field label="Counterparty name">
          <Input value={label} onChangeText={setLabel} placeholder="e.g. Pooled procurement" />
        </Field>
      )}
      <Field label="Amount ₹"><Input value={amt} onChangeText={setAmt} placeholder="Amount ₹" keyboardType="numeric" /></Field>
      {isMemberProcurement && (
        <>
          <Muted style={{ marginBottom: spacing.sm }}>
            Expense against a member farmer — record the produce so it appears on their transaction history too.
          </Muted>
          <Field label="Crop"><Input value={crop} onChangeText={setCrop} placeholder="e.g. Onion" /></Field>
          <Field label="Quantity (quintals)">
            <Input value={qty} onChangeText={setQty} placeholder="e.g. 12" keyboardType="numeric" />
          </Field>
        </>
      )}
      <Button full accent={colors.fpo}
        onPress={async () => {
          const amount = Number(amt);
          if (!desc || !amount) return;
          // Running-balance computation preserved from the web app.
          const newBal = type === "Income" ? running + amount : running - amount;
          const entryId = await onAdd({
            date: new Date().toISOString().slice(0, 10), desc, type, amount, balance: newBal,
            counterpartyPartyId: cp === OTHER ? null : Number(cp),
            counterpartyLabel: cp === OTHER ? (label || null) : null,
          });
          // Skip the farmer-transaction insert entirely if the ledger write
          // itself failed — otherwise a farmer could end up with a produce
          // transaction that has no bookkeeping entry behind it.
          if (entryId != null && isMemberProcurement && crop.trim() !== "") {
            const farmerId = await farmerRepo.getFarmerIdForParty(Number(cp));
            if (farmerId != null) {
              try {
                await farmerRepo.recordFarmerTransaction(farmerId, fpoId, {
                  date: new Date().toISOString().slice(0, 10),
                  crop: crop.trim(),
                  qtyQ: Number(qty) || 0,
                  price: Number(qty) > 0 ? Math.round(amount / Number(qty)) : 0,
                  amount,
                  ledgerEntryId: entryId,
                });
              } catch (e) {
                toast.error(describeWriteError(e, "Ledger entry saved, but could not record the farmer transaction."));
              }
            }
          }
          setDesc(""); setAmt(""); setLabel(""); setCrop(""); setQty("");
        }}>
        Add entry
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  itemCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  // Compact variant for dense, scrollable lists (the Inbox reply list) — same
  // border/radius language, tighter padding and single-line text so many rows
  // fit on screen instead of one tall block per reply.
  compactCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.card, padding: spacing.sm, marginBottom: 6,
  },
  oppCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.fpoSoft, padding: spacing.md, marginBottom: spacing.sm,
  },
  form: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.md,
  },
  step: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  infoBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.mutedBg, padding: spacing.sm,
  },
  mentorCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md,
  },
  contactBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, gap: 4,
  },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cumBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.fpoSoft, padding: spacing.lg, marginBottom: spacing.sm, gap: 4,
  },
  noteBox: { backgroundColor: colors.fpoSoft, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  filterBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginBottom: spacing.md, gap: 2,
  },
});
