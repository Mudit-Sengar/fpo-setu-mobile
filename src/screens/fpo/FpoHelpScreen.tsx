import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Chip, ChipRow } from "../../components/ui";
import { BackLink, EmptyHint } from "../../components/common";
import { ExpertNetworkSection } from "../../features/fpo-sections";
import { MarketReadinessHubSection } from "../../features/market-readiness";
import type { FpoStackParamList } from "../../navigation/types";

type Sub = null | "experts" | "market";

/**
 * Ported from the web app's src/routes/fpo.help.tsx.
 * NOTE (parity): "Capacity Building" navigates to its own screen rather than
 * rendering inline like its two siblings — the same inconsistency the web app had.
 */
export function FpoHelpScreen() {
  const nav = useNavigation<NativeStackNavigationProp<FpoStackParamList>>();
  const [sub, setSub] = useState<Sub>(null);

  return (
    <RoleShell accent="fpo" screenName="Learn & Expert Help">
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <ChipRow>
        <Chip label="Capacity Building" accent={colors.fpo} active={false} onPress={() => nav.navigate("FpoCapacity")} />
        <Chip label="Market Readiness Hub" accent={colors.fpo} active={sub === "market"}
          onPress={() => setSub(sub === "market" ? null : "market")} />
        <Chip label="Expert Network & Testimonials" accent={colors.fpo} active={sub === "experts"}
          onPress={() => setSub(sub === "experts" ? null : "experts")} />
      </ChipRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "market" && <MarketReadinessHubSection />}
      {sub === "experts" && <ExpertNetworkSection />}
    </RoleShell>
  );
}
