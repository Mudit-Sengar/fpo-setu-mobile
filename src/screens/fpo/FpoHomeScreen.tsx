import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Briefcase, Building2, GraduationCap, Network } from "lucide-react-native";
import { useApp } from "../../lib/app-state";
import { fpoRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { FPO } from "../../db/types";
import { colors, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Muted, Text } from "../../components/ui";
import { Tile } from "../../components/common";
import type { FpoStackParamList } from "../../navigation/types";

/** Ported from the web app's src/routes/fpo.index.tsx (FPO Bandhu home) */
export function FpoHomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<FpoStackParamList>>();
  const { activeFpoId } = useApp();
  const [fpo] = useDbQuery<FPO | null>(() => fpoRepo.getFpoById(activeFpoId), [activeFpoId], null);
  const fpoName = fpo?.name ?? "";

  const GROUPS = [
    { to: "FpoManage" as const, title: "Manage & Grow", icon: <Briefcase size={26} color={colors.fpo} /> },
    { to: "FpoPartners" as const, title: "Find Partners", icon: <Network size={26} color={colors.fpo} /> },
    { to: "FpoHelp" as const, title: "Learn & Help", icon: <GraduationCap size={26} color={colors.fpo} /> },
    { to: "FpoMy" as const, title: "Know My FPO", icon: <Building2 size={26} color={colors.fpo} /> },
  ];

  return (
    <RoleShell
      accent="fpo"
      screenName="FPO Home"
      header={
        <View style={s.headerBand}>
          <Text size="sm" weight="700" color={colors.fpo}>{fpoName}</Text>
        </View>
      }
    >
      <View>
        <Text size="xl" weight="600">
          {"Namaste, "}
          <Text size="xl" weight="600" color={colors.fpo}>{fpoName}</Text>
        </Text>
        <Muted style={{ marginTop: 2 }}>Pick a section to manage your FPO.</Muted>
      </View>

      <View style={s.tiles}>
        {GROUPS.map((g) => (
          <Tile key={g.to} label={g.title} accent={colors.fpo} tint={colors.fpoSoft}
            icon={g.icon} onPress={() => nav.navigate(g.to)} />
        ))}
      </View>

      <Muted center>Need help finding a screen? Tap the assistant button in the bottom-right.</Muted>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  headerBand: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
