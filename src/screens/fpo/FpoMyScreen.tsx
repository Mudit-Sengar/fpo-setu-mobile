import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Building2, Users } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { BackLink, EmptyHint, SectionCard, SectionCardRow } from "../../components/common";
import { FpoProfileSection, RelationshipsSection } from "../../features/fpo-sections";

type Sub = null | "profile" | "rel";

/** Ported from the web app's src/routes/fpo.my.tsx */
export function FpoMyScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);

  return (
    // `onBack` renders the Back control in the fixed TopBar, outside the shell's
    // ScrollView, so it stays visible while the profile scrolls — same pattern as
    // FarmerProfileScreen. The in-content BackLink below is the second, scrolling
    // affordance Farmer Profile also has.
    <RoleShell accent="fpo" screenName="Know My FPO" onBack={() => nav.goBack()}>
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <SectionCardRow>
        <SectionCard title="FPO Profile" accent={colors.fpo} active={sub === "profile"}
          onPress={() => setSub(sub === "profile" ? null : "profile")}
          icon={<Building2 size={22} color={sub === "profile" ? "#fff" : colors.fpo} />} />
        <SectionCard title="Relationship Management" accent={colors.fpo} active={sub === "rel"}
          onPress={() => setSub(sub === "rel" ? null : "rel")}
          icon={<Users size={22} color={sub === "rel" ? "#fff" : colors.fpo} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "profile" && <FpoProfileSection />}
      {sub === "rel" && <RelationshipsSection />}
    </RoleShell>
  );
}
