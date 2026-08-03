import React, { type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing, type Accent } from "../../theme";
import { AssistantWidget } from "../AssistantWidget";
import { PrototypeFooter, TopBar } from "./TopBar";

/**
 * React Native equivalent of the web app's src/components/layout/RoleShell.tsx.
 *
 * Differences from the web version, all deliberate:
 *  - The desktop sidebar + mobile bottom tab bar are now React Navigation's
 *    bottom tab navigator (see src/navigation/). This shell only renders the
 *    header, the scrollable content area, and the floating assistant.
 *  - The web `useEffect` role guard (redirect to "/" when role !== accent) is gone:
 *    RootNavigator mounts only the stack matching the active role, so a mismatched
 *    screen can never render in the first place.
 */
export function RoleShell({
  accent,
  children,
  header,
  screenName,
  onOpenFarmerProfile,
  scroll = true,
  showFooter = false,
}: {
  accent: Accent;
  children: ReactNode;
  /** Optional coloured band under the header (buyer Stepper, FPO name banner). */
  header?: ReactNode;
  screenName?: string;
  onOpenFarmerProfile?: () => void;
  scroll?: boolean;
  showFooter?: boolean;
}) {
  const body = (
    <>
      {children}
      {showFooter && <PrototypeFooter />}
    </>
  );

  return (
    <View style={s.root}>
      <TopBar accent={accent} onOpenFarmerProfile={onOpenFarmerProfile} />
      {header != null && (
        <View style={{ backgroundColor: accentSoft(accent), borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {header}
        </View>
      )}
      {scroll ? (
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.content]}>{body}</View>
      )}
      <AssistantWidget screenName={screenName} />
    </View>
  );
}

function accentSoft(a: Accent) {
  return a === "farmer" ? colors.farmerSoft : a === "fpo" ? colors.fpoSoft : colors.buyerSoft;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mutedBg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
});
