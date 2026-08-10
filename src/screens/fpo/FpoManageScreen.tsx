import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { BookOpenCheck, CalendarDays, TrendingUp } from "lucide-react-native";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { EmptyHint, SectionCard, SectionCardRow } from "../../components/common";
import {
  BookkeepingSection, ExpansionPlannerSection, MeetingSection,
} from "../../features/fpo-sections";

type Sub = null | "meet" | "books" | "plan";

/** Ported from the web app's src/routes/fpo.manage.tsx */
export function FpoManageScreen() {
  const nav = useNavigation();
  const [sub, setSub] = useState<Sub>(null);
  const toggle = (v: Exclude<Sub, null>) => setSub(sub === v ? null : v);

  return (
    <RoleShell accent="fpo" screenName="Manage & Grow Business" onBack={() => nav.goBack()}>
      <SectionCardRow>
        <SectionCard title="Log Meeting" accent={colors.fpo} active={sub === "meet"} onPress={() => toggle("meet")}
          icon={<CalendarDays size={22} color={sub === "meet" ? "#fff" : colors.fpo} />} />
        <SectionCard title="Bookkeeping" accent={colors.fpo} active={sub === "books"} onPress={() => toggle("books")}
          icon={<BookOpenCheck size={22} color={sub === "books" ? "#fff" : colors.fpo} />} />
        <SectionCard title="Expansion Planner" accent={colors.fpo} active={sub === "plan"} onPress={() => toggle("plan")}
          icon={<TrendingUp size={22} color={sub === "plan" ? "#fff" : colors.fpo} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick a button to open that section.</EmptyHint>}
      {sub === "meet" && <MeetingSection />}
      {sub === "books" && <BookkeepingSection />}
      {sub === "plan" && <ExpansionPlannerSection />}
    </RoleShell>
  );
}
