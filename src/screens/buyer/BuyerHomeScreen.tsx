import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { ClipboardList, Database, Package, Plus } from "lucide-react-native";
import { marketRepo, readinessRepo, requestRepo } from "../../db";
import type { RequirementsUpdate } from "../../db/repositories/readinessRepository";
import { describeWriteError } from "../../db/authz";
import type { RequestRow, ResponseRow } from "../../db/repositories/requestRepository";
import { formatQuantity, parseQuantity } from "../../lib/quantity";
import { useDbQuery } from "../../db/useDbQuery";
import type { Buyer, Supplier } from "../../db/types";
import { useApp } from "../../lib/app-state";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Accordion, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Checkbox, Field, Input, Muted, Select, Text, Toggle, toast,
} from "../../components/ui";
import { ModeToggle, Stepper, useBuyerMode } from "../../features/buyer-shared";
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
    <RoleShell accent="buyer" screenName="Profile & Order" header={<Stepper />}>
      <ModeToggle />
      {mode === "buyer" ? <BuyerView /> : <SupplierView />}
    </RoleShell>
  );
}

function BuyerView() {
  // The buyer record linked to the signed-in account, not simply the first row —
  // a different buyer login (or an admin in the buyer view) loads its own profile.
  const { profileId, session } = useApp();
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
      {showProfile && (
        <BuyerReadinessForm onSaved={() => nav.navigate("BuyerMatching")} />
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
              toast.success(`Demand for ${d.qty_mt} MT ${d.commodity} posted. Matching FPOs…`);
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
  const { session } = useApp();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
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
      toast.success(decision === "accepted" ? `Accepted ${r.responderName}.` : `Declined ${r.responderName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not record that decision."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={s.requirementCard}>
      <View style={s.requirementHead}>
        <View style={{ flex: 1 }}>
          <Text size="sm" weight="600">
            {`${demand.qty} ${demand.unit} · ${demand.item}${demand.grade !== "" ? ` · Grade ${demand.grade}` : ""}`}
          </Text>
          <Muted>
            {`Deliver to ${demand.district}${demand.windowLabel !== "" ? ` by ${demand.windowLabel}` : ""}`}
          </Muted>
        </View>
        {demand.pendingCount > 0 ? (
          <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${demand.pendingCount} to review`}</Badge>
        ) : demand.responseCount > 0 ? (
          <Badge color={colors.mutedForeground} bg={colors.muted}>{`${demand.responseCount} replied`}</Badge>
        ) : (
          <Badge color={colors.mutedForeground} bg={colors.muted}>No replies yet</Badge>
        )}
      </View>

      {demand.responseCount > 0 && (
        <Button variant="ghost" size="sm" accent={colors.buyer}
          style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          onPress={() => setOpen((v) => !v)}>
          {open ? "Hide replies" : `View ${demand.responseCount} ${demand.responseCount === 1 ? "reply" : "replies"}`}
        </Button>
      )}

      {open && responses.map((r) => (
        <View key={r.id} style={s.replyRow}>
          <View style={s.requirementHead}>
            <View style={{ flex: 1 }}>
              <Text size="sm" weight="700">{r.responderName}</Text>
              {r.offeredQty != null && <Muted>{`Offers ${r.offeredQty} MT`}</Muted>}
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

/* ============== Buyer Readiness & Market Qualification ============== */

const COMMODITIES = ["Wheat", "Rice", "Maize", "Soybean", "Onion", "Tomato", "Turmeric", "Cotton", "Sugarcane", "Pulses", "Other"];
const SEASONS = ["Kharif", "Rabi", "Zaid", "Year-round"];
const STATES = ["Maharashtra", "MP", "Gujarat", "Karnataka", "UP", "Punjab", "Haryana", "Rajasthan", "AP", "Telangana", "TN", "WB"];
const CERTS = ["Organic", "Global GAP", "FSSAI", "ISO", "APEDA"];
const INFRA = ["Warehouse", "Cleaning Unit", "Sorting Line", "Grading Machine", "Digital Record Keeping", "Cold Storage", "Testing Facility"];
const COMPLIANCE = ["GST Registration", "FSSAI License", "Producer Company Registration", "Audited Financial Statements", "PAN", "Bank Account", "Insurance"];
const GRADING = ["FAQ", "Grade A", "Grade B", "Custom"];

/**
 * Buyer Readiness & Market Qualification.
 *
 * Around thirty fields, every one of which used to live in `useState` inside a
 * throwaway sub-component — `TextField`, `MultiSelect`, `ToggleRow` each held
 * their own value and the parent never read any of them, so "Save & Find
 * Matching FPOs" navigated and discarded the lot. This is the richest matching
 * signal in the app, and none of it survived the tap.
 *
 * The state is lifted into one object here and saved to `buyer_requirements` and
 * its child tables, which is what lets the matching screen rank FPOs on what this
 * buyer actually asked for.
 */
function BuyerReadinessForm({ onSaved }: { onSaved: () => void }) {
  const { profileId, session } = useApp();
  const saved = useDbQuery<RequirementsUpdate | null>(
    () => (profileId == null ? Promise.resolve(null) : readinessRepo.getBuyerRequirements(profileId)),
    [profileId], null);

  const [form, setForm] = useState<RequirementsUpdate | null>(null);
  const [busy, setBusy] = useState(false);

  // Populated when the saved requirements arrive, so reopening the form shows
  // what was last stated rather than an empty sheet.
  useEffect(() => {
    if (saved != null && form == null) setForm(saved);
  }, [saved, form]);

  if (form == null) {
    return (
      <Card><CardContent style={{ paddingTop: spacing.lg }}>
        <Muted>Loading your requirements…</Muted>
      </CardContent></Card>
    );
  }

  const set = <K extends keyof RequirementsUpdate>(key: K, value: RequirementsUpdate[K]) =>
    setForm((f) => (f == null ? f : { ...f, [key]: value }));

  const toggleIn = (key: "commodities" | "states" | "seasons" | "certifications" | "infrastructure" | "compliance", value: string) =>
    setForm((f) => {
      if (f == null) return f;
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
    });

  async function save() {
    if (form == null || busy) return;
    setBusy(true);
    try {
      await readinessRepo.saveBuyerRequirements(session, form);
      toast.success("Requirements saved. Showing matching FPOs…");
      onSaved();
    } catch (e) {
      toast.error(describeWriteError(e, "Could not save your requirements."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buyer Readiness & Market Qualification</CardTitle>
        <Muted>The more you share, the better we can match you with the right FPO. All fields are optional.</Muted>
      </CardHeader>
      <CardContent>
        <Accordion title="🛒 Procurement Requirements">
          <ChipMulti label="Commodity" options={COMMODITIES}
            selected={form.commodities} onToggle={(v) => toggleIn("commodities", v)} />
          <Field label="Quantity">
            <Input value={form.quantity == null ? "" : String(form.quantity)} keyboardType="numeric"
              placeholder="e.g. 500"
              onChangeText={(t) => set("quantity", t === "" ? null : Number(t) || null)} />
          </Field>
          <Field label="Unit">
            <Select value={form.unit} options={["MT", "Quintal", "Kg"]} onChange={(v) => set("unit", v)} />
          </Field>
          <ChipMulti label="Geography (states / regions)" options={STATES}
            selected={form.states} onToggle={(v) => toggleIn("states", v)} />
          <ChipMulti label="Seasonality" options={SEASONS}
            selected={form.seasons} onToggle={(v) => toggleIn("seasons", v)} />
        </Accordion>

        <Accordion title="✅ Quality Requirements">
          <Field label="Moisture % (max)">
            <Input value={form.moistureMax == null ? "" : String(form.moistureMax)} keyboardType="numeric"
              placeholder="Max 14"
              onChangeText={(t) => set("moistureMax", t === "" ? null : Number(t) || null)} />
          </Field>
          <Field label="Foreign Matter % (max)">
            <Input value={form.foreignMatterMax == null ? "" : String(form.foreignMatterMax)} keyboardType="numeric"
              placeholder="Max 1"
              onChangeText={(t) => set("foreignMatterMax", t === "" ? null : Number(t) || null)} />
          </Field>
          <Field label="Grading Standards">
            <Select value={form.gradingStandard === "" ? GRADING[0] : form.gradingStandard}
              options={GRADING} onChange={(v) => set("gradingStandard", v)} />
          </Field>
          <Field label="Packaging Standards">
            <Input value={form.packagingStandard} multiline numberOfLines={2}
              placeholder="Describe packaging requirements…"
              onChangeText={(t) => set("packagingStandard", t)} />
          </Field>
          <View style={s.toggleBox}>
            <Toggle checked={form.traceabilityRequired} accent={colors.buyer}
              label="Traceability Requirements"
              onChange={(v) => set("traceabilityRequired", v)} />
            {form.traceabilityRequired && (
              <Input value={form.traceabilityNote} placeholder="Describe traceability needs"
                onChangeText={(t) => set("traceabilityNote", t)} />
            )}
          </View>
          <Field label="Residue Limits">
            <Input value={form.residueLimits} multiline numberOfLines={2}
              placeholder="e.g. pesticide residue thresholds (ppm)…"
              onChangeText={(t) => set("residueLimits", t)} />
          </Field>
          <Field label="Certifications Required">
            {CERTS.map((c) => (
              <Checkbox key={c} checked={form.certifications.includes(c)} accent={colors.buyer} label={c}
                onChange={() => toggleIn("certifications", c)} />
            ))}
          </Field>
        </Accordion>

        <Accordion title="🏭 Infrastructure Requirements">
          <Field label="Storage Capacity Required (MT)">
            <Input value={form.storageCapacityRequiredMt == null ? "" : String(form.storageCapacityRequiredMt)}
              keyboardType="numeric" placeholder="e.g. 500"
              onChangeText={(t) => set("storageCapacityRequiredMt", t === "" ? null : Number(t) || null)} />
          </Field>
          {INFRA.map((item) => (
            <View key={item} style={s.toggleBox}>
              <Toggle checked={form.infrastructure.includes(item)} accent={colors.buyer} label={item}
                onChange={() => toggleIn("infrastructure", item)} />
            </View>
          ))}
        </Accordion>

        <Accordion title="📋 Compliance Requirements">
          {COMPLIANCE.map((item) => (
            <View key={item} style={s.toggleBox}>
              <Toggle checked={form.compliance.includes(item)} accent={colors.buyer} label={item}
                onChange={() => toggleIn("compliance", item)} />
            </View>
          ))}
        </Accordion>

        <Button accent={colors.buyer} style={{ alignSelf: "flex-end", marginTop: spacing.md }}
          disabled={busy} onPress={save}>
          {busy ? "Saving…" : "Save & Find Matching FPOs"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** A row of selectable chips backed by the caller's state, not its own. */
function ChipMulti({
  label, options, selected, onToggle,
}: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <Field label={label}>
      <View style={s.multiRow}>
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <Pressable key={o} onPress={() => onToggle(o)}
              accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={[s.multiChip, on && { backgroundColor: colors.buyer, borderColor: colors.buyer }]}>
              <Text size="xs" color={on ? colors.buyerForeground : colors.foreground}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

/* ============== Supplier side ============== */

function SupplierView() {
  // The supplier record linked to the signed-in account. This was `suppliers[0]`
  // — whoever opened the Supplier view edited "Mahabeej Seeds Ltd" regardless of
  // who they were, because supplier was a UI toggle rather than a role.
  const { profileId, session } = useApp();
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
              toast.success(`Supply for ${p.qty} ${p.item} posted. Matching FPOs/farmers…`);
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
              <View key={p.id} style={s.postingRow}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="600">
                    {`${formatQuantity(p.qty, p.unit, p.qtyLabel)} · ${p.item} · ${p.category}`}
                  </Text>
                  <Muted>{`${p.district} · ${p.windowLabel}`}</Muted>
                </View>
                {p.pendingCount > 0 ? (
                  <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${p.pendingCount} to review`}</Badge>
                ) : p.responseCount > 0 ? (
                  <Badge color={colors.mutedForeground} bg={colors.muted}>{`${p.responseCount} replied`}</Badge>
                ) : (
                  <Badge color={colors.mutedForeground} bg={colors.muted}>No replies yet</Badge>
                )}
              </View>
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
  multiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  multiChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background,
  },
  toggleBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: 6,
    backgroundColor: colors.background,
  },
});
