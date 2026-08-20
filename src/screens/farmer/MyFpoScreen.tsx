import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import {
  Building2, ChevronDown, ChevronUp, Lightbulb, LineChart as LineIcon,
  ListOrdered, MapPin, Sprout, TrendingUp, Users,
} from "lucide-react-native";
import { useSessionFarmer } from "../../lib/useSessionProfile";
import { fpoRepo, marketRepo, membershipRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { MembershipRow } from "../../db/repositories/membershipRepository";
import { useApp } from "../../lib/app-state";
import { useDbQuery } from "../../db/useDbQuery";
import type { FPO, FpoMonthlySummary } from "../../db/types";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Button, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Badge, Muted, Select, Stat, Table, Text, toast,
} from "../../components/ui";
import { EmptyHint, Meta, SectionCard, SectionCardRow, Segmented } from "../../components/common";
import { useFarmerBack } from "../../hooks/useFarmerBack";
import { LineChart } from "../../components/charts";
import type { FarmerTabParamList } from "../../navigation/types";

type Sub = null | "market" | "fpo" | "near";

const inr = (n: number) => n.toLocaleString("en-IN");

/** Ported from the web app's src/routes/farmer.my-fpo.tsx */
export function MyFpoScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<FarmerTabParamList, "MyFpo">>();
  const goBack = useFarmerBack();
  const [sub, setSub] = useState<Sub>(null);

  // The web app read a `?sub=` query string off window.location. The RN equivalent
  // is a navigation param, so deep links / in-app nudges keep working.
  // `req` is in the deps so repeat navigations to the same section re-open it.
  useEffect(() => {
    const p = route.params?.sub;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing a nav-param deep link into local tab state; intentional (see navigation/types.ts SectionParams).
    if (p === "market" || p === "fpo" || p === "near") setSub(p);
  }, [route.params?.sub, route.params?.req]);

  return (
    <RoleShell accent="farmer" screenName="My FPO" onBack={goBack} onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <SectionCardRow>
        <SectionCard active={sub === "market"} accent={colors.farmer} title="Market Insights"
          onPress={() => setSub(sub === "market" ? null : "market")}
          icon={<TrendingUp size={22} color={sub === "market" ? "#fff" : colors.farmer} />} />
        <SectionCard active={sub === "fpo"} accent={colors.farmer} title="FPO details"
          onPress={() => setSub(sub === "fpo" ? null : "fpo")}
          icon={<Building2 size={22} color={sub === "fpo" ? "#fff" : colors.farmer} />} />
        <SectionCard active={sub === "near"} accent={colors.farmer} title="FPOs near me"
          onPress={() => setSub(sub === "near" ? null : "near")}
          icon={<MapPin size={22} color={sub === "near" ? "#fff" : colors.farmer} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Tap one of the three buttons above to open that section.</EmptyHint>}
      {sub === "market" && <MarketInsights />}
      {sub === "fpo" && <MyFpoDetails />}
      {sub === "near" && <NearbyFpos />}
    </RoleShell>
  );
}

function MarketInsights() {
  const { width } = useWindowDimensions();
  const chartW = width - spacing.lg * 2 - spacing.lg * 2;
  const farmer = useSessionFarmer();
  // Memoised: a fresh `[]` each render would re-fire the crop-defaulting effect below.
  const cropOptions = useMemo(() => farmer?.crops ?? [], [farmer]);
  const [crop, setCrop] = useState("");
  const [duration, setDuration] = useState<"1w" | "1m">("1m");
  const [showApmcChart, setShowApmcChart] = useState(false);
  const [showDailyChart, setShowDailyChart] = useState(false);

  useEffect(() => {
    if (crop === "" && cropOptions.length > 0) setCrop(cropOptions[0]);
  }, [crop, cropOptions]);

  const series = useDbQuery<{ date: string; price: number }[]>(
    () => (crop === "" ? Promise.resolve([]) : marketRepo.getDailyPrices(crop)),
    [crop], [],
  );
  const sliced = duration === "1w" ? series.slice(-7) : series;

  // Simulated FPO-vs-APMC monthly snapshot — logic preserved from the web app.
  const cropPriceHistory = useMemo(() => {
    const base = series[series.length - 1]?.price ?? 1500;
    const months = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
    return months.map((m, i) => ({
      month: m,
      apmc: Math.round(base * (0.85 + i * 0.025)),
      fpo: Math.round(base * (0.85 + i * 0.025) * 1.22),
    }));
  }, [series]);

  const latest = sliced.slice().reverse().slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle color={colors.farmer}>FPO vs APMC · last 6 months</CardTitle>
          <View style={{ marginTop: spacing.sm }}>
            <Field label="Crop">
              <Select value={crop} options={cropOptions} onChange={setCrop} />
            </Field>
          </View>
        </CardHeader>
        <CardContent>
          <Table
            columns={[
              { key: "month", label: "Month" },
              { key: "apmc", label: "APMC ₹/q", align: "right" },
              { key: "fpo", label: "FPO ₹/q", align: "right" },
              { key: "uplift", label: "Uplift", align: "right" },
            ]}
            rows={cropPriceHistory.map((r) => ({
              month: r.month,
              apmc: inr(r.apmc),
              fpo: inr(r.fpo),
              uplift: (
                <Text size="xs" color={colors.farmer} style={{ textAlign: "right" }}>
                  {`+${Math.round(((r.fpo - r.apmc) / r.apmc) * 100)}%`}
                </Text>
              ),
            }))}
          />
          <View style={{ alignItems: "flex-end", marginTop: spacing.md }}>
            <Button variant="outline" size="sm" accent={colors.farmer}
              icon={<LineIcon size={12} color={colors.farmer} />}
              onPress={() => setShowApmcChart((v) => !v)}>
              {showApmcChart ? "Hide chart" : "View chart"}
            </Button>
          </View>
          {showApmcChart && (
            <View style={{ marginTop: spacing.md }}>
              <LineChart
                width={chartW}
                labels={cropPriceHistory.map((r) => r.month)}
                series={[
                  { key: "fpo", label: "FPO", color: colors.farmer, points: cropPriceHistory.map((r) => r.fpo) },
                  { key: "apmc", label: "APMC", color: colors.mutedForeground, points: cropPriceHistory.map((r) => r.apmc) },
                ]}
              />
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`Daily APMC prices · ${crop}`}</CardTitle>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.sm }}>
            <Segmented
              options={["1w", "1m"] as const}
              value={duration}
              onChange={setDuration}
              accent={colors.farmer}
              labelOf={(v) => (v === "1w" ? "1 week" : "1 month")}
            />
          </View>
        </CardHeader>
        <CardContent>
          <Table
            columns={[
              { key: "date", label: "Date" },
              { key: "price", label: "Price ₹/q", align: "right" },
            ]}
            rows={latest.map((r) => ({ date: r.date, price: inr(r.price) }))}
          />
          <View style={s.rowBetween}>
            <Muted style={{ flex: 1 }}>
              {`Showing latest ${Math.min(10, sliced.length)} of ${sliced.length} days.`}
            </Muted>
            <Button variant="outline" size="sm" accent={colors.farmer}
              icon={<ListOrdered size={12} color={colors.farmer} />}
              onPress={() => setShowDailyChart((v) => !v)}>
              {showDailyChart ? "Hide chart" : "View chart"}
            </Button>
          </View>
          {showDailyChart && (
            <View style={{ marginTop: spacing.md }}>
              <LineChart
                width={chartW}
                labels={sliced.map((r) => r.date)}
                series={[{ key: "price", label: crop, color: colors.farmer, points: sliced.map((r) => r.price) }]}
              />
            </View>
          )}
        </CardContent>
      </Card>

      <Card style={{ borderColor: colors.accent + "66", backgroundColor: "#FEF6EF" }}>
        <CardHeader>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Lightbulb size={16} color={colors.accent} />
            <CardTitle color={colors.accent}>Pro tip</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Text size="sm">
            Turmeric demand from processors is high this season. Your soil suits it — consider a 0.5-acre trial. Expected realisation:
            {" "}
            <Text size="sm" weight="700">₹11,500/q</Text>
            {" vs onion ₹1,820/q."}
          </Text>
        </CardContent>
      </Card>
    </>
  );
}

function MyFpoDetails() {
  const farmer = useSessionFarmer();
  const fpo = useDbQuery<FPO | null>(
    () => (farmer?.fpoId != null ? fpoRepo.getFpoById(farmer.fpoId) : Promise.resolve(null)),
    [farmer?.fpoId], null);
  // Was hardcoded locals; now a per-FPO row in fpo_monthly_summary.
  const summary = useDbQuery<FpoMonthlySummary | null>(
    () => (fpo != null ? fpoRepo.getMonthlySummary(fpo.id) : Promise.resolve(null)),
    [fpo?.id], null);
  const [open, setOpen] = useState(false);

  const monthSold = summary?.monthSoldQ ?? 0;
  const sellPrice = summary?.sellPrice ?? 0;
  const onwardPrice = summary?.onwardPrice ?? 0;
  const fpoProfit = summary?.fpoProfit ?? 0;
  const profitShare = Math.round(((farmer?.sharePct ?? 0) / 100) * fpoProfit);
  const sales = monthSold * sellPrice;

  if (farmer == null || fpo == null) return null;

  return (
    <>
      <Card style={{ borderColor: colors.farmer + "66", backgroundColor: colors.farmerSoft }}>
        <CardHeader>
          <Text size="xxs" weight="700" color={colors.farmer}>YOUR FPO — THIS MONTH</Text>
        </CardHeader>
        <CardContent>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Placard label="Sales" value={`₹${inr(sales)}`} foot={`${monthSold} q · ₹${sellPrice}/q`} />
            <Placard label="My Share of Profit" value={`₹${inr(profitShare)}`}
              foot={`Equity share: ${farmer.sharePct}%`} highlight />
          </View>
          <View style={{ alignItems: "flex-end", marginTop: spacing.md }}>
            <Button variant="outline" size="sm" accent={colors.farmer}
              onPress={() => setOpen((o) => !o)}
              icon={open
                ? <ChevronUp size={12} color={colors.farmer} />
                : <ChevronDown size={12} color={colors.farmer} />}>
              {open ? "Hide breakdown" : "Learn More"}
            </Button>
          </View>
          {open && (
            <View style={s.breakdown}>
              <KV k="You sold to FPO" v={`${monthSold} q · ₹${sellPrice}/q`} />
              <KV k="FPO sold onward" v={`${monthSold} q · ₹${onwardPrice}/q`} />
              <KV k="FPO net profit (month)" v={`₹${inr(fpoProfit)}`} />
              <KV k="Your equity share" v={`${farmer.sharePct}%`} />
              <View style={s.dashed} />
              <Text size="xxs" weight="700" color={colors.farmer}>Your profit share this month</Text>
              <Text size="xxl" weight="700" color={colors.farmer}>{`₹${inr(profitShare)}`}</Text>
              <Text size="xs" style={{ marginTop: spacing.sm }}>
                Your income isn&apos;t only what you sold — you also earn a share of the FPO&apos;s profit because you&apos;re a part-owner. The more you sell through the FPO, the bigger your share.
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transaction history</CardTitle></CardHeader>
        <CardContent>
          <Table
            minWidth={430}
            columns={[
              { key: "date", label: "Date", flex: 1.3 },
              { key: "crop", label: "Crop" },
              { key: "qty", label: "Qty (q)", align: "right" },
              { key: "price", label: "Price ₹/q", align: "right" },
              { key: "amount", label: "Amount ₹", align: "right", flex: 1.2 },
            ]}
            rows={farmer.txns.map((t) => ({
              date: t.date, crop: t.crop, qty: String(t.qty_q),
              price: String(t.price), amount: inr(t.amount),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{`Membership · ${fpo.name}`}</CardTitle></CardHeader>
        <CardContent>
          <View style={s.statGrid}>
            <Stat label="Shareholding" value={`${farmer.sharePct}%`} />
            <Stat label="Share value" value={`₹${inr(farmer.sharePct * 12500)}`} />
          </View>
          <View style={s.statGrid}>
            <Stat label="Member since" value={farmer.memberSince ?? "—"} />
            <Stat label="Active txns" value={`${farmer.txns.length}`} />
          </View>
        </CardContent>
      </Card>
    </>
  );
}

function NearbyFpos() {
  const farmer = useSessionFarmer();
  const fpos = useDbQuery<FPO[]>(() => fpoRepo.listFpos(), [], []);
  const memberships = useDbQuery<MembershipRow[]>(
    () => membershipRepo.listFarmerMemberships(farmer?.id ?? null), [farmer?.id], []);
  const recommended = useMemo(
    () => (farmer == null ? [] : fpos.filter(
      (f) => f.district === farmer.district || f.commodities.some((c) => farmer.crops.includes(c)),
    ).slice(0, 4)),
    [fpos, farmer],
  );
  const [openFor, setOpenFor] = useState<string | null>(null);

  /** The farmer's standing with one FPO, so the card can say what happened. */
  const standingWith = (fpoId: string) =>
    memberships.find((m) => m.fpoId === fpoId && m.status !== "rejected" && m.status !== "exited");
  const belongsSomewhere = memberships.some((m) => m.status === "active");

  return (
    <>
      <Text size="lg" weight="700">Nearby FPOs recommended for you</Text>
      {recommended.map((fpo) => {
        const standing = standingWith(fpo.id);
        return (
          <Card key={fpo.id}>
            <CardContent style={{ paddingTop: spacing.lg }}>
              {/* Tier badge and the "+X% vs APMC" stat were removed; the title
                  now spans the full width and the meta list is a single column.
                  The invented "4 + idx * 6 km" distance went with them — it was
                  computed from the list position. */}
              <View style={s.cardHead}>
                <Text size="base" weight="700" style={{ flex: 1 }}>{fpo.name}</Text>
                {standing?.status === "pending" && <Badge color="#ffffff" bg={colors.accent}>Applied</Badge>}
                {standing?.status === "active" && <Badge color="#ffffff" bg={colors.farmer}>Member</Badge>}
              </View>
              <Muted style={{ marginTop: 2 }}>{fpo.tagline}</Muted>

              <View style={s.metaList}>
                <Meta icon={<MapPin size={13} color={colors.mutedForeground} />} label={`${fpo.block}, ${fpo.district}`} />
                <Meta icon={<Users size={13} color={colors.mutedForeground} />} label={`${fpo.members} members`} />
                <Meta icon={<Sprout size={13} color={colors.mutedForeground} />} label={fpo.commodities.join(", ")} />
              </View>

              {standing?.status === "pending" && (
                <Muted style={{ marginTop: spacing.md }}>
                  Application sent. The FPO will approve or decline it.
                </Muted>
              )}
              {standing?.status === "active" && (
                <Muted style={{ marginTop: spacing.md }}>You are a member of this FPO.</Muted>
              )}
              {standing == null && (
                <Button full accent={colors.farmer} disabled={belongsSomewhere}
                  onPress={() => setOpenFor(fpo.id)} style={{ marginTop: spacing.md }}>
                  {belongsSomewhere ? "Already in an FPO" : "Apply for Membership"}
                </Button>
              )}
              {openFor === fpo.id && (
                <ApplyForm fpo={fpo} farmer={farmer} onDone={() => setOpenFor(null)} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

/**
 * The membership application.
 *
 * Every field used to be discarded on submit. The form now prefills from the
 * farmer's own record — they are applying as themselves, not filling in a
 * stranger's details — and corrections update their profile, while the mobile
 * number and note stay on the membership as details given to this FPO.
 */
function ApplyForm({
  fpo, farmer, onDone,
}: { fpo: FPO; farmer: ReturnType<typeof useSessionFarmer>; onDone: () => void }) {
  const { session } = useApp();
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState(farmer?.village ?? "");
  const [land, setLand] = useState(farmer?.landAcres != null ? String(farmer.landAcres) : "");
  const [crops, setCrops] = useState((farmer?.crops ?? []).join(", "));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await membershipRepo.apply(session, {
        fpoId: fpo.id,
        note: note.trim() === "" ? null : note.trim(),
        contactPhone: mobile.trim() === "" ? null : mobile.trim(),
        village: village.trim(),
        landAcres: Number(land) || null,
        crops: crops.split(",").map((c) => c.trim()).filter((c) => c.length > 0),
      });
      toast.success(`Application sent to ${fpo.name}. They will approve or decline it.`);
      onDone();
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that application."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.inlineForm}>
      <Muted style={{ marginBottom: spacing.sm }}>
        {`Applying as ${farmer?.name ?? "you"}. Corrections here update your profile.`}
      </Muted>
      <Field label="Mobile"><Input value={mobile} onChangeText={setMobile} placeholder="9876xxxxxx" keyboardType="phone-pad" /></Field>
      <Field label="Village"><Input value={village} onChangeText={setVillage} placeholder="Kotul" /></Field>
      <Field label="Landholding (acres)"><Input value={land} onChangeText={setLand} placeholder="3.2" keyboardType="numeric" /></Field>
      <Field label="Crops"><Input value={crops} onChangeText={setCrops} placeholder="Onion, Tomato" /></Field>
      <Field label="Anything to add"><Input value={note} onChangeText={setNote} multiline numberOfLines={2} /></Field>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
        <Button variant="ghost" size="sm" onPress={onDone}>Cancel</Button>
        <Button size="sm" accent={colors.farmer} disabled={busy} onPress={submit}>
          {busy ? "Sending…" : "Submit"}
        </Button>
      </View>
    </View>
  );
}

function Placard({ label, value, foot, highlight }: { label: string; value: string; foot: string; highlight?: boolean }) {
  return (
    <View style={[s.placard, highlight ? { backgroundColor: colors.farmer, borderColor: colors.farmer } : null]}>
      <Text size="xxs" weight="600" color={highlight ? "rgba(255,255,255,0.9)" : colors.mutedForeground}>{label}</Text>
      <Text size="xxl" weight="700" color={highlight ? "#ffffff" : colors.foreground} style={{ marginTop: 2 }}>{value}</Text>
      <Text size="xxs" color={highlight ? "rgba(255,255,255,0.9)" : colors.mutedForeground}>{foot}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.rowBetween}>
      <Muted>{k}</Muted>
      <Text size="sm" weight="700">{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  breakdown: { backgroundColor: "rgba(255,255,255,0.75)", borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, gap: 4 },
  dashed: { borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.farmer + "66", marginVertical: spacing.sm },
  placard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.background },
  statGrid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  /** Single-column meta list — the 2x2 grid looked sparse once the stat was removed. */
  metaList: { gap: 8, marginTop: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inlineForm: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.md,
  },
});
