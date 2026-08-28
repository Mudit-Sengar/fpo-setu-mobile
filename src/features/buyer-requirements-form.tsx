import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { readinessRepo } from "../db";
import { describeWriteError } from "../db/authz";
import type { RequirementsUpdate } from "../db/repositories/readinessRepository";
import { useDbQuery } from "../db/useDbQuery";
import { colors, radius, spacing } from "../theme";
import {
  Accordion, Button, Card, CardContent, CardHeader, CardTitle,
  Checkbox, Field, Input, Muted, Select, Text, Toggle, toast,
} from "../components/ui";

/**
 * The Buyer Readiness & Market Qualification form.
 *
 * Originally lived inside BuyerHomeScreen.tsx, hard-wired to the signed-in
 * buyer's own session. Pulled out and parameterised on `buyerId` + `onSave` so
 * the same form — and the same `buyer_requirements` write underneath it — can
 * also open from the Admin screen for a buyer that has no login of its own yet.
 * A buyer never edits a requirement through duplicated UI: there is one form,
 * one write path, two callers.
 */

const COMMODITIES = ["Wheat", "Rice", "Maize", "Soybean", "Onion", "Tomato", "Turmeric", "Cotton", "Sugarcane", "Pulses", "Other"];
const SEASONS = ["Kharif", "Rabi", "Zaid", "Year-round"];
const STATES = ["Maharashtra", "MP", "Gujarat", "Karnataka", "UP", "Punjab", "Haryana", "Rajasthan", "AP", "Telangana", "TN", "WB"];
const CERTS = ["Organic", "Global GAP", "FSSAI", "ISO", "APEDA"];
const INFRA = ["Warehouse", "Cleaning Unit", "Sorting Line", "Grading Machine", "Digital Record Keeping", "Cold Storage", "Testing Facility"];
const COMPLIANCE = ["GST Registration", "FSSAI License", "Producer Company Registration", "Audited Financial Statements", "PAN", "Bank Account", "Insurance"];
const GRADING = ["FAQ", "Grade A", "Grade B", "Custom"];

export interface BuyerReadinessFormProps {
  /** Buyer the requirements belong to — the signed-in buyer, or one an admin picked. */
  buyerId: string;
  /** Where the write actually lands: the buyer's own session, or an admin edit. */
  onSave: (input: RequirementsUpdate) => Promise<void>;
  onSaved: () => void;
  saveLabel?: string;
  successMessage?: string;
}

export function BuyerReadinessForm({
  buyerId, onSave, onSaved,
  saveLabel = "Save requirements", successMessage = "Requirements saved.",
}: BuyerReadinessFormProps) {
  const saved = useDbQuery<RequirementsUpdate | null>(
    () => readinessRepo.getBuyerRequirements(buyerId), [buyerId], null);

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
        <Muted>Loading requirements…</Muted>
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
      await onSave(form);
      toast.success(successMessage);
      onSaved();
    } catch (e) {
      toast.error(describeWriteError(e, "Could not save those requirements."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buyer Readiness & Market Qualification</CardTitle>
        <Muted>The more that is shared here, the better an FPO can be matched against it. All fields are optional.</Muted>
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
          {busy ? "Saving…" : saveLabel}
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

const s = StyleSheet.create({
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
