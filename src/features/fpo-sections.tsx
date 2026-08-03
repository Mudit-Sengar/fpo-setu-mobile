// Reusable FPO content sections — ported from the web app's
// src/components/fpo-sections.tsx. Each export renders the content for one chip;
// the parent screen shows the chips and renders the chosen section.
import React, { useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import {
  AlertTriangle, Banknote, BookOpenCheck, Building2, CalendarDays, CheckCircle2,
  ChevronRight, FileCheck, GraduationCap, Handshake, LandPlot, Landmark, Mail,
  MessageCircle, Package, Phone, Plus, Send, ShieldCheck, Sparkles, Star, Target,
  Truck, Users, Users2, Volume2, XCircle,
} from "lucide-react-native";
import { useApp } from "../lib/app-state";
import {
  BUYERS, COMPLIANCE_EXPLAINER, COMPLIANCE_PARTNERS, EXPERTS, FPOS, FPO_MEETINGS,
  GOVT_SCHEMES, INPUT_NEEDS, LEDGER, LENDERS, LOGISTICS_PROVIDERS, MEMBER_ENGAGEMENT,
  MENTORS, MGMT_COURSES, SELLER_FEEDBACK, SUPPLIERS, TIER_SCORES, VALUE_COURSES,
  buyersByCategory, cumulativeFor, fpoById, isSchemeEligible, tierOpportunities,
  type FpoMeeting, type FPOSupply, type InputNeed, type LedgerEntry, type OpportunityDetail,
} from "../lib/mockData";
import { useSpeech } from "../hooks/useSpeech";
import { colors, radius, spacing } from "../theme";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Chip, ChipRow,
  Dialog, Field, Gauge, Input, Muted, Progress, Select, Table, Text, toast,
} from "../components/ui";
import { CourseCard, EmptyHint, Segmented } from "../components/common";
import { BarChart } from "../components/charts";
import { MarketLinkedGrowthPlanning, Kv } from "./market-readiness";

const inr = (n: number) => n.toLocaleString("en-IN");

/* ========= MANAGE & GROW ========= */

export function PostRequestSection() {
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const [supply, setSupply] = useState<FPOSupply[]>(fpo.supply);
  const [needs, setNeeds] = useState<InputNeed[]>(INPUT_NEEDS);

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Commodity supply request" />
        </CardHeader>
        <CardContent>
          <Muted style={{ marginBottom: spacing.sm }}>What your FPO can supply — matched with buyers.</Muted>
          <Table
            minWidth={400}
            columns={[
              { key: "commodity", label: "Commodity", flex: 1.3 },
              { key: "grade", label: "Grade" },
              { key: "qty", label: "Qty (MT)", align: "right" },
              { key: "window", label: "Harvest window", flex: 1.4 },
            ]}
            rows={supply.map((x) => ({ commodity: x.commodity, grade: x.grade, qty: String(x.qty_mt), window: x.harvest_window }))}
          />
          <AddCommodityForm onAdd={(x) => { setSupply((p) => [...p, x]); toast.success(`${x.commodity} added.`); }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Inputs requirement request" />
        </CardHeader>
        <CardContent>
          <Muted style={{ marginBottom: spacing.sm }}>
            Inputs the FPO needs to procure for its members — matched with suppliers.
          </Muted>
          <Table
            minWidth={480}
            columns={[
              { key: "item", label: "Item", flex: 1.6 },
              { key: "category", label: "Category" },
              { key: "qty", label: "Qty" },
              { key: "window", label: "Window" },
              { key: "notes", label: "Notes" },
            ]}
            rows={needs.map((n) => ({ item: n.item, category: n.category, qty: n.qty, window: n.window, notes: n.notes ?? "—" }))}
          />
          <AddNeedForm onAdd={(n) => { setNeeds((p) => [...p, n]); toast.success(`${n.item} added to inputs needed.`); }} />
        </CardContent>
      </Card>
    </>
  );
}

export function MeetingSection() {
  const { activeFpoId } = useApp();
  const cum = cumulativeFor(activeFpoId);
  const [meetings, setMeetings] = useState<FpoMeeting[]>(FPO_MEETINGS);

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<CalendarDays size={16} color={colors.fpo} />} title="FPO Meetings" />
      </CardHeader>
      <CardContent>
        <Table
          minWidth={470}
          columns={[
            { key: "date", label: "Date" },
            { key: "time", label: "Time", flex: 0.6 },
            { key: "agenda", label: "Agenda", flex: 2 },
            { key: "venue", label: "Venue", flex: 1.3 },
          ]}
          rows={meetings.map((m) => ({ date: m.date, time: m.time, agenda: m.agenda, venue: m.venue }))}
        />
        <AddMeetingForm onAdd={(m) => setMeetings((p) => [m, ...p])} memberCount={cum.totalMembers} />
      </CardContent>
    </Card>
  );
}

export function BookkeepingSection() {
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const [ledger, setLedger] = useState<LedgerEntry[]>(LEDGER);

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<BookOpenCheck size={16} color={colors.fpo} />} title="Digital bookkeeping" />
        <View style={{ marginTop: spacing.sm }}>
          <Gauge value={fpo.complianceScore} label="Compliance health" />
        </View>
      </CardHeader>
      <CardContent>
        <Table
          minWidth={620}
          columns={[
            { key: "date", label: "Date" },
            { key: "desc", label: "Description", flex: 2 },
            { key: "type", label: "Type", flex: 0.8 },
            { key: "cp", label: "Buyer / Seller ID", flex: 1.4 },
            { key: "amount", label: "Amount ₹", align: "right" },
            { key: "balance", label: "Balance ₹", align: "right" },
          ]}
          rows={ledger.map((e) => ({
            date: e.date,
            desc: (
              <View>
                <Text size="xs">{e.desc}</Text>
                {e.refId != null && <Text size="xxs" color={colors.mutedForeground} noTranslate>{`Ref ${e.refId}`}</Text>}
              </View>
            ),
            type: e.type === "Income"
              ? <Badge color="#ffffff" bg={colors.farmer}>Income</Badge>
              : <Badge color={colors.mutedForeground} bg={colors.muted}>Expense</Badge>,
            cp: <Text size="xxs" noTranslate>{e.counterpartyId ?? "—"}</Text>,
            amount: inr(e.amount),
            balance: inr(e.balance),
          }))}
        />
        <Muted style={{ marginTop: spacing.sm }}>
          Buyer/Seller IDs link transactions across the app — e.g. MH-AH-2024-00831 appears in farmer Suresh Patil's transaction history.
        </Muted>
        <AddEntry
          onAdd={(entry) => { setLedger((p) => [...p, entry]); toast.success("Ledger entry added."); }}
          running={ledger[ledger.length - 1].balance}
        />
      </CardContent>
    </Card>
  );
}

export function ExpansionPlannerSection() {
  const [tab, setTab] = useState<"sizing" | "growth">("sizing");
  return (
    <>
      <Segmented
        options={["sizing", "growth"] as const}
        value={tab}
        onChange={setTab}
        accent={colors.fpo}
        labelOf={(v) => (v === "sizing" ? "Opportunity Sizing" : "Market-Linked Growth Planning")}
      />
      {tab === "sizing" ? <OpportunitySizingPanel /> : <MarketLinkedGrowthPlanning />}
    </>
  );
}

function OpportunitySizingPanel() {
  const { activeFpoId } = useApp();
  const { speak } = useSpeech();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const scores = TIER_SCORES[fpo.tier];
  const opportunities = tierOpportunities(fpo.tier);
  const [openOpp, setOpenOpp] = useState<OpportunityDetail | null>(null);
  const [openMentor, setOpenMentor] = useState<string | null>(null);
  const [mentorMsg, setMentorMsg] = useState("");

  const mentor = MENTORS.find((x) => x.name === openMentor);

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
          <Badge color={colors.fpoForeground} bg={colors.fpo}>{fpo.tier}</Badge>
          <Muted>5 dimensions</Muted>
        </View>

        {Object.entries(scores).map(([k, v]) => (
          <View key={k} style={{ marginBottom: spacing.md }}>
            <View style={s.rowBetween}>
              <Text size="xs" style={{ textTransform: "capitalize" }}>{k}</Text>
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
              <Text size="xxs" weight="700" color={colors.fpo}>{`Opportunity · ${o.label}`}</Text>
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
        title={openOpp ? `Opportunity · ${openOpp.label}` : undefined}>
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
              onPress={() => speak(`${openOpp.label} opportunity. ${openOpp.action}`)}>
              Listen
            </Button>

            <Text size="sm" weight="700" style={{ marginTop: spacing.sm }}>Scrutinise with an Expert</Text>
            {MENTORS.map((m) => (
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
              onPress={() => { toast.success(`Message sent to ${mentor.name}.`); setOpenMentor(null); }}>
              Send message
            </Button>
          </>
        )}
      </Dialog>
    </Card>
  );
}

/* ========= FIND PARTNERS ========= */

export function LocateBuyerSection() {
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const groups = buyersByCategory();
  const score = (i: number) => 92 - i * 6;

  return (
    <>
      {(["Spot", "Relationship", "Development"] as const).map((cat) => {
        const list = groups[cat].filter((b) => b.commodities.some((c) => fpo.commodities.includes(c)));
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
              {list.map((b, i) => (
                <View key={b.id} style={s.itemCard}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text size="sm" weight="700">{b.name}</Text>
                      <Muted>{`${b.type} · ${b.location}`}</Muted>
                    </View>
                    <Badge color={colors.fpoForeground} bg={colors.fpo}>{`${score(i)}% match`}</Badge>
                  </View>
                  <Muted style={{ marginTop: spacing.sm }}>
                    {"Commodity: "}
                    <Text size="xs">{b.commodities.find((c) => fpo.commodities.includes(c)) ?? b.commodities[0]}</Text>
                    {" · Volume: "}
                    <Text size="xs">{`${b.typicalVolumeMT} MT/yr`}</Text>
                  </Muted>
                  <Button size="sm" accent={colors.fpo} style={{ marginTop: spacing.md }}
                    onPress={() => toast.success(`Connection request sent to ${b.name}.`)}>
                    Connect
                  </Button>
                </View>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

export function LocateSupplierSection() {
  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<Package size={16} color={colors.fpo} />} title="Matched input suppliers" />
      </CardHeader>
      <CardContent>
        {SUPPLIERS.map((sup, i) => (
          <View key={sup.id} style={s.itemCard}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{sup.name}</Text>
                <Muted>{`${sup.brand} · ${sup.location}`}</Muted>
              </View>
              <Badge color={colors.fpoForeground} bg={colors.fpo}>{`${92 - i * 5}% match`}</Badge>
            </View>
            <View style={{ marginTop: spacing.sm, gap: 2 }}>
              <Muted>{"Category: "}<Text size="xs">{sup.categories.join(", ")}</Text></Muted>
              <Muted>{"Products: "}<Text size="xs">{sup.products}</Text></Muted>
              <Muted>{"Price: "}<Text size="xs">{sup.priceRange}</Text></Muted>
              <Muted>{"Lead time: "}<Text size="xs">{`${sup.leadTimeDays} days · MOQ ${sup.minOrder}`}</Text></Muted>
            </View>
            <Button size="sm" accent={colors.fpo} style={{ marginTop: spacing.md }}
              onPress={() => toast.success(`Quote requested from ${sup.name}.`)}>
              Connect
            </Button>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export function LogisticsSection() {
  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<Truck size={16} color={colors.fpo} />} title="Logistics service providers" />
      </CardHeader>
      <CardContent>
        {LOGISTICS_PROVIDERS.map((p) => (
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
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const [openProposal, setOpenProposal] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Banknote size={16} color={colors.fpo} />} title="Credit Facilitation" />
        </CardHeader>
        <CardContent>
          {LENDERS.map((l) => (
            <View key={l.name} style={s.itemCard}>
              <Text size="sm" weight="700">{l.name}</Text>
              <Muted>{l.product}</Muted>
              <View style={{ flexDirection: "row", marginTop: 6 }}>
                <Badge color={colors.mutedForeground} bg={colors.muted}>{l.eligibility}</Badge>
              </View>
              <Button size="sm" variant="outline" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                onPress={() => toast.success(`Application initiated with ${l.name}.`)}>
                Apply
              </Button>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <TitleWithIcon icon={<FileCheck size={16} color={colors.fpo} />} title="Generate a Bankable Proposal" />
        </CardHeader>
        <CardContent>
          <Button accent={colors.fpo} onPress={() => setOpenProposal(true)}>Generate bankable proposal</Button>
        </CardContent>
      </Card>

      <Dialog visible={openProposal} onClose={() => setOpenProposal(false)}
        title={`Bankable Loan Proposal — ${fpo.name}`}>
        <Kv k="Requested amount" v="₹48,00,000" />
        <Kv k="Purpose" v="Working capital for kharif aggregation" />
        <Kv k="Projected revenue uplift" v="₹1.6 Cr / season (+22%)" />
        <Kv k="Compliance score" v={`${fpo.complianceScore}/100`} />
        <Kv k="Repayment" v="12 months · seasonal bullet" />
        <Button accent={colors.fpo}
          onPress={() => { toast.success("Proposal shared with NABARD & Samunnati."); setOpenProposal(false); }}>
          Share with lenders
        </Button>
      </Dialog>
    </>
  );
}

export function GovtSchemesSection() {
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const [body, setBody] = useState<"all" | "Central" | "State (Maharashtra)">("all");
  const schemes = GOVT_SCHEMES.filter((x) => body === "all" || x.body === body);

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<Landmark size={16} color={colors.fpo} />} title="Government Schemes" />
        <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
          <Segmented
            options={["all", "Central", "State (Maharashtra)"] as const}
            value={body}
            onChange={setBody}
            accent={colors.fpo}
            labelOf={(b) => (b === "all" ? "All" : b === "Central" ? "Central" : "State")}
          />
        </View>
      </CardHeader>
      <CardContent>
        {schemes.map((sch) => {
          // Real business rule preserved from mockData.isSchemeEligible().
          const eligible = isSchemeEligible(sch, fpo);
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
            </View>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ComplianceSection() {
  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<ShieldCheck size={16} color={colors.fpo} />} title="Compliances required for an FPO" />
        </CardHeader>
        <CardContent>
          {COMPLIANCE_EXPLAINER.map((c) => (
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
          {COMPLIANCE_PARTNERS.map((p) => (
            <View key={p.name} style={s.itemCard}>
              <Text size="sm" weight="600">{p.name}</Text>
              <Muted>{p.svc}</Muted>
              <View style={{ flexDirection: "row", marginTop: 6 }}>
                <Badge color={colors.fpo} bg={colors.fpoSoft}>{p.fee}</Badge>
              </View>
              <Button full size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
                onPress={() => toast.success(`Service requested from ${p.name}.`)}>
                Request service
              </Button>
            </View>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

/* ========= LEARN & EXPERT ========= */

export function CapacityBuildingSection() {
  const [tab, setTab] = useState<null | "value" | "mgmt">(null);
  return (
    <>
      <ChipRow>
        <Chip label="Value Addition Hub" accent={colors.fpo} active={tab === "value"}
          onPress={() => setTab(tab === "value" ? null : "value")} />
        <Chip label="Professional Management Courses" accent={colors.fpo} active={tab === "mgmt"}
          onPress={() => setTab(tab === "mgmt" ? null : "mgmt")} />
      </ChipRow>

      {tab === null && <EmptyHint>Tap an option above.</EmptyHint>}

      {tab === "value" && (
        <Card>
          <CardHeader><CardTitle>Value Addition Hub</CardTitle></CardHeader>
          <CardContent>
            <View style={{ gap: spacing.md }}>
              {VALUE_COURSES.map((c) => (
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
              {MGMT_COURSES.map((c) => (
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
  const [openExpert, setOpenExpert] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const expert = EXPERTS.find((e) => e.name === openExpert);

  return (
    <Card>
      <CardHeader>
        <TitleWithIcon icon={<MessageCircle size={16} color={colors.fpo} />} title="Expert network & testimonials" />
      </CardHeader>
      <CardContent>
        {EXPERTS.map((t) => (
          <View key={t.name} style={s.itemCard}>
            <Text size="sm" weight="600">{t.name}</Text>
            <Muted>{t.role}</Muted>
            <Text size="sm" style={{ marginTop: spacing.sm }}>{`"${t.note}"`}</Text>
            <Button full size="sm" accent={colors.fpo} style={{ marginTop: spacing.sm }}
              onPress={() => { setOpenExpert(t.name); setMsg(`Namaste ${t.name.split(" ")[0]}, we'd love your guidance on…`); }}>
              Connect
            </Button>
          </View>
        ))}
      </CardContent>

      <Dialog visible={openExpert != null} onClose={() => setOpenExpert(null)}
        title={expert ? `Connect with ${expert.name}` : undefined}>
        {expert != null && (
          <>
            <View style={s.contactBox}>
              <Muted>{expert.role}</Muted>
              <View style={s.contactRow}><Phone size={16} color={colors.fpo} /><Text size="sm" noTranslate>{expert.phone}</Text></View>
              <View style={s.contactRow}><Mail size={16} color={colors.fpo} /><Text size="sm" noTranslate>{expert.email}</Text></View>
            </View>
            <Input value={msg} onChangeText={setMsg} multiline numberOfLines={3} />
            <Button accent={colors.fpo} icon={<Send size={16} color="#ffffff" />}
              onPress={() => { toast.success(`Message sent to ${expert.name}.`); setOpenExpert(null); }}>
              Send message
            </Button>
          </>
        )}
      </Dialog>
    </Card>
  );
}

/* ========= KNOW MY FPO ========= */

export function FpoProfileSection() {
  const { activeFpoId } = useApp();
  const { width } = useWindowDimensions();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];
  const cum = cumulativeFor(fpo.id);
  const chartW = width - spacing.lg * 4;

  const [name, setName] = useState(fpo.name);
  const [regNo, setRegNo] = useState(fpo.regNo);
  const [district, setDistrict] = useState(`${fpo.district} / ${fpo.block}`);
  const [inc, setInc] = useState(fpo.incorporated);
  const [warehouse, setWarehouse] = useState(String(fpo.warehouseMT));
  const [processing, setProcessing] = useState(fpo.processing.has ? fpo.processing.type! : "None");

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Building2 size={16} color={colors.fpo} />
              <CardTitle>FPO Details</CardTitle>
            </View>
            <Badge color={colors.fpoForeground} bg={colors.fpo}>{fpo.tier}</Badge>
          </View>
        </CardHeader>
        <CardContent>
          <Field label="Name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Registration No."><Input value={regNo} onChangeText={setRegNo} /></Field>
          <Field label="District / Block"><Input value={district} onChangeText={setDistrict} /></Field>
          <Field label="Incorporated"><Input value={inc} onChangeText={setInc} /></Field>
          <Field label="Warehouse capacity (MT)"><Input value={warehouse} onChangeText={setWarehouse} keyboardType="numeric" /></Field>
          <Field label="Processing capability"><Input value={processing} onChangeText={setProcessing} /></Field>
          <Button accent={colors.fpo} style={{ alignSelf: "flex-end" }}
            onPress={() => toast.success("FPO details saved.")}>
            Save
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
  const { activeFpoId } = useApp();
  const cum = cumulativeFor(activeFpoId);
  // Business logic preserved verbatim from the web app.
  const procurable = MEMBER_ENGAGEMENT.filter((m) => m.status === "Active").reduce((a, m) => a + m.soldThroughFPO * 1.6, 0);
  const [filters, setFilters] = useState<Record<Status, boolean>>({ "Active": true, "At-risk": true, "Dormant": true });
  const filtered = useMemo(() => MEMBER_ENGAGEMENT.filter((m) => filters[m.status]), [filters]);

  return (
    <>
      <Card>
        <CardHeader>
          <TitleWithIcon icon={<Star size={16} color={colors.fpo} />} title="Seller feedback (from buyers)" />
        </CardHeader>
        <CardContent>
          <Table
            minWidth={560}
            columns={[
              { key: "buyer", label: "Buyer", flex: 1.6 },
              { key: "commodity", label: "Commodity" },
              { key: "qty", label: "Qty (MT)", align: "right" },
              { key: "date", label: "Date", flex: 1.2 },
              { key: "rating", label: "Rating" },
              { key: "note", label: "Note", flex: 1.8 },
            ]}
            rows={SELLER_FEEDBACK.map((f) => ({
              buyer: f.buyer, commodity: f.commodity, qty: String(f.qty_mt), date: f.date,
              rating: <Text size="xs" noTranslate>{"★".repeat(f.stars) + "☆".repeat(5 - f.stars)}</Text>,
              note: <Muted>{f.note}</Muted>,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Users size={16} color={colors.fpo} />
              <CardTitle>Farmer engagement</CardTitle>
            </View>
            <Badge color={colors.fpo} bg={colors.fpoSoft}>{`${cum.totalMembers} on roll`}</Badge>
          </View>
        </CardHeader>
        <CardContent>
          <View style={s.noteBox}>
            <Text size="sm">
              <Text size="sm" weight="700">
                {`Procurable estimate this season from active members: ~${Math.round(procurable)} MT.`}
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
            <Muted>{`${filtered.length} shown`}</Muted>
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
              { key: "action", label: "", flex: 1.2 },
            ]}
            rows={filtered.map((m) => ({
              name: m.name,
              village: m.village,
              status: <StatusChip s={m.status} />,
              sold: String(m.soldThroughFPO),
              trainings: String(m.trainings),
              last: m.lastTxn,
              action: m.status !== "Active" ? (
                <Button size="sm" variant="outline" accent={colors.fpo}
                  icon={<AlertTriangle size={11} color={colors.fpo} />}
                  onPress={() => toast.success(`Outreach scheduled for ${m.name}.`)}>
                  Intervene
                </Button>
              ) : <Text size="xs"> </Text>,
            }))}
          />
        </CardContent>
      </Card>
    </>
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

function AddNeedForm({ onAdd }: { onAdd: (n: InputNeed) => void }) {
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

function AddMeetingForm({ onAdd, memberCount }: { onAdd: (m: FpoMeeting) => void; memberCount: number }) {
  const [date, setDate] = useState(""); const [time, setTime] = useState("");
  const [agenda, setAgenda] = useState(""); const [venue, setVenue] = useState("");
  return (
    <View style={s.form}>
      <Field label="Date"><Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></Field>
      <Field label="Time"><Input value={time} onChangeText={setTime} placeholder="10:00" /></Field>
      <Field label="Agenda"><Input value={agenda} onChangeText={setAgenda} placeholder="Agenda" /></Field>
      <Field label="Venue"><Input value={venue} onChangeText={setVenue} placeholder="Venue" /></Field>
      <Button full accent={colors.fpo} icon={<Plus size={16} color="#ffffff" />}
        onPress={() => {
          if (!date || !agenda) return;
          onAdd({ date, time: time || "10:00", agenda, venue: venue || "FPO office" });
          setDate(""); setTime(""); setAgenda(""); setVenue("");
          toast.success("Meeting logged.");
        }}>
        Log meeting
      </Button>
      <Button full variant="outline" accent={colors.fpo} style={{ marginTop: spacing.sm }}
        icon={<Send size={16} color={colors.fpo} />}
        onPress={() => toast.success(`Meeting notification sent to ${memberCount} member farmers.`)}>
        Send notification to all members
      </Button>
    </View>
  );
}

function AddEntry({ onAdd, running }: { onAdd: (e: LedgerEntry) => void; running: number }) {
  const [desc, setDesc] = useState(""); const [amt, setAmt] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Income"); const [cp, setCp] = useState("");
  return (
    <View style={s.form}>
      <Field label="Description"><Input value={desc} onChangeText={setDesc} placeholder="Description" /></Field>
      <Field label="Type"><Select value={type} options={["Income", "Expense"] as const} onChange={setType} /></Field>
      <Field label="Buyer/Seller ID"><Input value={cp} onChangeText={setCp} placeholder="Buyer/Seller ID" /></Field>
      <Field label="Amount ₹"><Input value={amt} onChangeText={setAmt} placeholder="Amount ₹" keyboardType="numeric" /></Field>
      <Button full accent={colors.fpo}
        onPress={() => {
          const amount = Number(amt);
          if (!desc || !amount) return;
          // Running-balance computation preserved from the web app.
          const newBal = type === "Income" ? running + amount : running - amount;
          onAdd({ date: new Date().toISOString().slice(0, 10), desc, type, amount, balance: newBal, counterpartyId: cp || undefined });
          setDesc(""); setAmt(""); setCp("");
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
