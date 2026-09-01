import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { ClipboardList, Database, Package, Plus, Trash2 } from "lucide-react-native";
import { marketRepo, readinessRepo, requestRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { RequestRow, ResponseRow } from "../../db/repositories/requestRepository";
import { formatQuantity, parseQuantity } from "../../lib/quantity";
import { useDbQuery } from "../../db/useDbQuery";
import type { Buyer, Supplier } from "../../db/types";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog,
  Field, Input, Muted, Select, Text, toast,
} from "../../components/ui";
import { BuyerReadinessForm } from "../../features/buyer-requirements-form";
import { ModeToggle, useBuyerMode } from "../../features/buyer-shared";
import type { BuyerTabParamList } from "../../navigation/types";

/**
 * Turns a comma-separated input back into the rows of a child table.
 * Blank entries are dropped so a trailing comma doesn't store an empty commodity.
 */
function splitList(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Ported from the web app's src/routes/buyer.index.tsx */
export function BuyerHomeScreen() {
  const { mode } = useBuyerMode();
  return (
    <RoleShell accent="buyer" screenName="Profile & Order">
      <ModeToggle />
      {mode === "buyer" ? <BuyerView /> : <SupplierView />}
    </RoleShell>
  );
}

function BuyerView() {
  // The buyer record linked to the signed-in account, not simply the first row —
  // a different buyer login (or an admin in the buyer view) loads its own profile.
  const { profileId, session, lang } = useApp();
  const buyer = useDbQuery<Buyer | null>(
    () => (profileId == null ? Promise.resolve(null) : marketRepo.getBuyerById(profileId)),
    [profileId], null);
  const nav = useNavigation<BottomTabNavigationProp<BuyerTabParamList>>();
  const demands = useDbQuery<RequestRow[]>(
    () => requestRepo.listMyRequests(session, "commodity_demand"), [session?.partyId], []);
  const [showProfile, setShowProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [commodities, setCommodities] = useState("");
  const [volume, setVolume] = useState("");
  const [location, setLocation] = useState("");
  const [specs, setSpecs] = useState("");
  const [window, setWindow] = useState("");

  // The buyer profile now loads from SQLite, so the editable fields are populated
  // when it arrives rather than in the useState initialisers.
  useEffect(() => {
    if (buyer == null) return;
    setName(buyer.name);
    setType(buyer.type as string);
    setCommodities(buyer.commodities.join(", "));
    setVolume(String(buyer.typicalVolumeMT));
    setLocation(buyer.location);
    setSpecs(buyer.qualitySpecs);
    setWindow(buyer.procurementWindow);
  }, [buyer]);

  async function save() {
    if (saving) return;
    if (name.trim() === "") {
      toast.error("Company name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await marketRepo.updateBuyerProfile(session, {
        name: name.trim(),
        type: type.trim(),
        commodities: splitList(commodities),
        typicalVolumeMT: Number(volume) || 0,
        location: location.trim(),
        qualitySpecs: specs.trim(),
        procurementWindow: window.trim(),
      });
      toast.success("Buyer profile saved.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Database size={16} color={colors.buyer} />
            <CardTitle>Data collected from Buyer</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Field label="Company name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Type"><Input value={type} onChangeText={setType} /></Field>
          <Field label="Commodity interests"><Input value={commodities} onChangeText={setCommodities} /></Field>
          <Field label="Typical volume (MT/yr)"><Input value={volume} onChangeText={setVolume} keyboardType="numeric" /></Field>
          <Field label="Location"><Input value={location} onChangeText={setLocation} /></Field>
          <Field label="Quality specs"><Input value={specs} onChangeText={setSpecs} /></Field>
          <Field label="Usual seasonal procurement window"><Input value={window} onChangeText={setWindow} /></Field>
          <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }}
            disabled={saving} onPress={save}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      {!showProfile && (
        <Card style={{ borderColor: colors.buyer + "4D", backgroundColor: colors.buyerSoft }}>
          <CardContent style={{ paddingTop: spacing.lg }}>
            <Text size="sm" weight="700">Tell us what you need</Text>
            <Muted style={{ marginTop: 2 }}>
              The more you share, the better we can match you with the right FPO. All fields are optional.
            </Muted>
            <Button accent={colors.buyer} style={{ marginTop: spacing.md }} onPress={() => setShowProfile(true)}>
              Complete Profile
            </Button>
          </CardContent>
        </Card>
      )}
      {showProfile && profileId != null && (
        <BuyerReadinessForm buyerId={profileId}
          onSave={(input) => readinessRepo.saveBuyerRequirements(session, input)}
          onSaved={() => nav.navigate("BuyerMatching")}
          saveLabel="Save & Find Matching FPOs"
          successMessage="Requirements saved. Showing matching FPOs…" />
      )}

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <ClipboardList size={16} color={colors.buyer} />
            <CardTitle>Post a demand requirement</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <DemandForm onPost={async (d) => {
            try {
              await requestRepo.createRequest(session, {
                kind: "commodity_demand",
                item: d.commodity,
                grade: d.grade,
                qty: d.qty_mt,
                unit: "MT",
                windowLabel: d.delivery,
                district: d.location,
              });
              toast.success(`${tr("Demand for", lang)} ${d.qty_mt} MT ${tr(d.commodity, lang)} ${tr("posted. Matching FPOs…", lang)}`);
              nav.navigate("BuyerMatching");
            } catch (e) {
              toast.error(describeWriteError(e, "Could not post that demand."));
            }
          }} />
        </CardContent>
      </Card>

      {demands.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your open requirements</CardTitle></CardHeader>
          <CardContent>
            {demands.map((d) => (
              <RequirementCard key={d.id} demand={d} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * One posted demand, with the replies it has drawn.
 *
 * The badge used to read "Matching…" forever. It now reflects real rows: how many
 * FPOs replied, and whether any are waiting on this buyer to decide.
 */
function RequirementCard({ demand }: { demand: RequestRow }) {
  const { session, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const responses = useDbQuery<ResponseRow[]>(
    () => (open ? requestRepo.listResponsesFor(session, demand.id) : Promise.resolve([])),
    [open, demand.id, session?.partyId],
    [],
  );

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

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    try {
      await requestRepo.deleteRequest(session, demand.id);
      toast.success("Requirement deleted.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not delete that requirement."));
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <View style={s.requirementCard}>
      <View style={s.requirementHead}>
        <View style={{ flex: 1 }}>
          <Text size="sm" weight="600">
            {`${demand.qty} ${demand.unit} · ${tr(demand.item, lang)}${demand.grade !== "" ? ` · ${tr("Grade", lang)} ${demand.grade}` : ""}`}
          </Text>
          <Muted>
            {`${tr("Deliver to", lang)} ${demand.district}${demand.windowLabel !== "" ? ` ${tr("by", lang)} ${demand.windowLabel}` : ""}`}
          </Muted>
        </View>
        {demand.pendingCount > 0 ? (
          <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${demand.pendingCount} ${tr("to review", lang)}`}</Badge>
        ) : demand.responseCount > 0 ? (
          <Badge color={colors.mutedForeground} bg={colors.muted}>{`${demand.responseCount} ${tr("replied", lang)}`}</Badge>
        ) : (
          <Badge color={colors.mutedForeground} bg={colors.muted}>No replies yet</Badge>
        )}
        <Button size="sm" variant="ghost" accent={colors.destructive}
          icon={<Trash2 size={11} color={colors.destructive} />}
          onPress={() => setConfirmingDelete(true)}>
          {""}
        </Button>
      </View>

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete this requirement?"
        message={`${demand.item}${demand.responseCount > 0 ? ` and its ${demand.responseCount} ${demand.responseCount === 1 ? "reply" : "replies"}` : ""} will be removed. This cannot be undone.`}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />

      {demand.responseCount > 0 && (
        <Button variant="ghost" size="sm" accent={colors.buyer}
          style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          onPress={() => setOpen((v) => !v)}>
          {open ? "Hide replies" : `${tr("View", lang)} ${demand.responseCount} ${demand.responseCount === 1 ? tr("reply", lang) : tr("replies", lang)}`}
        </Button>
      )}

      {open && responses.map((r) => (
        <View key={r.id} style={s.replyRow}>
          <View style={s.requirementHead}>
            <View style={{ flex: 1 }}>
              <Text size="sm" weight="700">{r.responderName}</Text>
              {r.offeredQty != null && <Muted>{`${tr("Offers", lang)} ${r.offeredQty} MT`}</Muted>}
            </View>
            {r.status === "pending"
              ? <Badge color={colors.buyerForeground} bg={colors.buyer}>Pending</Badge>
              : r.status === "accepted"
                ? <Badge color="#ffffff" bg={colors.farmer}>Accepted</Badge>
                : <Badge color={colors.mutedForeground} bg={colors.muted}>Declined</Badge>}
          </View>
          {r.message !== "" && <Text size="xs" style={{ marginTop: 4 }}>{`"${r.message}"`}</Text>}
          {r.status === "pending" && (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button size="sm" accent={colors.buyer} disabled={busyId === r.id}
                onPress={() => decide(r, "accepted")}>
                Accept
              </Button>
              <Button size="sm" variant="outline" accent={colors.buyer} disabled={busyId === r.id}
                onPress={() => decide(r, "rejected")}>
                Decline
              </Button>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/** One posted input-supply listing, with its own delete confirmation. */
function SupplyPostingRow({ posting: p }: { posting: RequestRow }) {
  const { session, lang } = useApp();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    try {
      await requestRepo.deleteRequest(session, p.id);
      toast.success("Posting deleted.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not delete that posting."));
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <View style={s.postingRow}>
      <View style={{ flex: 1 }}>
        <Text size="sm" weight="600">
          {`${formatQuantity(p.qty, p.unit, p.qtyLabel)} · ${tr(p.item, lang)} · ${tr(p.category, lang)}`}
        </Text>
        <Muted>{`${p.district} · ${tr(p.windowLabel, lang)}`}</Muted>
      </View>
      {p.pendingCount > 0 ? (
        <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${p.pendingCount} ${tr("to review", lang)}`}</Badge>
      ) : p.responseCount > 0 ? (
        <Badge color={colors.mutedForeground} bg={colors.muted}>{`${p.responseCount} ${tr("replied", lang)}`}</Badge>
      ) : (
        <Badge color={colors.mutedForeground} bg={colors.muted}>No replies yet</Badge>
      )}
      <Button size="sm" variant="ghost" accent={colors.destructive}
        icon={<Trash2 size={11} color={colors.destructive} />}
        onPress={() => setConfirmingDelete(true)}>
        {""}
      </Button>

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete this posting?"
        message={`${p.item}${p.responseCount > 0 ? ` and its ${p.responseCount} ${p.responseCount === 1 ? "reply" : "replies"}` : ""} will be removed. This cannot be undone.`}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </View>
  );
}

/* ============== Supplier side ============== */

function SupplierView() {
  // The supplier record linked to the signed-in account. This was `suppliers[0]`
  // — whoever opened the Supplier view edited "Mahabeej Seeds Ltd" regardless of
  // who they were, because supplier was a UI toggle rather than a role.
  const { profileId, session, lang } = useApp();
  const sup = useDbQuery<Supplier | null>(
    () => (profileId == null ? Promise.resolve(null) : marketRepo.getSupplierById(profileId)),
    [profileId], null);
  const nav = useNavigation<BottomTabNavigationProp<BuyerTabParamList>>();
  const supplies = useDbQuery<RequestRow[]>(
    () => requestRepo.listMyRequests(session, "input_supply"), [session?.partyId], []);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [cats, setCats] = useState("");
  const [products, setProducts] = useState("");
  const [price, setPrice] = useState("");
  const [certs, setCerts] = useState("");
  const [regions, setRegions] = useState("");
  const [moq, setMoq] = useState("");
  const [lead, setLead] = useState("");
  const [seasons, setSeasons] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sup == null) return;
    // Company and brand are separate fields now. They used to be shown as one
    // "Mahabeej Seeds Ltd (Mahabeej)" value, which cannot be parsed back into two
    // columns once someone edits it.
    setName(sup.name);
    setBrand(sup.brand);
    setCats(sup.categories.join(", "));
    setProducts(sup.products);
    setPrice(sup.priceRange);
    setCerts(sup.certifications);
    setRegions(sup.regions);
    setMoq(sup.minOrder);
    setLead(String(sup.leadTimeDays));
    setSeasons(sup.seasons);
  }, [sup]);

  async function save() {
    if (saving) return;
    if (name.trim() === "") {
      toast.error("Company name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await marketRepo.updateSupplierProfile(session, {
        name: name.trim(),
        brand: brand.trim(),
        categories: splitList(cats),
        products: products.trim(),
        priceRange: price.trim(),
        certifications: certs.trim(),
        regions: regions.trim(),
        minOrder: moq.trim(),
        leadTimeDays: Number(lead) || 0,
        seasons: seasons.trim(),
      });
      toast.success("Supplier profile saved.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Package size={16} color={colors.buyer} />
            <CardTitle>Supplier self-declaration</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Field label="Company name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Brand"><Input value={brand} onChangeText={setBrand} /></Field>
          <Field label="Product categories"><Input value={cats} onChangeText={setCats} /></Field>
          <Field label="Products & pack sizes"><Input value={products} onChangeText={setProducts} multiline numberOfLines={2} /></Field>
          <Field label="Price list / range"><Input value={price} onChangeText={setPrice} /></Field>
          <Field label="Certifications / licences"><Input value={certs} onChangeText={setCerts} /></Field>
          <Field label="Supply regions"><Input value={regions} onChangeText={setRegions} /></Field>
          <Field label="Min order quantity"><Input value={moq} onChangeText={setMoq} /></Field>
          <Field label="Delivery lead time (days)"><Input value={lead} onChangeText={setLead} keyboardType="numeric" /></Field>
          <Field label="Seasonal availability"><Input value={seasons} onChangeText={setSeasons} /></Field>
          <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }}
            disabled={saving} onPress={save}>
            {saving ? "Saving…" : "Save supplier profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <ClipboardList size={16} color={colors.buyer} />
            <CardTitle>Post a supply request</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Muted style={{ marginBottom: spacing.sm }}>
            Post inputs you can supply — we&apos;ll match you with FPOs/farmers who need them.
          </Muted>
          <SupplyForm onPost={async (p) => {
            try {
              // "50 MT" is what the supplier typed; matching needs the 50.
              const q = parseQuantity(p.qty);
              await requestRepo.createRequest(session, {
                kind: "input_supply",
                item: p.item,
                category: p.category,
                qty: q.qty,
                qtyLabel: q.label,
                unit: q.unit,
                windowLabel: p.window,
                district: p.region,
                priceUnit: p.pricePerUnit,
              });
              toast.success(`${tr("Supply for", lang)} ${p.qty} ${p.item} ${tr("posted. Matching FPOs/farmers…", lang)}`);
              nav.navigate("BuyerMatching");
            } catch (e) {
              toast.error(describeWriteError(e, "Could not post that supply."));
            }
          }} />
        </CardContent>
      </Card>

      {supplies.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your open supply postings</CardTitle></CardHeader>
          <CardContent>
            {supplies.map((p) => (
              <SupplyPostingRow key={p.id} posting={p} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** What the supply form collects, before it becomes an `input_supply` request. */
interface SupplyDraft {
  item: string; category: string; qty: string;
  pricePerUnit: string; region: string; window: string;
}

/** What the demand form collects, before it becomes a `commodity_demand` request. */
interface DemandDraft {
  commodity: string; qty_mt: number; grade: string;
  delivery: string; location: string;
}

function SupplyForm({ onPost }: { onPost: (p: SupplyDraft) => void }) {
  const [item, setItem] = useState("NPK 19:19:19");
  const [cat, setCat] = useState("Fertilizer");
  const [qty, setQty] = useState("50 MT");
  const [price, setPrice] = useState("₹52/kg");
  const [region, setRegion] = useState("Western Maharashtra");
  const [win, setWin] = useState("Aug – Sep");

  return (
    <>
      <Field label="Item"><Input value={item} onChangeText={setItem} /></Field>
      <Field label="Category">
        <Select value={cat} options={["Seeds", "Fertilizer", "Pesticide", "Bio-input", "Equipment rental", "Equipment sale"]} onChange={setCat} />
      </Field>
      <Field label="Quantity (with unit)"><Input value={qty} onChangeText={setQty} /></Field>
      <Field label="Price / unit"><Input value={price} onChangeText={setPrice} /></Field>
      <Field label="Supply region"><Input value={region} onChangeText={setRegion} /></Field>
      <Field label="Availability window"><Input value={win} onChangeText={setWin} /></Field>
      <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }} icon={<Plus size={16} color="#ffffff" />}
        onPress={() => onPost({ item, category: cat, qty, pricePerUnit: price, region, window: win })}>
        Post & match
      </Button>
    </>
  );
}

function DemandForm({ onPost }: { onPost: (d: DemandDraft) => void }) {
  const [commodity, setCommodity] = useState("Onion");
  const [qty, setQty] = useState("250");
  const [grade, setGrade] = useState("A");
  const [delivery, setDelivery] = useState("2026-07-15");
  const [location, setLocation] = useState("Pune");

  return (
    <>
      <Field label="Commodity">
        <Select value={commodity} options={["Onion", "Tomato", "Soybean", "Tur", "Banana", "Turmeric", "Cotton", "Rice", "Mosambi", "Gram"]} onChange={setCommodity} />
      </Field>
      <Field label="Quantity (MT)"><Input value={qty} onChangeText={setQty} keyboardType="numeric" /></Field>
      <Field label="Grade"><Select value={grade} options={["A", "B", "Sortex", "Export"]} onChange={setGrade} /></Field>
      <Field label="Delivery by"><Input value={delivery} onChangeText={setDelivery} placeholder="YYYY-MM-DD" /></Field>
      <Field label="Delivery location"><Input value={location} onChangeText={setLocation} /></Field>
      <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }} icon={<Plus size={16} color="#ffffff" />}
        onPress={() => onPost({ commodity, qty_mt: Number(qty) || 0, grade, delivery, location })}>
        Post & match
      </Button>
    </>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  postingRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  requirementCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm, gap: 4,
  },
  requirementHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
  },
  replyRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.sm,
  },
});
