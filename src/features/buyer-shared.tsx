import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme";
import { Card, CardContent, Muted, Text } from "../components/ui";

export type Mode = "buyer" | "supplier";

/**
 * Ported from the web app's exported ModeToggle in buyer.index.tsx — reused by
 * all three buyer screens exactly as the web version was.
 */
export function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <Card style={{ borderColor: colors.buyer + "4D", backgroundColor: colors.buyerSoft }}>
      <CardContent style={{ paddingTop: spacing.lg }}>
        <Muted style={{ marginBottom: spacing.sm }}>I am a</Muted>
        {(["buyer", "supplier"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={s.radioRow}>
            <View style={[s.radio, mode === m && { borderColor: colors.buyer }]}>
              {mode === m && <View style={s.radioDot} />}
            </View>
            <Text size="sm" weight="500" color={mode === m ? colors.buyer : colors.foreground} style={{ flex: 1 }}>
              {m === "buyer" ? "Buyer (purchase commodities)" : "Supplier (sell inputs to FPOs)"}
            </Text>
          </Pressable>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Ported from the web app's buyer.tsx header Stepper. Purely decorative there
 * (not wired to actual step completion) — same here.
 */
export function Stepper() {
  const steps = ["Onboarding", "Connect with Farmer or FPO", "Reviews & Feedback"];
  return (
    <View style={s.stepper}>
      {steps.map((st, i) => (
        <View key={st} style={s.stepItem}>
          <View style={s.stepNum}>
            <Text size="xxs" weight="700" color={colors.buyerForeground} noTranslate>{String(i + 1)}</Text>
          </View>
          <Text size="xxs" weight="500" color={colors.buyer} numberOfLines={2} style={{ flex: 1 }}>{st}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  radioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.buyer },
  stepper: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  stepNum: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.buyer,
    alignItems: "center", justifyContent: "center",
  },
});
