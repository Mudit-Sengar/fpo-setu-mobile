import React from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft, Building2, Calendar, FileBadge, IdCard, LandPlot, MapPin, Sprout,
} from "lucide-react-native";
import { useSessionFarmer, useSessionFarmerId } from "../../lib/useSessionProfile";
import { farmerRepo, fpoRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { FPO } from "../../db/types";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Badge, Button, Card, CardContent, Muted, Text } from "../../components/ui";
import { BackLink } from "../../components/common";

/**
 * Ported from the web app's src/routes/farmer.profile.tsx — a READ-ONLY display
 * (the web version had no editable form either).
 */
export function FarmerProfileScreen() {
  const nav = useNavigation();
  const farmer = useSessionFarmer();
  const farmerId = useSessionFarmerId();
  const [fpo] = useDbQuery<FPO | null>(
    () => (farmer?.fpoId != null ? fpoRepo.getFpoById(farmer.fpoId) : Promise.resolve(null)),
    [farmer?.fpoId], null);

  // AgriStack-derived fields — now columns on `farmers` rather than local constants.
  const [extras] = useDbQuery(
    () => (farmerId == null
      ? Promise.resolve({ taluka: "", state: "", surveyNo: "", khasraNo: "" })
      : farmerRepo.getFarmerProfileExtras(farmerId)),
    [farmerId],
    { taluka: "", state: "", surveyNo: "", khasraNo: "" },
  );
  const { taluka, state, surveyNo, khasraNo: khasra } = extras ?? {
    taluka: "", state: "", surveyNo: "", khasraNo: "",
  };
  const landHa = ((farmer?.landAcres ?? 0) / 2.471).toFixed(2);

  const initials = (farmer?.name ?? "").split(" ").map((p) => p[0]).slice(0, 2).join("");

  // The whole screen describes one farmer, so render the shell (header/back) until
  // the row arrives rather than threading optional chaining through every field.
  if (farmer == null || fpo == null) {
    return (
      <RoleShell accent="farmer" screenName="Farmer Profile" onBack={() => nav.goBack()}>
        <View style={s.topRow}>
          <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />
        </View>
      </RoleShell>
    );
  }

  return (
    <RoleShell accent="farmer" screenName="Farmer Profile" onBack={() => nav.goBack()}>
      <View style={s.topRow}>
        <BackLink label="Back" onPress={() => nav.goBack()} icon={<ArrowLeft size={16} color={colors.mutedForeground} />} />
        <Badge color={colors.farmer} bg={colors.farmerSoft}>AgriStack verified</Badge>
      </View>

      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={s.avatar}>
              <Text size="lg" weight="700" color={colors.farmerForeground} noTranslate>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Muted>Farmer Profile</Muted>
              <Text size="lg" weight="700" color={colors.farmer} numberOfLines={1}>{farmer.name}</Text>
              <Muted noTranslate>{farmer.id}</Muted>
            </View>
          </View>
        </CardContent>
      </Card>

      <ProfileRow icon={<IdCard size={16} color={colors.farmer} />} label="Full Name" value={farmer.name} />
      <ProfileRow icon={<MapPin size={16} color={colors.farmer} />} label="Location"
        value={`${farmer.village}, ${taluka}, ${farmer.district}, ${state}`} />
      <ProfileRow icon={<LandPlot size={16} color={colors.farmer} />} label="Land Holding"
        value={`${farmer.landAcres} acres (${landHa} ha)`} />
      <ProfileRow icon={<Sprout size={16} color={colors.farmer} />} label="Crops Currently Sown"
        value={farmer.crops.join(", ")} />
      <ProfileRow icon={<FileBadge size={16} color={colors.farmer} />} label="Survey / Khasra No."
        value={`${surveyNo} · ${khasra}`} />
      <ProfileRow icon={<Building2 size={16} color={colors.farmer} />} label="FPO Membership"
        value={`${fpo.name} · ${(farmer.sharePct * 100).toFixed(2)}% equity`} />
      <ProfileRow icon={<Calendar size={16} color={colors.farmer} />} label="Member Since"
        value={farmer.memberSince ?? "—"} />

      <Card>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="xs" weight="700" color={colors.mutedForeground} style={{ marginBottom: spacing.sm }}>
            Recent transactions
          </Text>
          {farmer.txns.map((t, i) => (
            <View key={i} style={s.txn}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="600">{`${t.crop} · ${t.qty_q} q`}</Text>
                <Muted>{`${t.date}${t.refId ? ` · Ref ${t.refId}` : ""}`}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text size="sm" weight="700">{`₹${t.amount.toLocaleString("en-IN")}`}</Text>
                <Muted>{`@ ₹${t.price}/q`}</Muted>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" full onPress={() => nav.goBack()}>Close</Button>
    </RoleShell>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text size="xxs" weight="600" color={colors.mutedForeground}>{label}</Text>
        <Text size="sm" weight="500">{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.farmer,
    alignItems: "center", justifyContent: "center",
  },
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "flex-start",
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md,
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.farmerSoft,
    alignItems: "center", justifyContent: "center",
  },
  txn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    backgroundColor: colors.mutedBg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
});
