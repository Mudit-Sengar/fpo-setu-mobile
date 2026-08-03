import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ExternalLink, Landmark } from "lucide-react-native";
import { FARMER_SCHEMES, FARMER_SCHEME_URLS } from "../../lib/mockData";
import { colors, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Muted, Text, toast } from "../../components/ui";
import { Segmented } from "../../components/common";

type Filter = "all" | "Central" | "State (Maharashtra)";

/** Ported from the web app's src/routes/farmer.schemes.tsx */
export function SchemesScreen() {
  const nav = useNavigation();
  const [filter, setFilter] = useState<Filter>("all");
  const list = FARMER_SCHEMES.filter((s) => filter === "all" || s.body === filter);

  // The web app used <a href target="_blank">; RN opens the system browser.
  async function apply(name: string) {
    const url = FARMER_SCHEME_URLS[name];
    if (!url) return;
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else toast.error("Could not open the scheme portal.");
  }

  return (
    <RoleShell accent="farmer" screenName="Government Schemes" onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="sm">
            <Text size="sm" weight="700" color={colors.farmer}>Krishi Bandhu: </Text>
            Here are Central + Maharashtra schemes you may be eligible for. Tap
            <Text size="sm" weight="600">{" Apply "}</Text>
            to open the official portal.
          </Text>
        </CardContent>
      </Card>

      <View style={s.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Landmark size={16} color={colors.farmer} />
          <Text size="lg" weight="700">Government Schemes</Text>
        </View>
        <Segmented
          options={["all", "Central", "State (Maharashtra)"] as const}
          value={filter}
          onChange={setFilter}
          accent={colors.farmer}
          labelOf={(f) => (f === "all" ? "All" : f === "Central" ? "Central" : "State")}
        />
      </View>

      {list.map((sch) => (
        <Card key={sch.name}>
          <CardHeader>
            <CardTitle>{sch.name}</CardTitle>
            <View style={{ flexDirection: "row", marginTop: 4 }}>
              <Badge
                color={sch.body === "Central" ? colors.primary : colors.farmer}
                bg={sch.body === "Central" ? colors.fpoSoft : colors.farmerSoft}
              >
                {sch.body}
              </Badge>
            </View>
          </CardHeader>
          <CardContent>
            <Text size="sm">{sch.desc}</Text>
            <Muted style={{ marginTop: 4 }}>
              <Text size="xs" weight="700">Benefit: </Text>
              {sch.benefit}
            </Muted>

            <Text size="xs" weight="700" color={colors.mutedForeground} style={{ marginTop: spacing.sm }}>
              Eligibility
            </Text>
            {sch.requirements.map((r) => (
              <View key={r} style={s.bullet}>
                <Text size="xs" color={colors.mutedForeground}>•</Text>
                <Muted style={{ flex: 1 }}>{r}</Muted>
              </View>
            ))}

            <Button full size="sm" accent={colors.farmer} style={{ marginTop: spacing.md }}
              icon={<ExternalLink size={12} color="#ffffff" />}
              onPress={() => apply(sch.name)}>
              Apply
            </Button>
          </CardContent>
        </Card>
      ))}
    </RoleShell>
  );
}

const s = StyleSheet.create({
  head: { gap: spacing.sm },
  bullet: { flexDirection: "row", gap: 6, marginTop: 3 },
});
