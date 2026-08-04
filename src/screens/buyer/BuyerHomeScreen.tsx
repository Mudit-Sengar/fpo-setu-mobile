import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { ClipboardList, Database, Package, Plus } from "lucide-react-native";
import { BUYERS, SUPPLIERS } from "../../lib/mockData";
import {
  loadDemands, loadSupplies, saveDemands, saveSupplies, type Demand, type SupplyPost,
} from "../../lib/buyer-storage";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Accordion, Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Checkbox, Field, Input, Muted, Select, Text, Toggle, toast,
} from "../../components/ui";
import { ModeToggle, Stepper, type Mode } from "../../features/buyer-shared";
import type { BuyerTabParamList } from "../../navigation/types";

/** Ported from the web app's src/routes/buyer.index.tsx */
export function BuyerHomeScreen() {
  const [mode, setMode] = useState<Mode>("buyer");
  return (
    <RoleShell accent="buyer" screenName="Profile & Order" header={<Stepper />}>
      <ModeToggle mode={mode} setMode={setMode} />
      {mode === "buyer" ? <BuyerView /> : <SupplierView />}
    </RoleShell>
  );
}

function BuyerView() {
  const buyer = BUYERS[0];
  const nav = useNavigation<BottomTabNavigationProp<BuyerTabParamList>>();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [showProfile, setShowProfile] = useState(false);

  const [name, setName] = useState(buyer.name);
  const [type, setType] = useState(buyer.type as string);
  const [commodities, setCommodities] = useState(buyer.commodities.join(", "));
  const [volume, setVolume] = useState(String(buyer.typicalVolumeMT));
  const [location, setLocation] = useState(buyer.location);
  const [specs, setSpecs] = useState(buyer.qualitySpecs);
  const [window, setWindow] = useState(buyer.procurementWindow);

  useEffect(() => { void loadDemands().then(setDemands); }, []);

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
            onPress={() => toast.success("Buyer profile saved.")}>
            Save profile
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
        <BuyerReadinessForm onSave={() => {
          toast.success("Profile saved. Showing matching FPOs…");
          nav.navigate("BuyerMatching");
        }} />
      )}

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <ClipboardList size={16} color={colors.buyer} />
            <CardTitle>Post a demand requirement</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <DemandForm onPost={(d) => {
            const next = [d, ...demands];
            setDemands(next);
            void saveDemands(next);
            toast.success(`Demand for ${d.qty_mt} MT ${d.commodity} posted. Matching FPOs…`);
            nav.navigate("BuyerMatching");
          }} />
        </CardContent>
      </Card>

      {demands.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your open requirements</CardTitle></CardHeader>
          <CardContent>
            {demands.map((d) => (
              <View key={d.id} style={s.postingRow}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="600">{`${d.qty_mt} MT · ${d.commodity} · Grade ${d.grade}`}</Text>
                  <Muted>{`Deliver to ${d.location} by ${d.delivery}`}</Muted>
                </View>
                <Badge color={colors.buyerForeground} bg={colors.buyer}>Matching…</Badge>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ============== Buyer Readiness & Market Qualification ============== */

const COMMODITIES = ["Wheat", "Rice", "Maize", "Soybean", "Onion", "Tomato", "Turmeric", "Cotton", "Sugarcane", "Pulses", "Other"];
const SEASONS = ["Kharif", "Rabi", "Zaid", "Year-round"];
const STATES = ["Maharashtra", "MP", "Gujarat", "Karnataka", "UP", "Punjab", "Haryana", "Rajasthan", "AP", "Telangana", "TN", "WB"];
const CERTS = ["Organic", "Global GAP", "FSSAI", "ISO", "APEDA"];

function BuyerReadinessForm({ onSave }: { onSave: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buyer Readiness & Market Qualification</CardTitle>
        <Muted>The more you share, the better we can match you with the right FPO. All fields are optional.</Muted>
      </CardHeader>
      <CardContent>
        <Accordion title="🛒 Procurement Requirements">
          <MultiSelect label="Commodity" options={COMMODITIES} />
          <TextField label="Quantity" placeholder="e.g. 500" keyboard="numeric" />
          <SelectField label="Unit" options={["MT", "Quintal", "Kg"]} />
          <MultiSelect label="Geography (states / regions)" options={STATES} />
          <MultiSelect label="Seasonality" options={SEASONS} />
        </Accordion>

        <Accordion title="✅ Quality Requirements">
          <TextField label="Moisture %" placeholder="Max 14" keyboard="numeric" />
          <TextField label="Foreign Matter %" placeholder="Max 1" keyboard="numeric" />
          <SelectField label="Grading Standards" options={["FAQ", "Grade A", "Grade B", "Custom"]} />
          <TextField label="Packaging Standards" placeholder="Describe packaging requirements…" multiline />
          <ToggleWithText label="Traceability Requirements" textLabel="Describe traceability needs" />
          <TextField label="Residue Limits" placeholder="e.g. pesticide residue thresholds (ppm)…" multiline />
          <CheckboxGroup label="Certifications Required" options={CERTS} other />
        </Accordion>

        <Accordion title="🏭 Infrastructure Requirements">
          <ToggleWithText label="Warehouse Specifications" textLabel="Specifications" />
          <TextField label="Storage Capacity Required (MT)" placeholder="e.g. 500" keyboard="numeric" />
          {["Cleaning Unit", "Sorting Line", "Grading Machine", "Digital Record Keeping", "Cold Storage", "Testing Facility"].map((l) => (
            <ToggleRow key={l} label={l} />
          ))}
        </Accordion>

        <Accordion title="📋 Compliance Requirements">
          {["GST Registration", "FSSAI License", "Producer Company Registration", "Audited Financial Statements", "PAN", "Bank Account", "Insurance"].map((c) => (
            <ToggleRow key={c} label={c} />
          ))}
        </Accordion>

        <Button accent={colors.buyer} style={{ alignSelf: "flex-end", marginTop: spacing.md }} onPress={onSave}>
          Save & Find Matching FPOs
        </Button>
      </CardContent>
    </Card>
  );
}

function TextField({
  label, placeholder, keyboard, multiline,
}: { label: string; placeholder?: string; keyboard?: "default" | "numeric"; multiline?: boolean }) {
  const [v, setV] = useState("");
  return (
    <Field label={label}>
      <Input value={v} onChangeText={setV} placeholder={placeholder} keyboardType={keyboard} multiline={multiline} numberOfLines={2} />
    </Field>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  const [v, setV] = useState(options[0]);
  return <Field label={label}><Select value={v} options={options} onChange={setV} /></Field>;
}

function MultiSelect({ label, options }: { label: string; options: string[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (o: string) => setSel((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <Field label={label}>
      <View style={s.multiRow}>
        {options.map((o) => {
          const on = sel.includes(o);
          return (
            <Pressable key={o} onPress={() => toggle(o)}
              style={[s.multiChip, on && { backgroundColor: colors.buyer, borderColor: colors.buyer }]}>
              <Text size="xs" color={on ? colors.buyerForeground : colors.foreground}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

function ToggleRow({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return (
    <View style={s.toggleBox}>
      <Toggle checked={on} onChange={setOn} label={label} accent={colors.buyer} />
    </View>
  );
}

function ToggleWithText({ label, textLabel }: { label: string; textLabel: string }) {
  const [on, setOn] = useState(false);
  const [v, setV] = useState("");
  return (
    <View style={s.toggleBox}>
      <Toggle checked={on} onChange={setOn} label={label} accent={colors.buyer} />
      {on && <Input value={v} onChangeText={setV} placeholder={textLabel} />}
    </View>
  );
}

function CheckboxGroup({ label, options, other }: { label: string; options: string[]; other?: boolean }) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [otherText, setOtherText] = useState("");
  return (
    <Field label={label}>
      {options.map((o) => (
        <Checkbox key={o} checked={!!sel[o]} accent={colors.buyer} label={o}
          onChange={(v) => setSel((p) => ({ ...p, [o]: v }))} />
      ))}
      {other && (
        <>
          <Checkbox checked={!!sel.__other} accent={colors.buyer} label="Other"
            onChange={(v) => setSel((p) => ({ ...p, __other: v }))} />
          {sel.__other && <Input value={otherText} onChangeText={setOtherText} placeholder="Specify…" />}
        </>
      )}
    </Field>
  );
}

/* ============== Supplier side ============== */

function SupplierView() {
  const sup = SUPPLIERS[0];
  const nav = useNavigation<BottomTabNavigationProp<BuyerTabParamList>>();
  const [supplies, setSupplies] = useState<SupplyPost[]>([]);

  const [name, setName] = useState(`${sup.name} (${sup.brand})`);
  const [cats, setCats] = useState(sup.categories.join(", "));
  const [products, setProducts] = useState(sup.products);
  const [price, setPrice] = useState(sup.priceRange);
  const [certs, setCerts] = useState(sup.certifications);
  const [regions, setRegions] = useState(sup.regions);
  const [moq, setMoq] = useState(sup.minOrder);
  const [lead, setLead] = useState(String(sup.leadTimeDays));
  const [seasons, setSeasons] = useState(sup.seasons);

  useEffect(() => { void loadSupplies().then(setSupplies); }, []);

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
          <Field label="Company / brand name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Product categories"><Input value={cats} onChangeText={setCats} /></Field>
          <Field label="Products & pack sizes"><Input value={products} onChangeText={setProducts} multiline numberOfLines={2} /></Field>
          <Field label="Price list / range"><Input value={price} onChangeText={setPrice} /></Field>
          <Field label="Certifications / licences"><Input value={certs} onChangeText={setCerts} /></Field>
          <Field label="Supply regions"><Input value={regions} onChangeText={setRegions} /></Field>
          <Field label="Min order quantity"><Input value={moq} onChangeText={setMoq} /></Field>
          <Field label="Delivery lead time (days)"><Input value={lead} onChangeText={setLead} keyboardType="numeric" /></Field>
          <Field label="Seasonal availability"><Input value={seasons} onChangeText={setSeasons} /></Field>
          <Button accent={colors.buyer} style={{ alignSelf: "flex-end" }}
            onPress={() => toast.success("Supplier profile saved.")}>
            Save supplier profile
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
          <SupplyForm onPost={(p) => {
            const next = [p, ...supplies];
            setSupplies(next);
            void saveSupplies(next);
            toast.success(`Supply for ${p.qty} ${p.item} posted. Matching FPOs/farmers…`);
            nav.navigate("BuyerMatching");
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
                  <Text size="sm" weight="600">{`${p.qty} · ${p.item} · ${p.category}`}</Text>
                  <Muted>{`${p.region} · ${p.window} · ${p.pricePerUnit}`}</Muted>
                </View>
                <Badge color={colors.buyerForeground} bg={colors.buyer}>Matching…</Badge>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SupplyForm({ onPost }: { onPost: (p: SupplyPost) => void }) {
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
        onPress={() => onPost({ id: String(Date.now()), item, category: cat, qty, pricePerUnit: price, region, window: win })}>
        Post & match
      </Button>
    </>
  );
}

function DemandForm({ onPost }: { onPost: (d: Demand) => void }) {
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
        onPress={() => onPost({ id: String(Date.now()), commodity, qty_mt: Number(qty) || 0, grade, delivery, location })}>
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
