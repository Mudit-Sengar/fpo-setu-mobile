import React from "react";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Text } from "../../components/ui";
import { BackLink } from "../../components/common";
import { CapacityBuildingSection } from "../../features/fpo-sections";

/** Ported from the web app's src/routes/fpo.capacity.tsx */
export function FpoCapacityScreen() {
  const nav = useNavigation();

  return (
    <RoleShell accent="fpo" screenName="Capacity Building">
      <BackLink label="Back to Learn & Expert Help" onPress={() => nav.goBack()}
        icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />
      <Text size="lg" weight="700" color={colors.fpo}>Capacity Building</Text>
      <CapacityBuildingSection />
    </RoleShell>
  );
}
