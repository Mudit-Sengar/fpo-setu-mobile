import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AlertTriangle, ArrowRight, Boxes, Building2, CalendarRange, CheckCircle2,
  ChevronRight, FileText, PackageCheck, ScrollText, ShieldCheck, Sparkles,
  TrendingUp, Upload, Warehouse, XCircle,
} from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import {
  Accordion, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Field, Muted, Progress, Select, Text, toast,
} from "../components/ui";
import { BackLink } from "../components/common";

/** Ported from the web app's src/components/market-readiness.tsx */

export const BUYER_OPTIONS = [
  "ITC", "Cargill", "Olam", "NCDEX", "Reliance Retail", "BigBasket",
  "Modern Retail Chains", "Export Houses", "Food Processors", "Seed Companies", "Feed Companies",
] as const;

export const CROP_OPTIONS = [
  "Wheat", "Rice", "Maize", "Soybean", "Onion", "Tomato", "Turmeric", "Cotton", "Pulses", "Sugarcane", "Other",
] as const;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_PALETTE = ["#F59E0B", "#059669", "#0284C7", "#7C3AED", "#E11D48", "#EA580C", "#0D9488", "#4F46E5"];

function BuyerAvatar({ name }: { name: string }) {
  const idx = Math.abs(name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_PALETTE.length;
  return (
    <View style={[s.avatar, { backgroundColor: AVATAR_PALETTE[idx] }]}>
      <Text size="base" weight="700" color="#ffffff" noTranslate>{initials(name)}</Text>
    </View>
  );
}

/* ============================================================
   MARKET READINESS HUB  (Learn & Get Expert Help)
   ============================================================ */

interface ReqCard { id: string; icon: React.ReactNode; title: string; items: string[] }

// NOTE (parity): as in the web app, the content is the SAME for every buyer —
// only the buyer name is interpolated. This is templated copy, not real data.
function buyerRequirements(buyer: string): ReqCard[] {
  const ic = { size: 16, color: colors.fpo } as const;
  return [
    { id: "buyer", icon: <Building2 {...ic} />, title: "Buyer Requirements", items: [
      `${buyer} sources directly from FPOs and large aggregators with traceable supply chains.`,
      "Minimum supply: 200 MT per season (per crop).",
      "Preferred varieties: high-yield, low-moisture hybrid grades.",
      "Payment terms: 30-day cycle from delivery acceptance.",
      "Preferred regions: Maharashtra, MP, Karnataka, Gujarat.",
    ]},
    { id: "warehouse", icon: <Warehouse {...ic} />, title: "Warehouse Design Standards", items: [
      "Minimum area: 2,500 sq ft of covered storage.",
      "RCC flooring with damp-proof course; no direct soil contact.",
      "Roof height: minimum 12 ft for cross-ventilation.",
      "Cross-ventilation via roof turbines and louvered windows.",
      "Quarterly pest control (fumigation log maintained).",
      "Temperature 25–32 °C; humidity below 65%.",
    ]},
    { id: "packhouse", icon: <PackageCheck {...ic} />, title: "Packhouse Standards", items: [
      "Dedicated sorting & grading area with conveyor / sorting tables.",
      "Hygiene: daily wash-down, foot dips at entry, no open footwear.",
      "Worker PPE — masks, gloves, head covers, safety shoes.",
      "Lighting: minimum 300 lux at sorting tables.",
      "Segregated waste bins; daily disposal log.",
    ]},
    { id: "quality", icon: <ShieldCheck {...ic} />, title: "Quality Standards", items: [
      "Moisture: Maize ≤ 14%, Wheat ≤ 12%, Soybean ≤ 11%.",
      "Foreign matter: ≤ 1% by weight.",
      "Aflatoxin: ≤ 20 ppb (where applicable).",
      "Visual grading per FAQ Grade A specifications.",
      "Sampling: 3 samples / 100 bags; lab testing for every lot.",
    ]},
    { id: "packaging", icon: <Boxes {...ic} />, title: "Packaging Standards", items: [
      "HDPE woven bags (50 kg) or new jute bags as per crop.",
      "Standard weight: 50 kg ± 250 g.",
      "Label: crop name, FPO name, grade, weight, packing date, lot no.",
      "Barcode / QR code on each bag — mandatory for traceability.",
    ]},
    { id: "certs", icon: <ScrollText {...ic} />, title: "Certifications Required", items: [
      "Mandatory: FSSAI, GST, Producer Company registration, PAN.",
      "Preferred: Organic (NPOP), Global GAP, APEDA registration.",
      "Submit scanned PDFs via FPO Setu profile; renewal reminders sent.",
    ]},
    { id: "contract", icon: <FileText {...ic} />, title: "Sample Contracts", items: [
      "Quantity commitment: tonnage per delivery window.",
      "Quality parameters: moisture, FM, aflatoxin thresholds with rejection clause.",
      "Price discovery: weekly published index + agreed premium / discount.",
      "Payment: 30 days from QC acceptance, via NEFT/RTGS.",
      "Penalty clauses for short-supply, quality failure, delayed delivery.",
    ]},
    { id: "calendar", icon: <CalendarRange {...ic} />, title: "Procurement Calendar", items: [] },
  ];
}

const CAL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAL_STATE: Record<number, "open" | "pre" | "off"> = {
  0: "open", 1: "pre", 2: "pre", 3: "off", 4: "off", 5: "off",
  6: "off", 7: "off", 8: "off", 9: "open", 10: "open", 11: "open",
};

function ProcurementCalendar() {
  const style = (st: "open" | "pre" | "off") =>
    st === "open" ? { bg: "#10B981", fg: "#ffffff" }
    : st === "pre" ? { bg: "#FBBF24", fg: "#451A03" }
    : { bg: colors.muted, fg: colors.mutedForeground };

  const legend = [
    { k: "open" as const, label: "Active procurement" },
    { k: "pre" as const, label: "Pre-season registration" },
    { k: "off" as const, label: "Off-season" },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <View style={s.calGrid}>
        {CAL_MONTHS.map((m, i) => {
          const st = style(CAL_STATE[i]);
          return (
            <View key={m} style={[s.calCell, { backgroundColor: st.bg }]}>
              <Text size="xxs" weight="700" color={st.fg} center noTranslate>{m}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ gap: 6 }}>
        {legend.map((l) => (
          <View key={l.k} style={s.legendRow}>
            <View style={[s.legendSwatch, { backgroundColor: style(l.k).bg }]} />
            <Muted>{l.label}</Muted>
          </View>
        ))}
      </View>
      <Muted>Example shown for Maize: Oct–Jan active, Feb–Mar pre-registration, Apr–Sep off-season.</Muted>
    </View>
  );
}

export function MarketReadinessHubSection() {
  const [buyer, setBuyer] = useState<string>("");
  const cards = buyer ? buyerRequirements(buyer) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} color={colors.fpo} />
            <CardTitle>Market Readiness Hub</CardTitle>
          </View>
          <Muted>See exactly what top buyers need — and how to get there.</Muted>
        </CardHeader>
        <CardContent>
          <Field label="Select a Buyer">
            <Select
              value={buyer}
              options={BUYER_OPTIONS}
              onChange={(v) => setBuyer(v)}
              placeholder="Choose a buyer to view their requirements"
            />
          </Field>
        </CardContent>
      </Card>

      {buyer !== "" && (
        <Card>
          <CardHeader>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <BuyerAvatar name={buyer} />
              <View style={{ flex: 1 }}>
                <Text size="base" weight="700">{buyer}</Text>
                <Muted>Buyer requirements & readiness reference</Muted>
              </View>
            </View>
          </CardHeader>
          <CardContent>
            {cards.map((c) => (
              <Accordion key={c.id} title={c.title}>
                {c.id === "calendar" ? (
                  <ProcurementCalendar />
                ) : (
                  c.items.map((it, i) => (
                    <View key={i} style={s.bullet}>
                      <ChevronRight size={14} color={colors.fpo} />
                      <Text size="sm" style={{ flex: 1 }}>{it}</Text>
                    </View>
                  ))
                )}
                {c.id === "contract" && (
                  <Button variant="outline" size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                    icon={<FileText size={13} color={colors.fpo} />}
                    onPress={() => toast.success("Sample contract download started.")}>
                    Download Sample Contract
                  </Button>
                )}
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ============================================================
   MARKET-LINKED GROWTH PLANNING  (Expansion Planner Tab B)
   ============================================================ */

type Stage = "select" | "summary" | "improve";
type Step = 1 | 2 | 3;

export function MarketLinkedGrowthPlanning() {
  const [stage, setStage] = useState<Stage>("select");
  const [buyer, setBuyer] = useState<string>("ITC");
  const [crop, setCrop] = useState<string>("Maize");
  const [step, setStep] = useState<Step>(1);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});
  const [assessed, setAssessed] = useState(false);

  if (stage === "select") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market-Linked Growth Planning</CardTitle>
          <Muted>Find out how ready you are to supply a specific buyer — and what it takes to get there.</Muted>
        </CardHeader>
        <CardContent>
          <Field label="Which buyer do you want to supply?">
            <Select value={buyer} options={BUYER_OPTIONS} onChange={(v) => setBuyer(v)} />
          </Field>
          <Field label="Which crop?">
            <Select value={crop} options={CROP_OPTIONS} onChange={(v) => setCrop(v)} />
          </Field>
          <Button full size="lg" accent={colors.fpo} onPress={() => setStage("summary")}>
            Check My Readiness
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage === "summary") {
    // Hardcoded score — same as the web prototype.
    const score = 62;
    const color = score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : "#F43F5E";
    const badge = score >= 75 ? "🟢" : score >= 50 ? "🟡" : "🔴";

    return (
      <>
        <BackLink label="Change buyer or crop" onPress={() => setStage("select")}
          icon={<ArrowRight size={14} color={colors.mutedForeground} style={{ transform: [{ rotate: "180deg" }] }} />} />

        <Card>
          <CardHeader>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Building2 size={16} color={colors.fpo} />
              <CardTitle>Opportunity Overview</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <Kv k="Target Buyer" v={buyer} />
            <Kv k="Commodity" v={crop} />
            <Kv k="Potential Value" v="₹1.8 Cr / year" />
            <Kv k="Procurement Window" v="Oct – Jan" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TrendingUp size={16} color={colors.fpo} />
              <CardTitle>Your Readiness Score</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <Text size="sm" weight="700" noTranslate>{`${badge} ${score}% Ready`}</Text>
            <Progress value={score} color={color} height={12} />
            <Muted>You&apos;re on your way — a few improvements will make you buyer-ready.</Muted>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={16} color="#F43F5E" />
              <CardTitle>Missing Requirements</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            {["Warehouse Ventilation", "Moisture Testing Equipment", "Digital Stock Records"].map((m) => (
              <View key={m} style={s.bullet}>
                <XCircle size={16} color="#F43F5E" />
                <Text size="sm" style={{ flex: 1 }}>{m}</Text>
              </View>
            ))}
          </CardContent>
        </Card>

        <View style={s.investBox}>
          <Muted>Estimated Investment Required</Muted>
          <Text size="xl" weight="700" color="#B45309">₹2.25 Lakhs</Text>
        </View>

        <Button full size="lg" accent={colors.fpo} onPress={() => { setStage("improve"); setStep(1); }}>
          Improve Readiness
        </Button>
        <Button full size="lg" variant="outline" accent={colors.fpo}
          onPress={() => toast.success(`Connection request sent to ${buyer}.`)}>
          Connect with Buyer
        </Button>
      </>
    );
  }

  // stage === "improve"
  return (
    <>
      <BackLink label="Back to summary" onPress={() => setStage("summary")}
        icon={<ArrowRight size={14} color={colors.mutedForeground} style={{ transform: [{ rotate: "180deg" }] }} />} />

      <View style={s.stepper}>
        {([1, 2, 3] as Step[]).map((n) => (
          <View key={n} style={s.stepItem}>
            <View style={[
              s.stepDot,
              step === n ? { backgroundColor: colors.fpo }
              : step > n ? { backgroundColor: "#10B981" }
              : { backgroundColor: colors.muted },
            ]}>
              <Text size="xxs" weight="700" color={step >= n ? "#ffffff" : colors.mutedForeground} noTranslate>
                {step > n ? "✓" : String(n)}
              </Text>
            </View>
            <Text size="xxs" weight={step === n ? "700" : "400"}
              color={step === n ? colors.foreground : colors.mutedForeground}>
              {n === 1 ? "Gap Assessment" : n === 2 ? "Roadmap" : "Verify"}
            </Text>
          </View>
        ))}
      </View>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Gap Assessment</CardTitle></CardHeader>
          <CardContent>
            {[
              { icon: "🏚", name: "Warehouse", status: "available", pct: 70 },
              { icon: "📏", name: "Moisture Meter", status: "missing", pct: 0 },
              { icon: "📋", name: "Inventory Management", status: "missing", pct: 0 },
            ].map((it) => (
              <View key={it.name} style={s.gapRow}>
                <View style={s.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <Text size="lg" noTranslate>{it.icon}</Text>
                    <Text size="sm" weight="600">{it.name}</Text>
                  </View>
                  {it.status === "available"
                    ? <Badge color="#ffffff" bg="#10B981">Available</Badge>
                    : <Badge color="#E11D48" bg="#FFE4E6">Missing</Badge>}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}><Progress value={it.pct} color={colors.fpo} /></View>
                  <Muted>{`${it.pct}%`}</Muted>
                </View>
              </View>
            ))}
            <Button full accent={colors.fpo} onPress={() => setStep(2)}
              icon={<ArrowRight size={16} color="#ffffff" />}>
              Next: See Recommended Investments
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader><CardTitle>Growth Roadmap Generated</CardTitle></CardHeader>
            <CardContent>
              <View style={s.currentState}>
                <Text size="xxs" weight="700" color={colors.fpo} style={{ marginBottom: spacing.sm }}>CURRENT STATE</Text>
                <Kv k="Revenue" v="₹40 Lakhs" />
                <Kv k="Storage" v="100 MT" />
                <Kv k="Score" v="62%" />
              </View>
            </CardContent>
          </Card>

          <PhaseCard n={1} title="Quick Wins" timeline="0–3 Months" invest="₹25,000" action="Buy Moisture Meter" jump="62% → 75%" />
          <PhaseCard n={2} title="Infrastructure" timeline="3–6 Months" invest="₹1.5 Lakhs" action="Warehouse Upgrade" jump="75% → 91%" />
          <PhaseCard n={3} title="Market Entry" timeline="6–9 Months" action={`Connect with ${buyer} Procurement Team`} expected="₹1.8 Crores / year" />

          <Button full accent={colors.fpo} onPress={() => setStep(3)} icon={<ArrowRight size={16} color="#ffffff" />}>
            Next: Verify My Readiness
          </Button>
        </>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Verify Your Readiness</CardTitle>
            <Muted>Upload documents and photos to get your official Buyer Readiness score.</Muted>
          </CardHeader>
          <CardContent>
            {[
              { id: "warehouse", icon: "📷", label: "Warehouse Photos" },
              { id: "gst", icon: "📄", label: "GST Certificate" },
              { id: "fssai", icon: "📄", label: "FSSAI License" },
              { id: "stock", icon: "📄", label: "Storage Records" },
              { id: "infra", icon: "📄", label: "Infrastructure Details" },
            ].map((it) => (
              <View key={it.id} style={s.uploadRow}>
                <Text size="lg" noTranslate>{it.icon}</Text>
                <Text size="sm" style={{ flex: 1 }}>{it.label}</Text>
                {uploaded[it.id] ? (
                  <CheckCircle2 size={20} color="#10B981" />
                ) : (
                  // NOTE (parity): the web app never opened a real file picker either —
                  // this just flips local state, exactly as before.
                  <Button size="sm" variant="outline" accent={colors.fpo}
                    icon={<Upload size={13} color={colors.fpo} />}
                    onPress={() => { setUploaded((u) => ({ ...u, [it.id]: true })); toast.success(`${it.label} uploaded.`); }}>
                    Upload
                  </Button>
                )}
              </View>
            ))}

            {!assessed ? (
              <Button full accent={colors.fpo} disabled={Object.keys(uploaded).length < 3} onPress={() => setAssessed(true)}>
                Get AI Assessment
              </Button>
            ) : (
              <View style={s.assessBox}>
                <Text size="sm" weight="700" color="#047857" noTranslate>🟢 AI Assessment Complete</Text>
                <Text size="lg" weight="700" style={{ marginTop: spacing.sm }}>Buyer Ready</Text>
                <View style={{ marginTop: spacing.sm }}>
                  <Kv k="Readiness Score" v="91%" />
                  <Kv k="Qualification Probability" v="High" />
                </View>
                <Button full accent={colors.fpo} style={{ marginTop: spacing.md }}
                  icon={<ArrowRight size={16} color="#ffffff" />}
                  onPress={() => toast.success(`Connection request sent to ${buyer}.`)}>
                  {`Connect with ${buyer} Now`}
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function PhaseCard({
  n, title, timeline, invest, action, jump, expected,
}: { n: number; title: string; timeline: string; invest?: string; action: string; jump?: string; expected?: string }) {
  return (
    <View style={s.phase}>
      <View style={s.rowBetween}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <View style={s.phaseNum}>
            <Text size="xxs" weight="700" color={colors.fpoForeground} noTranslate>{String(n)}</Text>
          </View>
          <Text size="sm" weight="700">{`Phase ${n} — ${title}`}</Text>
        </View>
        <Badge color={colors.fpo} bg={colors.fpoSoft}>{timeline}</Badge>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        {invest != null && <Kv k="Invest" v={invest} />}
        <Kv k="Action" v={action} />
        {jump != null && <Kv k="Score Jump" v={jump} />}
        {expected != null && <Kv k="Expected Business" v={expected} />}
      </View>
    </View>
  );
}

export function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kv}>
      <Muted style={{ flex: 1 }}>{k}</Muted>
      <Text size="sm" weight="500" style={{ flex: 1.2, textAlign: "right" }}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 5 },
  calGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  calCell: { width: "22%", borderRadius: radius.sm, paddingVertical: 8, flexGrow: 1 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  investBox: {
    borderWidth: 1, borderColor: "#FCD34D", backgroundColor: "#FFFBEB",
    borderRadius: radius.md, padding: spacing.lg,
  },
  stepper: {
    flexDirection: "row", justifyContent: "space-between", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.background, padding: spacing.md,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gapRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  currentState: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.fpoSoft, padding: spacing.md },
  phase: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md,
  },
  phaseNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.fpo, alignItems: "center", justifyContent: "center" },
  uploadRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  assessBox: {
    borderWidth: 2, borderColor: "#10B981", backgroundColor: "#ECFDF5",
    borderRadius: radius.md, padding: spacing.lg,
  },
  kv: {
    flexDirection: "row", gap: spacing.sm, paddingBottom: 5, marginBottom: 5,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
});
