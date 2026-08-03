import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Chip, ChipRow } from "../../components/ui";
import { BackLink, EmptyHint } from "../../components/common";
import {
  BookkeepingSection, ExpansionPlannerSection, MeetingSection, PostRequestSection,
} from "../../features/fpo-sections";

type Sub = null | "post" | "meet" | "books" | "plan";

/** Ported from the web app's src/routes/fpo.manage.tsx */
export function FpoManageScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);

  return (
    <RoleShell accent="fpo" screenName="Manage & Grow Business">
      <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />

      <ChipRow>
        <Chip label="Post Request" accent={colors.fpo} active={sub === "post"} onPress={() => setSub(sub === "post" ? null : "post")} />
        <Chip label="Log Meeting" accent={colors.fpo} active={sub === "meet"} onPress={() => setSub(sub === "meet" ? null : "meet")} />
        <Chip label="Bookkeeping" accent={colors.fpo} active={sub === "books"} onPress={() => setSub(sub === "books" ? null : "books")} />
        <Chip label="Expansion Planner" accent={colors.fpo} active={sub === "plan"} onPress={() => setSub(sub === "plan" ? null : "plan")} />
      </ChipRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "post" && <PostRequestSection />}
      {sub === "meet" && <MeetingSection />}
      {sub === "books" && <BookkeepingSection />}
      {sub === "plan" && <ExpansionPlannerSection />}
    </RoleShell>
  );
}
