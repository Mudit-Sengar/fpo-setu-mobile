import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ExternalLink, Info, Landmark } from "lucide-react-native";
import { farmerSchemeDescription } from "../../lib/mockData";
import { contentRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { FarmerScheme } from "../../db/types";
import { colors, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Badge, Button, Card, CardContent, Muted, Text, toast } from "../../components/ui";
import { Segmented } from "../../components/common";
import { useFarmerBack } from "../../hooks/useFarmerBack";

type Filter = "all" | "Central" | "State (Maharashtra)";

/**
 * Government Schemes (Farmer).
 *
 * Every piece of scheme copy — name, body, description, destination URL — comes
 * from the data layer via the `farmerScheme*` accessors. Nothing about a scheme
 * is hardcoded here; adding or editing a scheme is a data change only.
 */
export function SchemesScreen() {
  const nav = useNavigation();
  const goBack = useFarmerBack();
  const [filter, setFilter] = useState<Filter>("all");

  const [list] = useDbQuery<FarmerScheme[]>(
    () => contentRepo.listFarmerSchemes(filter === "all" ? undefined : filter),
    [filter], [],
  );

  // "Know More" and "Apply" currently resolve to the same official portal.
  async function openScheme(scheme: FarmerScheme) {
    const url = await contentRepo.getFarmerSchemeUrl(scheme.name);
    if (!url) {
      toast.error("No portal link available for this scheme.");
      return;
    }
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else toast.error("Could not open the scheme portal.");
  }

  return (
    <RoleShell
      accent="farmer"
      screenName="Government Schemes"
      onBack={goBack}
      onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}
    >
      <View style={s.head}>
        <View style={s.titleRow}>
          <Landmark size={20} color={colors.farmer} />
          <Text size="xl" weight="700">Government Schemes</Text>
        </View>
        <Muted>Tap a scheme to read more or apply on the official portal.</Muted>
      </View>

      <Segmented
        options={["all", "Central", "State (Maharashtra)"] as const}
        value={filter}
        onChange={setFilter}
        accent={colors.farmer}
        size="lg"
        labelOf={(f) => (f === "all" ? "All" : f === "Central" ? "Central" : "State")}
      />

      {list.map((scheme) => (
        <Card key={scheme.name}>
          <CardContent style={s.card}>
            <Text size="base" weight="700">{scheme.name}</Text>

            <View style={s.badgeRow}>
              <Badge
                color={scheme.body === "Central" ? colors.primary : colors.farmer}
                bg={scheme.body === "Central" ? colors.fpoSoft : colors.farmerSoft}
              >
                {scheme.body}
              </Badge>
            </View>

            <Muted numberOfLines={2}>{farmerSchemeDescription(scheme)}</Muted>

            <View style={s.actions}>
              <Button
                variant="outline"
                accent={colors.farmer}
                style={s.action}
                icon={<Info size={14} color={colors.farmer} />}
                onPress={() => openScheme(scheme)}
              >
                Know More
              </Button>
              <Button
                accent={colors.farmer}
                style={s.action}
                icon={<ExternalLink size={14} color="#ffffff" />}
                onPress={() => openScheme(scheme)}
              >
                Apply
              </Button>
            </View>
          </CardContent>
        </Card>
      ))}

      {list.length === 0 && <Muted center>No schemes match this filter.</Muted>}
    </RoleShell>
  );
}

const s = StyleSheet.create({
  head: { gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: { paddingTop: spacing.lg, gap: spacing.sm },
  badgeRow: { flexDirection: "row" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
});
