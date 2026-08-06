import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft, Banknote, ClipboardList, Landmark, Package, ShieldCheck, Truck, Users,
} from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { BackLink, EmptyHint, SectionCard, SectionCardRow } from "../../components/common";
import {
  AccessCreditSection, ComplianceSection, GovtSchemesSection, LocateBuyerSection,
  LocateSupplierSection, LogisticsSection, PostRequestSection,
} from "../../features/fpo-sections";

type Sub = null | "post" | "buyer" | "supplier" | "logistics" | "credit" | "schemes" | "compliance";

/** Ported from the web app's src/routes/fpo.partners.tsx */
export function FpoPartnersScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);
  const toggle = (v: Exclude<Sub, null>) => setSub(sub === v ? null : v);
  const iconColor = (v: Exclude<Sub, null>) => (sub === v ? "#fff" : colors.fpo);

  return (
    <RoleShell accent="fpo" screenName="Find Partners">
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <SectionCardRow>
        <SectionCard title="Post Request" accent={colors.fpo} active={sub === "post"} onPress={() => toggle("post")}
          icon={<ClipboardList size={22} color={iconColor("post")} />} />
        <SectionCard title="Locate a Buyer" accent={colors.fpo} active={sub === "buyer"} onPress={() => toggle("buyer")}
          icon={<Users size={22} color={iconColor("buyer")} />} />
        <SectionCard title="Locate a Supplier" accent={colors.fpo} active={sub === "supplier"} onPress={() => toggle("supplier")}
          icon={<Package size={22} color={iconColor("supplier")} />} />
        <SectionCard title="Logistics" accent={colors.fpo} active={sub === "logistics"} onPress={() => toggle("logistics")}
          icon={<Truck size={22} color={iconColor("logistics")} />} />
        <SectionCard title="Credit Access" accent={colors.fpo} active={sub === "credit"} onPress={() => toggle("credit")}
          icon={<Banknote size={22} color={iconColor("credit")} />} />
        <SectionCard title="Govt Schemes" accent={colors.fpo} active={sub === "schemes"} onPress={() => toggle("schemes")}
          icon={<Landmark size={22} color={iconColor("schemes")} />} />
        <SectionCard title="Compliance" accent={colors.fpo} active={sub === "compliance"} onPress={() => toggle("compliance")}
          icon={<ShieldCheck size={22} color={iconColor("compliance")} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "post" && <PostRequestSection />}
      {sub === "buyer" && <LocateBuyerSection />}
      {sub === "supplier" && <LocateSupplierSection />}
      {sub === "logistics" && <LogisticsSection />}
      {sub === "credit" && <AccessCreditSection />}
      {sub === "schemes" && <GovtSchemesSection />}
      {sub === "compliance" && <ComplianceSection />}
    </RoleShell>
  );
}
