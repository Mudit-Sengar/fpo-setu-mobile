import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MapPin, MessageCircle, Send } from "lucide-react-native";
import {
  DEFAULT_FARMER_ID, FARMER_BUYER_MATCHES, FARMERS, SIMILAR_FARMERS,
} from "../../lib/mockData";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Chip, ChipRow,
  Field, Input, Muted, Select, Text, toast,
} from "../../components/ui";
import { EmptyHint, Pill } from "../../components/common";
import { useFarmerBack } from "../../hooks/useFarmerBack";

type Sub = null | "buyers" | "farmers";

/** Ported from the web app's src/routes/farmer.connect.tsx */
export function ConnectScreen() {
  const nav = useNavigation();
  const goBack = useFarmerBack();
  const [sub, setSub] = useState<Sub>(null);

  return (
    <RoleShell accent="farmer" screenName="Connect" onBack={goBack} onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <ChipRow>
        <Chip label="Connect with Buyers" accent={colors.farmer} active={sub === "buyers"}
          onPress={() => setSub(sub === "buyers" ? null : "buyers")} />
        <Chip label="Connect with Similar Farmers" accent={colors.farmer} active={sub === "farmers"}
          onPress={() => setSub(sub === "farmers" ? null : "farmers")} />
      </ChipRow>

      {sub === null && <EmptyHint>Pick how you want to connect.</EmptyHint>}
      {sub === "buyers" && <ConnectBuyers />}
      {sub === "farmers" && <ConnectFarmers />}
    </RoleShell>
  );
}

function ConnectBuyers() {
  const [msgFor, setMsgFor] = useState<string | null>(null);
  const [msg, setMsg] = useState("Namaste, I have produce matching your requirement and would like to discuss pricing.");

  return (
    <>
      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="sm">
            For larger farmers who want to sell directly to a buyer instead of through an FPO. Below are buyers near you with active requirements matching your crops.
          </Text>
        </CardContent>
      </Card>

      {FARMER_BUYER_MATCHES.map((b) => (
        <Card key={b.id}>
          <CardContent style={{ paddingTop: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{b.buyer}</Text>
                <View style={s.metaLine}>
                  <MapPin size={12} color={colors.mutedForeground} />
                  <Muted>{`${b.location} · ${b.distanceKm} km`}</Muted>
                </View>
              </View>
              <Badge color="#ffffff" bg={colors.farmer}>Match</Badge>
            </View>

            <View style={s.pillRow}>
              <Pill k="Crop" v={b.crop} />
              <Pill k="Grade" v={b.grade} />
              <Pill k="Qty" v={b.qty} />
            </View>

            <Muted style={{ marginTop: spacing.sm }}>
              {"Procurement window: "}
              <Text size="xs">{b.window}</Text>
            </Muted>

            <Button full size="sm" accent={colors.farmer} style={{ marginTop: spacing.sm }}
              icon={<MessageCircle size={12} color="#ffffff" />}
              onPress={() => setMsgFor(b.id)}>
              Connect
            </Button>

            {msgFor === b.id && (
              <View style={s.inlineForm}>
                <Field label={`Message to ${b.buyer}`}>
                  <Input value={msg} onChangeText={setMsg} multiline numberOfLines={3} />
                </Field>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                  <Button variant="ghost" size="sm" onPress={() => setMsgFor(null)}>Cancel</Button>
                  <Button size="sm" accent={colors.farmer} icon={<Send size={12} color="#ffffff" />}
                    onPress={() => { toast.success(`Message sent to ${b.buyer}.`); setMsgFor(null); }}>
                    Send
                  </Button>
                </View>
              </View>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function ConnectFarmers() {
  const me = FARMERS.find((f) => f.id === DEFAULT_FARMER_ID)!;
  const [crop, setCrop] = useState(me.crops[0]);
  const [grade, setGrade] = useState("A");
  const [quality, setQuality] = useState<"any" | "Premium" | "Export" | "Standard">("any");
  const [maxKm, setMaxKm] = useState("100");
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [chat, setChat] = useState<{ who: "me" | "them"; text: string }[]>([]);
  const [draft, setDraft] = useState("");

  const km = Number(maxKm) || 0;
  // Filter logic preserved verbatim from the web app.
  const matches = useMemo(() => SIMILAR_FARMERS.filter((s) =>
    s.crop === crop && (grade === "any" || s.grade === grade) &&
    (quality === "any" || s.quality === quality) && s.distanceKm <= km,
  ), [crop, grade, quality, km]);

  function send() {
    if (!draft.trim()) return;
    setChat((p) => [...p, { who: "me", text: draft }]);
    setDraft("");
    // Simulated reply — same 600ms delay as the web prototype.
    setTimeout(() => setChat((p) => [...p, { who: "them", text: "Got it. Let's plan a meet next week." }]), 600);
  }

  return (
    <>
      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="sm">
            Find farmers across Maharashtra growing the same crop so you can collectively sell a large order to exporters or processors.
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Search filters</CardTitle></CardHeader>
        <CardContent>
          <Field label="Crop">
            <Select value={crop} options={["Onion", "Tomato", "Turmeric", "Soybean", "Tur", "Banana"]} onChange={setCrop} />
          </Field>
          <Field label="Grade">
            <Select value={grade} options={["A", "B", "any"]} onChange={setGrade} />
          </Field>
          <Field label="Quality">
            <Select value={quality} options={["any", "Premium", "Export", "Standard"] as const} onChange={setQuality} />
          </Field>
          <Field label="Within (km)">
            <Input value={maxKm} onChangeText={setMaxKm} keyboardType="numeric" />
          </Field>
        </CardContent>
      </Card>

      {matches.length === 0 && (
        <Card><CardContent style={{ paddingTop: spacing.lg }}>
          <Muted center>No matching farmers — widen distance or change quality.</Muted>
        </CardContent></Card>
      )}

      {matches.map((f) => (
        <Card key={f.id}>
          <CardContent style={{ paddingTop: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{f.name}</Text>
                <View style={s.metaLine}>
                  <MapPin size={12} color={colors.mutedForeground} />
                  <Muted>{`${f.village}, ${f.district} · ${f.distanceKm} km`}</Muted>
                </View>
              </View>
              <Badge color={colors.farmer} bg={colors.farmerSoft}>{`${f.landAcres} ac`}</Badge>
            </View>

            <View style={s.pillRow}>
              <Pill k="Crop" v={f.crop} />
              <Pill k="Grade" v={f.grade} />
              <Pill k="Quality" v={f.quality} />
            </View>

            <Button full size="sm" accent={colors.farmer} style={{ marginTop: spacing.sm }}
              icon={<MessageCircle size={12} color="#ffffff" />}
              onPress={() => {
                setChatWith(f.id);
                setChat([{ who: "them", text: `Namaste! I grow ${f.crop} (${f.grade}, ${f.quality}). Let's pool our harvest.` }]);
              }}>
              Connect & chat
            </Button>

            {chatWith === f.id && (
              <View style={s.chatBox}>
                <Text size="xxs" weight="700" color={colors.mutedForeground} style={{ marginBottom: spacing.sm }}>
                  {`Chat with ${f.name}`}
                </Text>
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                  <View style={{ gap: spacing.sm }}>
                    {chat.map((m, i) => (
                      <View key={i} style={{ alignItems: m.who === "me" ? "flex-end" : "flex-start" }}>
                        <View style={[s.bubble, m.who === "me"
                          ? { backgroundColor: colors.farmer }
                          : { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                          <Text size="xs" color={m.who === "me" ? "#ffffff" : colors.foreground}>{m.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Input value={draft} onChangeText={setDraft} placeholder="Type a message" />
                  </View>
                  <Pressable onPress={send} style={s.sendBtn} accessibilityLabel="Send">
                    <Send size={14} color="#ffffff" />
                  </Pressable>
                </View>
              </View>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  metaLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  inlineForm: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.md,
  },
  chatBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.md,
  },
  bubble: { maxWidth: "82%", borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  sendBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.farmer,
    alignItems: "center", justifyContent: "center",
  },
});
