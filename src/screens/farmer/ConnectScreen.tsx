import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { FarmerTabParamList } from "../../navigation/types";
import { Handshake, MapPin, MessageCircle, Network, Send, Users2 } from "lucide-react-native";
import { useSessionFarmer } from "../../lib/useSessionProfile";
import { farmerRepo, networkRepo, readinessRepo, requestRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { PeerFarmer } from "../../db/repositories/farmerRepository";
import type { RequestRow } from "../../db/repositories/requestRepository";
import { useDbQuery } from "../../db/useDbQuery";
import { useApp } from "../../lib/app-state";
import { explainMatch, matchScore } from "../../lib/matching";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Field, Input, Muted, Select, Text, toast,
} from "../../components/ui";
import { EmptyHint, Pill, SectionCard, SectionCardRow } from "../../components/common";
import { ConnectionsPanel } from "../../features/connections";
import { useFarmerBack } from "../../hooks/useFarmerBack";

type Sub = null | "buyers" | "farmers" | "network";

/** Ported from the web app's src/routes/farmer.connect.tsx */
export function ConnectScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<FarmerTabParamList, "Connect">>();
  const goBack = useFarmerBack();
  const [sub, setSub] = useState<Sub>(null);

  // Section deep-link, used by Krishi Bandhu ("sell my onions" -> buyers).
  useEffect(() => {
    const p = route.params?.sub;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing a nav-param deep link into local tab state; intentional (see navigation/types.ts SectionParams).
    if (p === "buyers" || p === "farmers") setSub(p);
  }, [route.params?.sub, route.params?.req]);

  return (
    <RoleShell accent="farmer" screenName="Connect" onBack={goBack} onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <SectionCardRow>
        <SectionCard active={sub === "buyers"} accent={colors.farmer} title="Connect with Buyers"
          onPress={() => setSub(sub === "buyers" ? null : "buyers")}
          icon={<Handshake size={22} color={sub === "buyers" ? "#fff" : colors.farmer} />} />
        <SectionCard active={sub === "farmers"} accent={colors.farmer} title="Connect with Similar Farmers"
          onPress={() => setSub(sub === "farmers" ? null : "farmers")}
          icon={<Users2 size={22} color={sub === "farmers" ? "#fff" : colors.farmer} />} />
        <SectionCard active={sub === "network"} accent={colors.farmer} title="My Network"
          onPress={() => setSub(sub === "network" ? null : "network")}
          icon={<Network size={22} color={sub === "network" ? "#fff" : colors.farmer} />} />
      </SectionCardRow>

      {sub === null && <EmptyHint>Pick how you want to connect.</EmptyHint>}
      {sub === "buyers" && <ConnectBuyers />}
      {sub === "farmers" && <ConnectFarmers />}
      {sub === "network" && <ConnectionsPanel accent={colors.farmer} />}
    </RoleShell>
  );
}

/**
 * Buyers with an open requirement for something this farmer grows.
 *
 * This used to read `farmer_buyer_matches`, a table whose "buyer" was a name in a
 * text column — the same four rows for every farmer, and no way to reach anyone.
 * These are real open demands from real buyers, so the farmer can either answer
 * the posting or ask to connect.
 */
function ConnectBuyers() {
  const { session } = useApp();
  const me = useSessionFarmer();
  const crops = me?.crops ?? [];

  const demands = useDbQuery<RequestRow[]>(
    async () => {
      const lists = await Promise.all(crops.map((c) =>
        requestRepo.listOpenRequests({
          kind: "commodity_demand", item: c, excludePartyId: session?.partyId,
        })));
      return lists.flat();
    },
    [crops.join(","), session?.partyId],
    [],
  );

  const [busyId, setBusyId] = useState<number | null>(null);
  const [msgFor, setMsgFor] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  async function reply(d: RequestRow) {
    if (busyId != null) return;
    setBusyId(d.id);
    try {
      await requestRepo.respond(session, d.id, { message: msg.trim() === "" ? null : msg.trim() });
      setMsgFor(null);
      toast.success(`Reply sent to ${d.authorName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that reply."));
    } finally {
      setBusyId(null);
    }
  }

  async function connect(d: RequestRow) {
    if (busyId != null) return;
    setBusyId(d.id);
    try {
      await networkRepo.requestConnection(session, {
        otherPartyId: d.authorPartyId,
        relationType: "trade",
        message: `Namaste, I grow ${d.item} and would like to discuss supplying you.`,
        originRequestId: d.id,
        openThread: true,
      });
      toast.success(`Connection request sent to ${d.authorName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="sm">
            For larger farmers who want to sell directly to a buyer instead of through an FPO. Below are buyers with open requirements matching your crops.
          </Text>
        </CardContent>
      </Card>

      {demands.length === 0 && (
        <Card><CardContent style={{ paddingTop: spacing.lg }}>
          <Muted center>No buyer has an open requirement for your crops right now.</Muted>
        </CardContent></Card>
      )}

      {demands.map((b) => (
        <Card key={b.id}>
          <CardContent style={{ paddingTop: spacing.lg }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="700">{b.authorName}</Text>
                <View style={s.metaLine}>
                  <MapPin size={12} color={colors.mutedForeground} />
                  <Muted>{b.district}</Muted>
                </View>
              </View>
              <Badge color="#ffffff" bg={colors.farmer}>Open</Badge>
            </View>

            <View style={s.pillRow}>
              <Pill k="Crop" v={b.item} />
              <Pill k="Grade" v={b.grade === "" ? "Any" : b.grade} />
              <Pill k="Qty" v={`${b.qty} ${b.unit}`} />
            </View>

            {b.windowLabel !== "" && (
              <Muted style={{ marginTop: spacing.sm }}>
                {"Needed by: "}
                <Text size="xs">{b.windowLabel}</Text>
              </Muted>
            )}

            <View style={s.actions}>
              <Button size="sm" accent={colors.farmer} disabled={busyId === b.id}
                icon={<MessageCircle size={12} color="#ffffff" />}
                onPress={() => { setMsgFor(b.id); setMsg(`Namaste, I have ${b.item} matching your requirement.`); }}>
                Reply
              </Button>
              <Button size="sm" variant="outline" accent={colors.farmer} disabled={busyId === b.id}
                onPress={() => connect(b)}>
                Connect
              </Button>
            </View>

            {msgFor === b.id && (
              <View style={s.inlineForm}>
                <Field label={`Message to ${b.authorName}`}>
                  <Input value={msg} onChangeText={setMsg} multiline numberOfLines={3} />
                </Field>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                  <Button variant="ghost" size="sm" onPress={() => setMsgFor(null)}>Cancel</Button>
                  <Button size="sm" accent={colors.farmer} icon={<Send size={12} color="#ffffff" />}
                    disabled={busyId === b.id} onPress={() => reply(b)}>
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

/**
 * Other farmers growing the same crop.
 *
 * The list is real farmers now, and connecting opens a real thread. The previous
 * version listed six people who existed only in a display table and answered
 * every message with the same canned line after a 600ms timer.
 */
function ConnectFarmers() {
  const { session } = useApp();
  const me = useSessionFarmer();
  const [crop, setCrop] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Default the crop filter to the farmer's first crop once they load.
  useEffect(() => {
    if (me != null && crop === "") setCrop(me.crops[0] ?? "");
  }, [me, crop]);

  const distances = useDbQuery<Map<string, number>>(
    () => readinessRepo.distanceMatrix(), [], new Map());
  const peers = useDbQuery<PeerFarmer[]>(
    () => (crop === "" ? Promise.resolve([]) : farmerRepo.listPeerFarmers(crop, me?.id ?? null, me?.district ?? null)),
    [crop, me?.id, me?.district],
    [],
  );

  async function connect(f: PeerFarmer) {
    if (busyId != null) return;
    setBusyId(f.id);
    try {
      await networkRepo.requestConnection(session, {
        otherPartyId: f.partyId,
        relationType: "peer",
        message: `Namaste ${f.name.split(" ")[0]}, I also grow ${crop}. Shall we pool our harvest?`,
        openThread: true,
      });
      toast.success(`Request sent to ${f.name}. You can talk once they accept.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card style={{ borderColor: colors.farmer + "4D", backgroundColor: colors.farmerSoft }}>
        <CardContent style={{ paddingTop: spacing.lg }}>
          <Text size="sm">
            Find farmers growing the same crop so you can collectively sell a large order to exporters or processors. Accepted connections appear under My Network.
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Search filters</CardTitle></CardHeader>
        <CardContent>
          <Field label="Crop">
            <Select value={crop} options={me?.crops ?? []} onChange={setCrop} />
          </Field>
          {/* Grade and quality filters were removed with the display table that
              carried them: they describe produce, not a person. They return when
              farmers can post their own supply. */}
          <Muted>Farmers in your district are listed first.</Muted>
        </CardContent>
      </Card>

      {peers.length === 0 && (
        <Card><CardContent style={{ paddingTop: spacing.lg }}>
          <Muted center>No other farmer is growing {crop === "" ? "this crop" : crop} yet.</Muted>
        </CardContent></Card>
      )}

      {peers.map((f) => {
        const breakdown = matchScore({
          requiredQty: 0, availableQty: f.landAcres,
          distanceKm: readinessRepo.kmBetween(distances, me?.district, f.district),
        });
        return (
          <Card key={f.id}>
            <CardContent style={{ paddingTop: spacing.lg }}>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{f.name}</Text>
                  <View style={s.metaLine}>
                    <MapPin size={12} color={colors.mutedForeground} />
                    <Muted>{`${f.village}, ${f.district}`}</Muted>
                  </View>
                </View>
                <Badge color={colors.farmer} bg={colors.farmerSoft}>{`${f.landAcres} ac`}</Badge>
              </View>

              <View style={s.pillRow}>
                <Pill k="Crops" v={f.crops.join(", ")} />
              </View>
              <Muted style={{ marginTop: spacing.sm }}>{explainMatch(breakdown)}</Muted>

              <Button full size="sm" accent={colors.farmer} style={{ marginTop: spacing.sm }}
                disabled={busyId === f.id}
                icon={<MessageCircle size={12} color="#ffffff" />}
                onPress={() => connect(f)}>
                {busyId === f.id ? "Sending…" : "Connect"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  metaLine: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  inlineForm: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.mutedBg, padding: spacing.md, marginTop: spacing.md,
  },
});
