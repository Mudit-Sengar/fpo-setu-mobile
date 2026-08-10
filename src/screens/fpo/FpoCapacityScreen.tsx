import React from "react";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Text } from "../../components/ui";
import { CapacityBuildingSection } from "../../features/fpo-sections";

/** Ported from the web app's src/routes/fpo.capacity.tsx */
export function FpoCapacityScreen() {
  const nav = useNavigation();

  return (
    <RoleShell accent="fpo" screenName="Capacity Building" onBack={() => nav.goBack()}>
      <Text size="lg" weight="700" color={colors.fpo}>Capacity Building</Text>
      <CapacityBuildingSection />
    </RoleShell>
  );
}
