import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  Building2, GraduationCap, Landmark, Mic, MicOff, Send, Users, X,
} from "lucide-react-native";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { useSessionFarmer } from "../../lib/useSessionProfile";
import {
  INTENT_EXAMPLES, resolveFarmerIntent, type FarmerDestination,
} from "../../lib/farmer-intents";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Input, Muted, Text, toast } from "../../components/ui";
import { networkRepo } from "../../db";
import type { NotificationRow } from "../../db/repositories/networkRepository";
import { useNotifications } from "../../features/connections";
import { resolveNotificationTarget } from "../../features/notificationTargets";
import { Tile } from "../../components/common";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import type { FarmerTabParamList } from "../../navigation/types";

/**
 * Farmer Home + the Krishi Bandhu navigator.
 *
 * Krishi Bandhu lives on this screen only. Typed text and speech transcripts are
 * both handed to `resolveFarmerIntent()` and then to `goTo()`, so the two input
 * modes share one code path — adding an intent in src/lib/farmer-intents.ts makes
 * it work for voice and text simultaneously.
 */
export function FarmerHomeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<FarmerTabParamList>>();
  const { session, lang } = useApp();
  const farmer = useSessionFarmer();
  const notifications = useNotifications();
  const [q, setQ] = useState("");

  async function openNotification(n: NotificationRow) {
    const target = resolveNotificationTarget(n);
    nav.navigate(target.tab, { sub: target.sub, req: Date.now() } as never);
    if (!n.isRead) await networkRepo.markNotificationsRead(session);
  }

  /** Single navigation sink for every resolved intent. */
  const goTo = useCallback((destination: FarmerDestination) => {
    // `req` forces the receiving screen's effect to re-fire even when the same
    // section is requested twice in a row.
    const req = Date.now();
    if (destination.kind === "screen") {
      nav.getParent()?.navigate(destination.screen as never);
      return;
    }
    switch (destination.tab) {
      case "MyFpo":   nav.navigate("MyFpo", { sub: destination.sub, req }); break;
      case "Learn":   nav.navigate("Learn", { sub: destination.sub, req }); break;
      case "Connect": nav.navigate("Connect", { sub: destination.sub, req }); break;
      case "Schemes": nav.navigate("Schemes"); break;
      case "FarmerHome": nav.navigate("FarmerHome"); break;
    }
  }, [nav]);

  /** Shared entry point for typed and spoken commands. */
  const handleCommand = useCallback((raw: string) => {
    const text = raw.trim();
    if (text.length === 0) return;

    const intent = resolveFarmerIntent(text);
    setQ("");

    if (!intent) {
      toast.message(
        `${tr("I didn't understand that. Try:", lang)} "${tr(INTENT_EXAMPLES[0], lang)}" ${tr("or", lang)} "${tr(INTENT_EXAMPLES[1], lang)}".`,
      );
      return;
    }
    toast.success(`${tr("Opening", lang)} ${tr(intent.label, lang)}`);
    goTo(intent.destination);
  }, [goTo, lang]);

  const voice = useVoiceInput(handleCommand);
  const listening = voice.status === "listening";
  const processing = voice.status === "processing";

  return (
    <RoleShell
      accent="farmer"
      screenName="Farmer Home"
      onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}
    >
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
          icon={<Building2 size={26} color={colors.farmer} />}
          onPress={() => goTo({ kind: "tab", tab: "MyFpo" })} />
        <Tile label="Learn" accent="#B45309" tint="#FEF3C7"
          icon={<GraduationCap size={26} color="#B45309" />}
          onPress={() => goTo({ kind: "tab", tab: "Learn" })} />
        <Tile label="Connect" accent="#0F766E" tint="#CCFBF1"
          icon={<Users size={26} color="#0F766E" />}
          onPress={() => goTo({ kind: "tab", tab: "Connect" })} />
        <Tile label="Gov Schemes" accent="#BE123C" tint="#FFE4E6"
          icon={<Landmark size={26} color="#BE123C" />}
          onPress={() => goTo({ kind: "tab", tab: "Schemes" })} />
      </View>

      <View style={s.notifCard}>
        <Text size="sm" weight="700">Notifications</Text>
        {notifications.length === 0
          ? <Muted>No new notifications.</Muted>
          : notifications.slice(0, 8).map((n) => (
            <Pressable key={n.id} style={s.notifRow} onPress={() => openNotification(n)}>
              {!n.isRead && <View style={s.notifDot} />}
              <View style={{ flex: 1 }}>
                <Text size="sm" weight={n.isRead ? "400" : "700"} numberOfLines={1}>{n.title}</Text>
                {n.body !== "" && <Muted numberOfLines={1}>{n.body}</Muted>}
              </View>
            </Pressable>
          ))}
      </View>

      {/* ---------------- Krishi Bandhu ---------------- */}
      <View style={[s.bandhu, listening && { borderColor: colors.farmer, borderWidth: 2 }]}>
        <View style={s.bandhuHead}>
          <View style={s.bandhuIcon}><Text size="xs" noTranslate>🌱</Text></View>
          <View style={{ flex: 1 }}>
            <Text size="sm" weight="700" color={colors.farmer}>Krishi Bandhu 🌱</Text>
            <Muted>
              {listening ? "Listening… speak now"
                : processing ? "Working out where to take you…"
                : "Tell me where to go — type or tap the mic"}
            </Muted>
          </View>
          {listening && <View style={s.pulse} />}
        </View>

        {/* Live transcript while speaking */}
        {listening && voice.partial.length > 0 && (
          <View style={s.partialBox}>
            <Text size="sm" color={colors.farmer} noTranslate>{voice.partial}</Text>
          </View>
        )}

        {/* Recoverable voice problems, dismissible */}
        {voice.error != null && voice.error.length > 0 && (
          <View style={s.errorBox}>
            <Text size="xs" color={colors.destructive} style={{ flex: 1 }}>{voice.error}</Text>
            <Pressable onPress={voice.clearError} hitSlop={8} accessibilityLabel={tr("Dismiss", lang)}>
              <X size={14} color={colors.destructive} />
            </Pressable>
          </View>
        )}

        <View style={s.bandhuRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={q}
              onChangeText={setQ}
              placeholder="Type your question... / e.g. onion price today"
              editable={!listening}
              multiline={false}
              numberOfLines={1}
              style={s.bandhuInput}
            />
          </View>

          <Pressable
            onPress={listening ? voice.stop : voice.start}
            disabled={processing}
            accessibilityRole="button"
            accessibilityLabel={tr(listening ? "Stop listening" : "Speak your request", lang)}
            accessibilityState={{ busy: listening || processing }}
            style={[
              s.iconBtn,
              listening && { backgroundColor: colors.farmer, borderColor: colors.farmer },
              processing && { opacity: 0.5 },
            ]}
          >
            {processing
              ? <ActivityIndicator size="small" color={colors.farmer} />
              : listening
                ? <MicOff size={18} color="#ffffff" />
                : <Mic size={18} color={colors.farmer} />}
          </Pressable>

          <Pressable
            onPress={() => handleCommand(q)}
            accessibilityRole="button"
            accessibilityLabel={tr("Send", lang)}
            style={[s.iconBtn, { backgroundColor: colors.farmer, borderColor: colors.farmer }]}
          >
            <Send size={18} color="#ffffff" />
          </Pressable>
        </View>

        <Muted style={{ marginTop: 2 }}>
          {["Try: ", `"${tr(INTENT_EXAMPLES[0], lang)}", "${tr(INTENT_EXAMPLES[1], lang)}", "${tr(INTENT_EXAMPLES[2], lang)}"`]}
        </Muted>
      </View>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  notifCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, gap: spacing.sm,
  },
  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.farmer, marginTop: 6 },
  bandhu: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    backgroundColor: colors.card, padding: spacing.md, gap: spacing.md,
  },
  bandhuHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bandhuIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.farmerSoft,
    alignItems: "center", justifyContent: "center",
  },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.destructive },
  partialBox: {
    backgroundColor: colors.farmerSoft, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "#FDECEA", borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  bandhuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  /**
   * Pinned to one line. The bilingual placeholder is longer than the field is
   * wide, and Android wraps a TextInput's hint onto a second line unless the
   * field is explicitly single-line — the old padding-driven height was sized
   * for one line, so that second line showed as a clipped sliver. `multiline`
   * is passed as `false` (not left undefined) at the call site so the hint is
   * ellipsised instead of wrapped; the fixed height matches the 46pt mic/send
   * buttons beside it and keeps the single line vertically centred.
   */
  bandhuInput: { height: 46, paddingVertical: 0, textAlignVertical: "center" },
  iconBtn: {
    width: 46, height: 46, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.farmer, alignItems: "center", justifyContent: "center",
  },
});
