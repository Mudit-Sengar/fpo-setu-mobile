import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GraduationCap, MessageCircle, TrendingUp } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { EmptyHint, SectionCard, SectionCardRow } from "../../components/common";
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
    <RoleShell accent="fpo" screenName="Learn & Expert Help" onBack={() => nav.goBack()}>
      <SectionCardRow>
        <SectionCard title="Capacity Building" accent={colors.fpo} active={false} onPress={() => nav.navigate("FpoCapacity")}
          icon={<GraduationCap size={22} color={colors.fpo} />} />
        <SectionCard title="Market Readiness Hub" accent={colors.fpo} active={sub === "market"}
          onPress={() => setSub(sub === "market" ? null : "market")}
          icon={<TrendingUp size={22} color={sub === "market" ? "#fff" : colors.fpo} />} />
        <SectionCard title="Expert Network & Testimonials" accent={colors.fpo} active={sub === "experts"}
          onPress={() => setSub(sub === "experts" ? null : "experts")}
          icon={<MessageCircle size={22} color={sub === "experts" ? "#fff" : colors.fpo} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "market" && <MarketReadinessHubSection />}
      {sub === "experts" && <ExpertNetworkSection />}
    </RoleShell>
  );
}
