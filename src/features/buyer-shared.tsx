import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useApp } from "../lib/app-state";
import { colors, spacing } from "../theme";
import { Card, CardContent, Muted, Text } from "../components/ui";

export type Mode = "buyer" | "supplier";

/**
 * Which half of the marketplace this session is acting as.
 *
 * This used to be `useState<Mode>("buyer")` in each of the three buyer screens,
 * which meant any account could flip to the Supplier view and edit whichever
 * supplier row sorted first. It now follows the signed-in role: a buyer login is
 * a buyer, a supplier login is a supplier.
 *
 * An admin holds both roles, so for them switching mode switches the session's
 * active role rather than a local flag — one source of truth, and the profile
 * (and therefore the record being edited) changes with it.
 */
export function useBuyerMode(): { mode: Mode; setMode: (m: Mode) => void; canSwitch: boolean } {
  const { role, session, switchRole } = useApp();
  const viewable = session?.viewableRoles ?? [];
  const canSwitch = viewable.includes("buyer") && viewable.includes("supplier");
  return {
    mode: role === "supplier" ? "supplier" : "buyer",
    setMode: (m: Mode) => { if (canSwitch) void switchRole(m); },
    canSwitch,
  };
}

/**
 * Ported from the web app's exported ModeToggle in buyer.index.tsx.
 *
 * Renders only for a session that genuinely holds both roles. For a plain buyer
 * or supplier login the mode is not a choice, so showing a control that cannot
 * change anything would be a lie.
 */
export function ModeToggle() {
  const { mode, setMode, canSwitch } = useBuyerMode();
  if (!canSwitch) return null;

  return (
    <Card style={{ borderColor: colors.buyer + "4D", backgroundColor: colors.buyerSoft }}>
      <CardContent style={{ paddingTop: spacing.lg }}>
        <Muted style={{ marginBottom: spacing.sm }}>I am a</Muted>
        {(["buyer", "supplier"] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            style={s.radioRow}
          >
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

const s = StyleSheet.create({
  radioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.buyer },
});
