import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { MessageCircle, Send, UserPlus } from "lucide-react-native";
import { networkRepo } from "../db";
import { describeWriteError } from "../db/authz";
import type { ConnectionRow, MessageRow, RelationType } from "../db/repositories/networkRepository";
import { useDbQuery } from "../db/useDbQuery";
import { useApp } from "../lib/app-state";
import { colors, radius, spacing } from "../theme";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Muted, Text, toast } from "../components/ui";

/**
 * The connections surface, shared by every persona.
 *
 * All four "Connect" buttons in this app used to end in a toast, so there was no
 * screen for the other side of one. This is that screen: requests you have sent,
 * requests waiting on you, and the thread attached to each accepted connection.
 *
 * One component rather than three because the data and the actions are identical
 * for a farmer, an FPO, a buyer and a supplier — only the accent colour differs.
 */

const RELATION_LABEL: Record<RelationType, string> = {
  trade: "Trade",
  supply: "Supply",
  peer: "Peer",
  advisory: "Advisory",
  service: "Service",
};

const KIND_LABEL: Record<string, string> = {
  farmer: "Farmer",
  fpo: "FPO",
  buyer: "Buyer",
  supplier: "Supplier",
  service_provider: "Advisor",
};

export function ConnectionsPanel({ accent }: { accent: string }) {
  const { session } = useApp();
  const connections = useDbQuery<ConnectionRow[]>(
    () => networkRepo.listConnections(session), [session?.partyId], []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openThread, setOpenThread] = useState<number | null>(null);

  async function decide(c: ConnectionRow, decision: "accepted" | "rejected" | "blocked") {
    if (busyId != null) return;
    setBusyId(c.id);
    try {
      await networkRepo.decideConnection(session, c.id, decision);
      toast.success(
        decision === "accepted" ? `Connected with ${c.otherName}.`
        : decision === "blocked" ? `Blocked ${c.otherName}.`
        : `Declined ${c.otherName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not record that decision."));
    } finally {
      setBusyId(null);
    }
  }

  async function withdraw(c: ConnectionRow) {
    if (busyId != null) return;
    setBusyId(c.id);
    try {
      await networkRepo.withdrawConnection(session, c.id);
      toast.success("Request withdrawn.");
    } catch (e) {
      toast.error(describeWriteError(e, "Could not withdraw that request."));
    } finally {
      setBusyId(null);
    }
  }

  const incoming = connections.filter((c) => c.status === "pending" && !c.outgoing);
  const outgoing = connections.filter((c) => c.status === "pending" && c.outgoing);
  const accepted = connections.filter((c) => c.status === "accepted");
  const closed = connections.filter((c) => ["rejected", "withdrawn", "blocked"].includes(c.status));

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <UserPlus size={16} color={accent} />
            <CardTitle>{`Requests waiting on you (${incoming.length})`}</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {incoming.length === 0 && <Muted>Nobody is waiting for a reply from you.</Muted>}
          {incoming.map((c) => (
            <View key={c.id} style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{c.otherName}</Text>
                  <Muted>{`${KIND_LABEL[c.otherKind] ?? c.otherKind} · ${RELATION_LABEL[c.relationType]}`}</Muted>
                </View>
                <Badge color="#ffffff" bg={accent}>Pending</Badge>
              </View>
              {c.message !== "" && <Text size="sm" style={{ marginTop: spacing.sm }}>{`"${c.message}"`}</Text>}
              <View style={s.actions}>
                <Button size="sm" accent={accent} disabled={busyId === c.id}
                  onPress={() => decide(c, "accepted")}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" accent={accent} disabled={busyId === c.id}
                  onPress={() => decide(c, "rejected")}>
                  Decline
                </Button>
                <Button size="sm" variant="ghost" accent={colors.destructive} disabled={busyId === c.id}
                  onPress={() => decide(c, "blocked")}>
                  Block
                </Button>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <MessageCircle size={16} color={accent} />
            <CardTitle>{`Your connections (${accepted.length})`}</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {accepted.length === 0 && (
            <Muted>No connections yet. Connect from a matching screen and they appear here.</Muted>
          )}
          {accepted.map((c) => (
            <View key={c.id} style={s.card}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{c.otherName}</Text>
                  <Muted>{`${KIND_LABEL[c.otherKind] ?? c.otherKind} · ${RELATION_LABEL[c.relationType]}`}</Muted>
                </View>
                {c.unreadCount > 0 && (
                  <Badge color="#ffffff" bg={accent}>{`${c.unreadCount} new`}</Badge>
                )}
              </View>
              {c.conversationId != null && (
                <Button variant="ghost" size="sm" accent={accent}
                  style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
                  onPress={() => setOpenThread(openThread === c.conversationId ? null : c.conversationId)}>
                  {openThread === c.conversationId ? "Hide messages" : "Messages"}
                </Button>
              )}
              {c.conversationId != null && openThread === c.conversationId && (
                <Thread conversationId={c.conversationId} accent={accent} />
              )}
            </View>
          ))}
        </CardContent>
      </Card>

      {outgoing.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{`Sent, awaiting a reply (${outgoing.length})`}</CardTitle></CardHeader>
          <CardContent>
            {outgoing.map((c) => (
              <View key={c.id} style={s.card}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text size="sm" weight="700">{c.otherName}</Text>
                    <Muted>{RELATION_LABEL[c.relationType]}</Muted>
                  </View>
                  <Button size="sm" variant="outline" accent={accent} disabled={busyId === c.id}
                    onPress={() => withdraw(c)}>
                    Withdraw
                  </Button>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {closed.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Closed</CardTitle></CardHeader>
          <CardContent>
            {closed.map((c) => (
              <View key={c.id} style={s.rowBetween}>
                <Text size="sm" style={{ flex: 1 }}>{c.otherName}</Text>
                <Badge color={colors.mutedForeground} bg={colors.muted}>
                  {c.status === "blocked" ? "Blocked" : c.status === "withdrawn" ? "Withdrawn" : "Declined"}
                </Badge>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/**
 * A real message thread.
 *
 * Replaces the simulated chat in ConnectScreen, which appended the user's line to
 * local state and then invented a reply 600ms later. Both sides are rows now, so
 * the other party sees what was said and can answer it.
 */
export function Thread({ conversationId, accent }: { conversationId: number; accent: string }) {
  const { session } = useApp();
  const messages = useDbQuery<MessageRow[]>(
    () => networkRepo.listMessages(session, conversationId),
    [conversationId, session?.partyId], []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (draft.trim() === "" || sending) return;
    setSending(true);
    try {
      await networkRepo.sendMessage(session, conversationId, draft);
      setDraft("");
      await networkRepo.markThreadRead(session, conversationId);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that message."));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={s.thread}>
      {messages.length === 0 && <Muted>No messages yet. Say hello.</Muted>}
      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
        <View style={{ gap: spacing.sm }}>
          {messages.map((m) => (
            <View key={m.id} style={{ alignItems: m.mine ? "flex-end" : "flex-start" }}>
              {!m.mine && <Muted>{m.senderName}</Muted>}
              <View style={[
                s.bubble,
                m.mine
                  ? { backgroundColor: accent }
                  : { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
              ]}>
                <Text size="xs" color={m.mine ? "#ffffff" : colors.foreground}>{m.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={s.composer}>
        <View style={{ flex: 1 }}>
          <Input value={draft} onChangeText={setDraft} placeholder="Type a message" />
        </View>
        <Pressable onPress={send} disabled={sending}
          style={[s.sendBtn, { backgroundColor: accent }, sending && { opacity: 0.5 }]}
          accessibilityRole="button" accessibilityLabel="Send">
          <Send size={14} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}

/** Unread notification count for the signed-in party. */
export function useUnreadCount(): number {
  const { session } = useApp();
  return useDbQuery<number>(
    () => networkRepo.countUnreadNotifications(session), [session?.partyId], 0);
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  thread: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.sm,
  },
  bubble: { maxWidth: "82%", borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  composer: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  sendBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
