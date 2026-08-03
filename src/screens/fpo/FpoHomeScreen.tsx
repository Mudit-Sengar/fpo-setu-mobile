import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Briefcase, Building2, GraduationCap, Network } from "lucide-react-native";
import { useApp } from "../../lib/app-state";
import { FPOS, fpoById } from "../../lib/mockData";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Muted, Text } from "../../components/ui";
import type { FpoStackParamList } from "../../navigation/types";

/** Ported from the web app's src/routes/fpo.index.tsx (FPO Bandhu home) */
export function FpoHomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<FpoStackParamList>>();
  const { activeFpoId } = useApp();
  const fpo = fpoById(activeFpoId) ?? FPOS[0];

  const GROUPS = [
    { to: "FpoManage" as const, title: "Manage & Grow Business", icon: <Briefcase size={24} color={colors.fpoForeground} /> },
    { to: "FpoPartners" as const, title: "Find Partners (Buyers, Suppliers & Services)", icon: <Network size={24} color={colors.fpoForeground} /> },
    { to: "FpoHelp" as const, title: "Learn & Get Expert Help", icon: <GraduationCap size={24} color={colors.fpoForeground} /> },
    { to: "FpoMy" as const, title: "Know My FPO", icon: <Building2 size={24} color={colors.fpoForeground} /> },
  ];

  return (
    <RoleShell
      accent="fpo"
      screenName="FPO Home"
      header={
        <View style={s.headerBand}>
          <Text size="sm" weight="700" color={colors.fpo}>{fpo.name}</Text>
        </View>
      }
    >
      <View>
        <Text size="xl" weight="600">
          {"Namaste, "}
          <Text size="xl" weight="600" color={colors.fpo}>{fpo.name}</Text>
        </Text>
        <Muted style={{ marginTop: 2 }}>Pick a section to manage your FPO.</Muted>
      </View>

      <View style={{ gap: spacing.md }}>
        {GROUPS.map((g) => (
          <Pressable key={g.to} onPress={() => nav.navigate(g.to)}
            style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}>
            <View style={s.tileIcon}>{g.icon}</View>
            <View style={{ flex: 1 }}>
              <Text size="base" weight="700" color={colors.fpo}>{g.title}</Text>
              <Muted style={{ marginTop: 2 }}>Tap to open.</Muted>
            </View>
          </Pressable>
        ))}
      </View>

      <Muted center>Need help finding a screen? Tap the assistant button in the bottom-right.</Muted>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  headerBand: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tile: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    backgroundColor: colors.fpoSoft, padding: spacing.lg,
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.fpo,
    alignItems: "center", justifyContent: "center",
  },
});
