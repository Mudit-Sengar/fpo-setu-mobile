import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Building2, GraduationCap, Landmark, Mic, MicOff, Send, Users } from "lucide-react-native";
import { DEFAULT_FARMER_ID, FARMERS } from "../../lib/mockData";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Input, Muted, Text, toast } from "../../components/ui";
import { Tile } from "../../components/common";
import { useSpeech } from "../../hooks/useSpeech";
import type { FarmerTabParamList } from "../../navigation/types";

/**
 * Ported from the web app's src/routes/farmer.index.tsx (Krishi Bandhu home).
 * The keyword-routing regexes are preserved verbatim; only the navigation target
 * changed from a URL path to a tab name.
 */
export function FarmerHomeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<FarmerTabParamList>>();
  const farmer = FARMERS.find((f) => f.id === DEFAULT_FARMER_ID);
  const [q, setQ] = useState("");
  const { startListening, listening } = useSpeech();

  function submit() {
    const t = q.toLowerCase();
    if (!t.trim()) return;
    if (/scheme|subsidy|pm-?kisan|insurance|loan|kcc/.test(t)) nav.navigate("Schemes");
    else if (/learn|course|video|story|fpo basics|how/.test(t)) nav.navigate("Learn");
    else if (/my fpo|membership|profit|share|market|price|apmc/.test(t)) nav.navigate("MyFpo");
    else if (/buyer|sell directly|connect/.test(t)) nav.navigate("Connect");
    else toast.message('Tell me where to go — try "PM-KISAN", "learn videos", or "connect with a buyer for onion".');
    setQ("");
  }

  return (
    <RoleShell accent="farmer" screenName="Farmer Home" onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <View>
        <Text size="xl" weight="600">
          {"Namaste, "}
          <Text size="xl" weight="600" color={colors.farmer}>{farmer?.name ?? "Kisan"}</Text>
          {" 🌾"}
        </Text>
        <Muted style={{ marginTop: 2 }}>Pick a section to get started.</Muted>
      </View>

      <View style={s.tiles}>
        <Tile label="Know My FPO" accent={colors.farmer} tint={colors.farmerSoft}
          icon={<Building2 size={26} color={colors.farmer} />} onPress={() => nav.navigate("MyFpo")} />
        <Tile label="Learn" accent="#B45309" tint="#FEF3C7"
          icon={<GraduationCap size={26} color="#B45309" />} onPress={() => nav.navigate("Learn")} />
        <Tile label="Connect" accent="#0F766E" tint="#CCFBF1"
          icon={<Users size={26} color="#0F766E" />} onPress={() => nav.navigate("Connect")} />
        <Tile label="Gov Schemes" accent="#BE123C" tint="#FFE4E6"
          icon={<Landmark size={26} color="#BE123C" />} onPress={() => nav.navigate("Schemes")} />
      </View>

      <View style={s.bandhu}>
        <View style={s.bandhuHead}>
          <View style={s.bandhuIcon}><Text size="xs">🌱</Text></View>
          <View style={{ flex: 1 }}>
            <Text size="sm" weight="700" color={colors.farmer}>Krishi Bandhu 🌱</Text>
            <Muted>Platform navigator — tap or speak</Muted>
          </View>
        </View>
        <View style={s.bandhuRow}>
          <View style={{ flex: 1 }}>
            <Input value={q} onChangeText={setQ} placeholder="मला मदत करा... / Ask me to take you somewhere" />
          </View>
          <Pressable
            onPress={startListening}
            style={[s.iconBtn, listening && { backgroundColor: colors.farmer, borderColor: colors.farmer }]}
            accessibilityLabel={listening ? "Stop voice input" : "Speak"}
          >
            {listening ? <MicOff size={16} color="#ffffff" /> : <Mic size={16} color={colors.farmer} />}
          </Pressable>
          <Pressable onPress={submit} style={[s.iconBtn, { backgroundColor: colors.farmer, borderColor: colors.farmer }]} accessibilityLabel="Send">
            <Send size={16} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  bandhu: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    backgroundColor: colors.card, padding: spacing.md, gap: spacing.md,
  },
  bandhuHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bandhuIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.farmerSoft,
    alignItems: "center", justifyContent: "center",
  },
  bandhuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.farmer,
    alignItems: "center", justifyContent: "center",
  },
});
