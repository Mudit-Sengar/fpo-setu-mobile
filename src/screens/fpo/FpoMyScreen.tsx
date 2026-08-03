import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Chip, ChipRow } from "../../components/ui";
import { BackLink, EmptyHint } from "../../components/common";
import { FpoProfileSection, RelationshipsSection } from "../../features/fpo-sections";

type Sub = null | "profile" | "rel";

/** Ported from the web app's src/routes/fpo.my.tsx */
export function FpoMyScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);

  return (
    <RoleShell accent="fpo" screenName="Know My FPO">
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <ChipRow>
        <Chip label="FPO Profile" accent={colors.fpo} active={sub === "profile"}
          onPress={() => setSub(sub === "profile" ? null : "profile")} />
        <Chip label="Relationship Management" accent={colors.fpo} active={sub === "rel"}
          onPress={() => setSub(sub === "rel" ? null : "rel")} />
      </ChipRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "profile" && <FpoProfileSection />}
      {sub === "rel" && <RelationshipsSection />}
    </RoleShell>
  );
}
