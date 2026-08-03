import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Chip, ChipRow } from "../../components/ui";
import { BackLink, EmptyHint } from "../../components/common";
import {
  AccessCreditSection, ComplianceSection, GovtSchemesSection, LocateBuyerSection,
  LocateSupplierSection, LogisticsSection,
} from "../../features/fpo-sections";

type Sub = null | "buyer" | "supplier" | "logistics" | "credit" | "schemes" | "compliance";

/** Ported from the web app's src/routes/fpo.partners.tsx */
export function FpoPartnersScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);
  const toggle = (v: Exclude<Sub, null>) => setSub(sub === v ? null : v);

  return (
    <RoleShell accent="fpo" screenName="Find Partners">
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <ChipRow>
        <Chip label="Locate a Buyer" accent={colors.fpo} active={sub === "buyer"} onPress={() => toggle("buyer")} />
        <Chip label="Locate a Supplier" accent={colors.fpo} active={sub === "supplier"} onPress={() => toggle("supplier")} />
        <Chip label="Logistics" accent={colors.fpo} active={sub === "logistics"} onPress={() => toggle("logistics")} />
        <Chip label="Access Credit" accent={colors.fpo} active={sub === "credit"} onPress={() => toggle("credit")} />
        <Chip label="Govt Schemes" accent={colors.fpo} active={sub === "schemes"} onPress={() => toggle("schemes")} />
        <Chip label="Compliance" accent={colors.fpo} active={sub === "compliance"} onPress={() => toggle("compliance")} />
      </ChipRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "buyer" && <LocateBuyerSection />}
      {sub === "supplier" && <LocateSupplierSection />}
      {sub === "logistics" && <LogisticsSection />}
      {sub === "credit" && <AccessCreditSection />}
      {sub === "schemes" && <GovtSchemesSection />}
      {sub === "compliance" && <ComplianceSection />}
    </RoleShell>
  );
}
