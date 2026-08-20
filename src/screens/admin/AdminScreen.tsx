import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Activity, Banknote, ShieldAlert, Users, Building2 } from "lucide-react-native";
import { adminRepo, auditRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { AdminPartyRow, AdminUserRow } from "../../db/repositories/adminRepository";
import type { AuditEvent } from "../../db/repositories/auditRepository";
import type { RoleCode } from "../../db/repositories/authRepository";
import { useDbQuery } from "../../db/useDbQuery";
import { useApp } from "../../lib/app-state";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Field,
  Input, Muted, Select, Table, Text, Toggle, toast,
} from "../../components/ui";
import { EmptyHint, SectionCard, SectionCardRow } from "../../components/common";

/**
 * The administrator's view.
 *
 * Admin used to be an access grant: it let one account open the farmer, FPO and
 * buyer screens, and that was all it meant. Everything an administrator actually
 * does — creating an account, granting a role, pointing a login at an
 * organisation, taking a party out of the market, settling a dispute — had
 * nowhere to live and no record that it happened.
 */

type Sub = null | "users" | "parties" | "services" | "moderation" | "activity";

const ALL_ROLES: RoleCode[] = ["farmer", "fpo", "buyer", "supplier", "admin"];

export function AdminScreen() {
  const [sub, setSub] = useState<Sub>(null);
  const iconColor = (v: Exclude<Sub, null>) => (sub === v ? "#fff" : colors.primary);
  const toggle = (v: Exclude<Sub, null>) => setSub(sub === v ? null : v);

  return (
    <RoleShell accent="buyer" screenName="Administration">
      <View>
        <Text size="xl" weight="600">Administration</Text>
        <Muted style={{ marginTop: 2 }}>
          Accounts, parties and moderation. Every action here is recorded.
        </Muted>
      </View>

      <SectionCardRow>
        <SectionCard title="Users & Roles" accent={colors.primary} active={sub === "users"}
          onPress={() => toggle("users")} icon={<Users size={22} color={iconColor("users")} />} />
        <SectionCard title="Parties" accent={colors.primary} active={sub === "parties"}
          onPress={() => toggle("parties")} icon={<Building2 size={22} color={iconColor("parties")} />} />
        <SectionCard title="Service Desk" accent={colors.primary} active={sub === "services"}
          onPress={() => toggle("services")} icon={<Banknote size={22} color={iconColor("services")} />} />
        <SectionCard title="Moderation" accent={colors.primary} active={sub === "moderation"}
          onPress={() => toggle("moderation")} icon={<ShieldAlert size={22} color={iconColor("moderation")} />} />
        <SectionCard title="Activity Log" accent={colors.primary} active={sub === "activity"}
          onPress={() => toggle("activity")} icon={<Activity size={22} color={iconColor("activity")} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick a section to open it.</EmptyHint>}
      {sub === "users" && <UsersSection />}
      {sub === "parties" && <PartiesSection />}
      {sub === "services" && <ServiceDeskSection />}
      {sub === "moderation" && <ModerationSection />}
      {sub === "activity" && <ActivitySection />}
    </RoleShell>
  );
}

/* ------------------------------------------------------------- users ----- */

function UsersSection() {
  const { session } = useApp();
  const users = useDbQuery<AdminUserRow[]>(() => adminRepo.listUsers(session), [session?.userId], []);
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState<number | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  async function run(what: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true);
    try {
      await what();
      toast.success(ok);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not complete that."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Create an account</CardTitle></CardHeader>
        <CardContent>
          <Field label="Username"><Input value={username} onChangeText={setUsername}
            autoCapitalize="none" placeholder="e.g. fpo02" /></Field>
          <Field label="Display name"><Input value={displayName} onChangeText={setDisplayName}
            placeholder="Organisation or person" /></Field>
          <Field label="Password"><Input value={password} onChangeText={setPassword}
            secureTextEntry autoCapitalize="none" /></Field>
          <Muted style={{ marginBottom: spacing.sm }}>
            A new account cannot sign in until it has a role and a linked profile.
          </Muted>
          <Button accent={colors.primary} style={{ alignSelf: "flex-end" }} disabled={busy}
            onPress={() => run(async () => {
              await adminRepo.createUser(session, username, password, displayName);
              setUsername(""); setDisplayName(""); setPassword("");
            }, "Account created.")}>
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{`Accounts (${users.length})`}</CardTitle></CardHeader>
        <CardContent>
          {users.map((u) => (
            <View key={u.id} style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{u.displayName}</Text>
                  <Muted noTranslate>{u.username}</Muted>
                </View>
                {u.isActive
                  ? <Badge color="#ffffff" bg={colors.farmer}>Active</Badge>
                  : <Badge color={colors.destructive} bg="#FDECEA">Disabled</Badge>}
              </View>

              <Muted style={{ marginTop: spacing.sm }}>
                {u.roles.length === 0 ? "No roles" : `Roles: ${u.roles.join(", ")}`}
              </Muted>
              <Muted>
                {u.profiles.length === 0
                  ? "No profiles linked — this account cannot sign in"
                  : u.profiles.map((p) => `${p.role} → ${p.name}`).join(" · ")}
              </Muted>

              <Button variant="ghost" size="sm" accent={colors.primary}
                style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                onPress={() => setOpenFor(openFor === u.id ? null : u.id)}>
                {openFor === u.id ? "Hide" : "Manage"}
              </Button>

              {openFor === u.id && (
                <View style={s.inner}>
                  <Toggle checked={u.isActive} accent={colors.primary} label="Account enabled"
                    onChange={(v) => run(() => adminRepo.setUserActive(session, u.id, v),
                      v ? "Account enabled." : "Account disabled.")} />

                  <Text size="xxs" weight="700" color={colors.mutedForeground}
                    style={{ marginTop: spacing.md, marginBottom: 4 }}>ROLES</Text>
                  {ALL_ROLES.map((r) => (
                    <Toggle key={r} checked={u.roles.includes(r)} accent={colors.primary} label={r}
                      onChange={(v) => run(() => adminRepo.setUserRole(session, u.id, r, v),
                        v ? `${r} granted.` : `${r} revoked.`)} />
                  ))}

                  <LinkProfile userId={u.id} onDone={() => setOpenFor(null)} />
                </View>
              )}
            </View>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

/** Points one account at one entity — what makes an account able to sign in. */
function LinkProfile({ userId, onDone }: { userId: number; onDone: () => void }) {
  const { session } = useApp();
  const [role, setRole] = useState("fpo");
  const [partyId, setPartyId] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useDbQuery<{ partyId: number; name: string; entityId: string }[]>(
    () => adminRepo.listLinkableParties(session, role), [role, session?.userId], []);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text size="xxs" weight="700" color={colors.mutedForeground} style={{ marginBottom: 4 }}>
        LINK A PROFILE
      </Text>
      <Field label="Role">
        <Select value={role} options={["farmer", "fpo", "buyer", "supplier"]} onChange={(v) => { setRole(v); setPartyId(""); }} />
      </Field>
      <Field label="Entity">
        <Select value={partyId === "" ? String(options[0]?.partyId ?? "") : partyId}
          options={options.map((o) => String(o.partyId))}
          onChange={setPartyId}
          labelOf={(id) => options.find((o) => String(o.partyId) === id)?.name ?? id} />
      </Field>
      <Button size="sm" accent={colors.primary} style={{ alignSelf: "flex-end" }} disabled={busy}
        onPress={async () => {
          const chosen = partyId === "" ? options[0]?.partyId : Number(partyId);
          if (chosen == null) return;
          setBusy(true);
          try {
            await adminRepo.linkProfile(session, userId, role, chosen);
            toast.success("Profile linked.");
            onDone();
          } catch (e) {
            toast.error(describeWriteError(e, "Could not link that profile."));
          } finally {
            setBusy(false);
          }
        }}>
        Link
      </Button>
    </View>
  );
}

/* ----------------------------------------------------------- parties ----- */

function PartiesSection() {
  const { session } = useApp();
  const parties = useDbQuery<AdminPartyRow[]>(() => adminRepo.listParties(session), [session?.userId], []);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{`Parties (${parties.length})`}</CardTitle>
        <Muted>
          Deactivating removes a party from matching and closes its open postings.
          Its orders, ledger lines and reviews stay — those belong to the people it
          traded with as much as to it.
        </Muted>
      </CardHeader>
      <CardContent>
        {parties.map((p) => (
          <View key={p.partyId} style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text size="sm" weight={p.isActive ? "600" : "400"}
                color={p.isActive ? colors.foreground : colors.mutedForeground}>
                {p.name}
              </Text>
              <Muted>{`${p.kind}${p.orderCount > 0 ? ` · ${p.orderCount} orders` : ""}`}</Muted>
            </View>
            <Toggle checked={p.isActive} accent={colors.primary} label=""
              onChange={async (v) => {
                if (busy) return;
                setBusy(true);
                try {
                  await adminRepo.setPartyActive(session, p.partyId, v);
                  toast.success(v ? `${p.name} reactivated.` : `${p.name} deactivated.`);
                } catch (e) {
                  toast.error(describeWriteError(e, "Could not change that."));
                } finally {
                  setBusy(false);
                }
              }} />
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------ service desk ----- */

/**
 * Credit, compliance and contract requests.
 *
 * Providers hold parties but not logins yet, so nobody can open their own queue.
 * The operator processes these in the meantime, and the audit row records that an
 * admin decided it rather than implying the lender answered.
 */
function ServiceDeskSection() {
  const { session } = useApp();
  const requests = useDbQuery(() => adminRepo.listAllServiceRequests(session), [session?.userId], []);
  const [busy, setBusy] = useState(false);

  async function advance(id: number, to: "in_review" | "approved" | "rejected" | "completed") {
    if (busy) return;
    setBusy(true);
    try {
      await adminRepo.advanceServiceRequest(session, id, to);
      toast.success(`Request marked ${to.replace("_", " ")}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not update that request."));
    } finally {
      setBusy(false);
    }
  }

  const open = requests.filter((r) => ["pending", "in_review"].includes(r.status));
  const settled = requests.filter((r) => !["pending", "in_review"].includes(r.status));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{`Open requests (${open.length})`}</CardTitle>
          <Muted>Providers do not have their own logins yet, so these are processed here.</Muted>
        </CardHeader>
        <CardContent>
          {open.length === 0 && <Muted>Nothing waiting.</Muted>}
          {open.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{r.subject}</Text>
                  <Muted>{`${r.requesterName} → ${r.providerName} · ${r.serviceType}`}</Muted>
                  {r.amount != null && (
                    <Muted noTranslate>{`₹${r.amount.toLocaleString("en-IN")}`}</Muted>
                  )}
                </View>
                <Badge color={colors.mutedForeground} bg={colors.muted}>
                  {r.status.replace("_", " ")}
                </Badge>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
                {r.status === "pending" && (
                  <Button size="sm" variant="outline" accent={colors.primary} disabled={busy}
                    onPress={() => advance(r.id, "in_review")}>
                    Start review
                  </Button>
                )}
                <Button size="sm" accent={colors.primary} disabled={busy}
                  onPress={() => advance(r.id, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" accent={colors.destructive} disabled={busy}
                  onPress={() => advance(r.id, "rejected")}>
                  Decline
                </Button>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      {settled.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Settled</CardTitle></CardHeader>
          <CardContent>
            {settled.map((r) => (
              <View key={r.id} style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm">{r.subject}</Text>
                  <Muted>{r.requesterName}</Muted>
                </View>
                <Badge
                  color={r.status === "approved" || r.status === "completed" ? "#ffffff" : colors.mutedForeground}
                  bg={r.status === "approved" || r.status === "completed" ? colors.farmer : colors.muted}>
                  {r.status}
                </Badge>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* -------------------------------------------------------- moderation ----- */

function ModerationSection() {
  const { session } = useApp();
  const disputes = useDbQuery(() => adminRepo.listDisputes(session), [session?.userId], []);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolve(orderId: number, to: "delivered" | "cancelled") {
    if (busy) return;
    setBusy(true);
    try {
      await adminRepo.resolveDispute(session, orderId, to, note);
      setNote("");
      toast.success(`Dispute resolved as ${to}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not resolve that."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{`Disputed orders (${disputes.length})`}</CardTitle></CardHeader>
      <CardContent>
        {disputes.length === 0 && <Muted>Nothing in dispute.</Muted>}
        {disputes.map((d) => (
          <View key={d.id} style={s.card}>
            <Text size="sm" weight="700">{`${d.commodity} · ₹${d.totalAmount.toLocaleString("en-IN")}`}</Text>
            <Muted>{`${d.sellerName} → ${d.buyerName}`}</Muted>
            <Muted noTranslate>{d.orderNo}</Muted>
            <Field label="Resolution note">
              <Input value={note} onChangeText={setNote} multiline numberOfLines={2}
                placeholder="What was decided, and why" />
            </Field>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button size="sm" accent={colors.primary} disabled={busy}
                onPress={() => resolve(d.id, "delivered")}>
                Uphold delivery
              </Button>
              <Button size="sm" variant="outline" accent={colors.primary} disabled={busy}
                onPress={() => resolve(d.id, "cancelled")}>
                Cancel order
              </Button>
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------- activity ----- */

function ActivitySection() {
  const events = useDbQuery<AuditEvent[]>(() => auditRepo.listRecent(100), [], []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{`Activity log (${events.length})`}</CardTitle>
        <Muted>Decisions that changed somebody else&apos;s standing, newest first.</Muted>
      </CardHeader>
      <CardContent>
        {events.length === 0 && <Muted>Nothing recorded yet.</Muted>}
        {events.length > 0 && (
          <Table
            minWidth={560}
            columns={[
              { key: "when", label: "When", flex: 1.3 },
              { key: "who", label: "Who", flex: 1.3 },
              { key: "what", label: "Action", flex: 1.6 },
              { key: "on", label: "On", flex: 1.4 },
            ]}
            rows={events.map((e) => ({
              when: e.createdAt.slice(0, 16),
              who: e.actorName,
              what: (
                <View>
                  <Text size="xs">{e.action.replace(/_/g, " ")}</Text>
                  {e.toStatus !== "" && (
                    <Muted noTranslate>
                      {e.fromStatus !== "" ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus}
                    </Muted>
                  )}
                </View>
              ),
              on: (
                <View>
                  <Text size="xs" noTranslate>{`${e.entityType} ${e.entityId}`}</Text>
                  {e.detail !== "" && <Muted>{e.detail}</Muted>}
                </View>
              ),
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

const s = StyleSheet.create({
  rowBetween: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: spacing.sm, paddingVertical: 4,
  },
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  inner: {
    borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: spacing.sm, paddingTop: spacing.sm,
  },
});
