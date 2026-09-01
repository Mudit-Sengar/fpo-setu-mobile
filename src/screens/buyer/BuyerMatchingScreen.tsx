import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowDown, Layers, MapPin, Network, Package, Star, Users } from "lucide-react-native";
import { farmerRepo, fpoRepo, marketRepo, networkRepo, readinessRepo, requestRepo, reviewRepo } from "../../db";
import { describeWriteError } from "../../db/authz";
import type { RequestRow } from "../../db/repositories/requestRepository";
import { useDbQuery } from "../../db/useDbQuery";
import type { Buyer, FPO } from "../../db/types";
import type { PeerFarmer } from "../../db/repositories/farmerRepository";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { explainMatch, matchScore, type MatchBreakdown } from "../../lib/matching";
import { formatQuantity } from "../../lib/quantity";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Muted, Select, Text, toast,
} from "../../components/ui";
import { Meta } from "../../components/common";
import { ModeToggle, useBuyerMode } from "../../features/buyer-shared";
import { PendingConnectionsPanel } from "../../features/connections";

/**
 * Ported from the web app's src/routes/buyer.matching.tsx.
 *
 * Matching now runs against real `requests` rather than a table of FPO supply
 * nobody could reply to. Each card is somebody's open posting, so "Connect"
 * writes a `request_responses` row that appears in that party's inbox.
 *
 * NOTE: the "Max distance (km)" filter is gone. It used to filter on a distance
 * derived from a character of the FPO's id (`60 + (id.charCodeAt(4) % 7) * 45`),
 * so it was rejecting real FPOs on invented grounds. District is used instead
 * until the district-distance tables land.
 */
export function BuyerMatchingScreen() {
  const { mode } = useBuyerMode();
  return (
    <RoleShell accent="buyer" screenName="Connect with Farmer or FPO">
      <ModeToggle />
      {mode === "buyer" ? <BuyerMatching /> : <SupplierMatching />}
      {/* Accepted connections and their threads now live on the Messages tab —
          this stays the discovery/request surface. */}
      <PendingConnectionsPanel accent={colors.buyer} />
    </RoleShell>
  );
}

const COMMODITIES = ["Onion", "Tomato", "Soybean", "Tur", "Banana", "Turmeric", "Cotton", "Rice", "Mosambi", "Gram"];
const INPUT_CATEGORIES = ["Seeds", "Fertilizer", "Pesticide", "Bio-input", "Equipment rental", "Equipment sale"];

interface Candidate {
  request: RequestRow;
  fpo: FPO | undefined;
  breakdown: MatchBreakdown;
  rep: { rating: number; reviewCount: number } | undefined;
}

function BuyerMatching() {
  const { session, lang } = useApp();
  const fpos = useDbQuery<FPO[]>(() => fpoRepo.listFpos(), [], []);
  // The buyer's own registered commodity interests, so an FPO's matching
  // posting can surface without the buyer manually picking it first.
  const myProfile = useDbQuery<Buyer | null>(
    () => (session?.activeRole === "buyer" ? marketRepo.getBuyerById(session.profileId) : Promise.resolve(null)),
    [session?.profileId, session?.activeRole], null);

  const [latest, setLatest] = useState<RequestRow | null>(null);
  const [commodity, setCommodity] = useState(COMMODITIES[0]);
  const [commodityDefaulted, setCommodityDefaulted] = useState(false);
  const [grade, setGrade] = useState("A");
  const [qty, setQty] = useState("250");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (commodityDefaulted || latest != null || myProfile == null) return;
    const first = myProfile.commodities[0];
    if (first != null) setCommodity(first);
    setCommodityDefaulted(true);
  }, [commodityDefaulted, latest, myProfile]);

  // Reloads on focus so a demand just posted on the Home tab is picked up — that
  // form navigates straight here after posting.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void requestRepo.listMyRequests(session, "commodity_demand").then((ds) => {
      if (cancelled || ds.length === 0) return;
      const d = ds[0];
      setLatest(d);
      setCommodity(d.item);
      setGrade(d.grade === "" ? "A" : d.grade);
      setQty(String(d.qty));
    });
    return () => { cancelled = true; };
  }, [session]));

  const qtyNum = Number(qty) || 0;
  const myDistrict = latest?.district ?? "";

  // Open supply postings for this commodity, from anyone but the caller.
  const offers = useDbQuery<RequestRow[]>(
    () => requestRepo.listOpenRequests({
      kind: "commodity_supply", item: commodity, excludePartyId: session?.partyId,
    }),
    [commodity, session?.partyId],
    [],
  );

  // Real kilometres, from the precomputed district matrix.
  const distances = useDbQuery<Map<string, number>>(
    () => readinessRepo.distanceMatrix(), [], new Map());

  // Real ratings, from reviews written against delivered orders.
  const reputation = useDbQuery<Map<number, { rating: number; reviewCount: number }>>(
    () => reviewRepo.reputationByParty(), [], new Map());

  const candidates = useMemo<Candidate[]>(() => {
    return offers
      .map((request) => {
        const fpo = fpos.find((f) => f.id === request.authorEntityId);
        const rep = reputation.get(request.authorPartyId);
        const breakdown = matchScore({
          requiredQty: qtyNum,
          availableQty: request.qty,
          requiredGrade: grade,
          offeredGrade: request.grade,
          distanceKm: readinessRepo.kmBetween(distances, myDistrict, request.district),
          rating: rep?.rating,
          reviewCount: rep?.reviewCount,
        });
        return { request, fpo, breakdown, rep };
      })
      .sort((a, b) => b.breakdown.score - a.breakdown.score);
  }, [offers, fpos, qtyNum, grade, myDistrict, reputation, distances]);

  const fitsSingle = candidates.filter((c) => c.request.qty >= qtyNum);
  const needsCluster = fitsSingle.length === 0 && candidates.length > 0;

  // Greedy regional-cluster aggregation, now over real postings. The cluster is
  // still assembled per-render; persisting it is Phase 7's job.
  const cluster = useMemo(() => {
    if (!needsCluster) return null;
    const picked: Candidate[] = [];
    let total = 0;
    for (const c of candidates) {
      picked.push(c);
      total += c.request.qty;
      if (total >= qtyNum) break;
    }
    return { picked, total, anchor: picked[0] };
  }, [needsCluster, candidates, qtyNum]);

  async function respondTo(c: Candidate) {
    if (busyId != null) return;
    setBusyId(c.request.id);
    try {
      await requestRepo.respond(session, c.request.id, {
        message: `We would like to buy ${Math.min(qtyNum, c.request.qty)} MT of ${c.request.item}.`,
        offeredQty: Math.min(qtyNum, c.request.qty),
        offeredUnit: "MT",
      });
      toast.success(`${tr("Reply sent to", lang)} ${c.request.authorName}. ${tr("They can now accept or decline.", lang)}`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that reply."));
    } finally {
      setBusyId(null);
    }
  }

  async function connectToFpo(c: Candidate) {
    if (busyId != null) return;
    setBusyId(c.request.id);
    try {
      await networkRepo.requestConnection(session, {
        otherPartyId: c.request.authorPartyId,
        relationType: "trade",
        message: `We deal in ${c.request.item} and would like to connect.`,
        openThread: true,
      });
      toast.success(`${tr("Connection request sent to", lang)} ${c.request.authorName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setBusyId(null);
    }
  }

  // Farmers who grow this commodity, with the party id a connection needs.
  const farmerMatches = useDbQuery<PeerFarmer[]>(
    () => farmerRepo.listPeerFarmers(commodity, null, latest?.district ?? null),
    [commodity, latest?.district],
    [],
  );

  async function connectToFarmer(f: PeerFarmer) {
    if (busyId != null) return;
    setBusyId(-1);
    try {
      await networkRepo.requestConnection(session, {
        otherPartyId: f.partyId,
        relationType: "trade",
        message: `We are looking for ${commodity} and would like to buy from you directly.`,
        openThread: true,
      });
      toast.success(`${tr("Connection request sent to", lang)} ${f.name}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that request."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Network size={16} color={colors.buyer} />
            <CardTitle>Match filters</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Field label="Commodity">
            <Select value={commodity} onChange={setCommodity} options={COMMODITIES} />
          </Field>
          <Field label="Min grade"><Select value={grade} options={["A", "B"]} onChange={setGrade} /></Field>
          <Field label="Order quantity (MT)"><Input value={qty} onChangeText={setQty} keyboardType="numeric" /></Field>
          {latest != null && (
            <View style={{ flexDirection: "row" }}>
              <Badge color={colors.buyer} bg={colors.buyerSoft}>
                {`${tr("Delivery:", lang)} ${latest.windowLabel} · ${latest.district}`}
              </Badge>
            </View>
          )}
        </CardContent>
      </Card>

      {!needsCluster && fitsSingle.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{`${tr("Ranked FPO matches", lang)} (${fitsSingle.length})`}</CardTitle></CardHeader>
          <CardContent>
            {fitsSingle.slice(0, 4).map((c) => (
              <FpoCard key={c.request.id} c={c} busy={busyId === c.request.id}
                onRespond={() => respondTo(c)} onConnect={() => connectToFpo(c)} />
            ))}
          </CardContent>
        </Card>
      )}

      {needsCluster && cluster != null && (
        <Card style={{ borderColor: colors.buyer + "80", backgroundColor: colors.buyerSoft }}>
          <CardHeader>
            <View style={s.titleRow}>
              <Layers size={16} color={colors.buyer} />
              <CardTitle color={colors.buyer}>Regional Cluster recommended</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <Text size="sm">
              {"A single FPO can't meet your "}
              <Text size="sm" weight="700">{`${qtyNum} MT ${tr(commodity, lang)}`}</Text>
              {` ${tr("order. We assembled a regional cluster of", lang)} ${cluster.picked.length} ${tr("nearby FPOs:", lang)}`}
            </Text>

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {cluster.picked.map((c) => (
                <View key={c.request.id} style={s.clusterItem}>
                  <Text size="sm" weight="600">{c.request.authorName.split(" Farmer")[0]}</Text>
                  <Muted>{c.request.district}</Muted>
                  <Text size="xs" style={{ marginTop: 2 }}>
                    {`${c.request.qty} MT · ${tr("Grade", lang)} ${c.request.grade}`}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ alignItems: "center", marginVertical: spacing.sm }}>
              <ArrowDown size={22} color={colors.buyer} />
            </View>

            <View style={s.clusterNode}>
              <Text size="xxs" weight="700" color={colors.buyer}>REGIONAL CLUSTER</Text>
              <Text size="xxxl" weight="700">{`${cluster.total} MT`}</Text>
              <Muted>presented as ONE supply node</Muted>
              <View style={s.anchorBox}>
                <Text size="xs">
                  <Text size="xs" weight="700" color={colors.buyer}>{"Anchor FPO: "}</Text>
                  {cluster.anchor?.request.authorName}
                </Text>
                <Muted style={{ marginTop: 2 }}>Handles consolidation, quality &amp; communication.</Muted>
              </View>
              <Button full accent={colors.buyer} style={{ marginTop: spacing.md }}
                disabled={cluster.anchor == null || busyId != null}
                onPress={() => { if (cluster.anchor != null) void respondTo(cluster.anchor); }}>
                Reply to the cluster anchor
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {farmerMatches.length > 0 && (
        <Card>
          <CardHeader>
            <View style={s.titleRow}>
              <Users size={16} color={colors.buyer} />
              <CardTitle>Direct farmer matches</CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            {farmerMatches.slice(0, 4).map((f) => (
              <View key={f.id} style={s.itemCard}>
                <Text size="sm" weight="600">{f.name}</Text>
                <Muted>{`${f.village}, ${f.district} · ${f.landAcres} ${tr("ac", lang)}`}</Muted>
                <Text size="xs" style={{ marginTop: 2 }}>{`${tr("Crops", lang)}: ${f.crops.map((c) => tr(c, lang)).join(", ")}`}</Text>
                <Button full size="sm" accent={colors.buyer} style={{ marginTop: spacing.sm }}
                  disabled={busyId != null} onPress={() => connectToFarmer(f)}>
                  Connect
                </Button>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {candidates.length === 0 && (
        <Card><CardContent style={{ paddingTop: spacing.lg }}>
          <Muted center>
            No FPO has an open posting for this commodity. Try another commodity, or
            check back once FPOs have posted their supply.
          </Muted>
        </CardContent></Card>
      )}
    </>
  );
}

function SupplierMatching() {
  const { session, lang } = useApp();
  const [latest, setLatest] = useState<RequestRow | null>(null);
  const [category, setCategory] = useState(INPUT_CATEGORIES[1]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void requestRepo.listMyRequests(session, "input_supply").then((ps) => {
      if (cancelled || ps.length === 0) return;
      setLatest(ps[0]);
      setCategory(ps[0].category === "" ? INPUT_CATEGORIES[1] : ps[0].category);
    });
    return () => { cancelled = true; };
  }, [session]));

  // Every FPO's open input requirement in this category — not, as before, the
  // first seeded FPO's needs handed out round-robin to six unrelated FPOs.
  const needs = useDbQuery<RequestRow[]>(
    () => requestRepo.listOpenRequests({
      kind: "input_demand", category, excludePartyId: session?.partyId,
    }),
    [category, session?.partyId],
    [],
  );

  async function quote(r: RequestRow) {
    if (busyId != null) return;
    setBusyId(r.id);
    try {
      await requestRepo.respond(session, r.id, {
        message: `We can supply ${r.qtyLabel !== "" ? r.qtyLabel : `${r.qty} ${r.unit}`} of ${r.item}.`,
        offeredQty: r.qty,
        offeredUnit: r.unit,
      });
      toast.success(`${tr("Quote sent to", lang)} ${r.authorName}.`);
    } catch (e) {
      toast.error(describeWriteError(e, "Could not send that quote."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Network size={16} color={colors.buyer} />
            <CardTitle>Match filters</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          <Field label="Input category">
            <Select value={category} onChange={setCategory} options={INPUT_CATEGORIES} />
          </Field>
          {latest != null && (
            <View style={{ flexDirection: "row" }}>
              <Badge color={colors.buyer} bg={colors.buyerSoft}>
                {`${tr("Your posting:", lang)} ${formatQuantity(latest.qty, latest.unit, latest.qtyLabel)} ${tr(latest.item, lang)}`}
              </Badge>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Package size={16} color={colors.buyer} />
            <CardTitle>{`${tr("FPOs needing your inputs", lang)} (${needs.length})`}</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {needs.length === 0 && (
            <Muted>No FPO has an open requirement in this category right now.</Muted>
          )}
          {needs.map((r) => (
            <View key={r.id} style={s.itemCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{r.authorName}</Text>
                  <Muted>{r.district}</Muted>
                </View>
                {r.pendingCount > 0 && (
                  <Badge color={colors.mutedForeground} bg={colors.muted}>
                    {`${r.pendingCount} ${tr("quoted", lang)}`}
                  </Badge>
                )}
              </View>
              <Muted style={{ marginTop: spacing.sm }}>
                {"Needs: "}<Text size="xs" weight="600">{r.item}</Text>
              </Muted>
              <Muted>
                {`${tr("Qty:", lang)} ${formatQuantity(r.qty, r.unit, r.qtyLabel)}${r.windowLabel !== "" ? ` · ${tr("Window", lang)}: ${r.windowLabel}` : ""}`}
              </Muted>
              <Button size="sm" accent={colors.buyer} style={{ marginTop: spacing.sm }}
                disabled={busyId === r.id} onPress={() => quote(r)}>
                {busyId === r.id ? "Sending…" : "Send quote"}
              </Button>
            </View>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function FpoCard({
  c, busy, onRespond, onConnect,
}: { c: Candidate; busy: boolean; onRespond: () => void; onConnect: () => void }) {
  const { lang } = useApp();
  const { request, fpo, breakdown, rep } = c;
  const replied = request.responseCount > 0;

  return (
    <View style={s.itemCard}>
      <View style={s.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size="sm" weight="700">{request.authorName}</Text>
          <Muted>{fpo?.tagline ?? request.district}</Muted>
        </View>
        <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${breakdown.score}${tr("% match", lang)}`}</Badge>
      </View>

      <Muted style={{ marginTop: 4 }}>{explainMatch(breakdown, lang)}</Muted>

      <View style={s.metaGrid}>
        <Meta icon={<Layers size={12} color={colors.mutedForeground} />}
          label={`${request.qty} MT ${tr("available", lang)} · ${tr("Grade", lang)} ${request.grade}`} />
        <Meta icon={<MapPin size={12} color={colors.mutedForeground} />}
          label={request.district} />
        {/* The rating is computed from reviews against delivered orders — the
            fpos.reputation column it used to read was seeded and never written. */}
        <Meta icon={<Star size={12} color={colors.mutedForeground} />}
          label={rep == null || rep.reviewCount === 0
            ? tr("Not yet rated", lang)
            : `${rep.rating}★ (${rep.reviewCount} ${rep.reviewCount === 1 ? tr("review", lang) : tr("reviews", lang)})`} />
        {fpo != null && (
          <Meta icon={<Network size={12} color={colors.mutedForeground} />}
            label={`${fpo.tier} · ${fpo.members} ${tr("members", lang)}`} />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
        <Button size="sm" variant="outline" accent={colors.buyer}
          onPress={() => toast.message(`${request.authorName} — ${fpo?.tagline ?? request.item}`)}>
          View profile
        </Button>
        <Button size="sm" variant="outline" accent={colors.buyer} disabled={busy} onPress={onConnect}>
          Connect
        </Button>
        <Button size="sm" accent={colors.buyer} disabled={busy} onPress={onRespond}>
          {busy ? "Sending…" : replied ? "Update reply" : "Reply"}
        </Button>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  itemCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md, marginBottom: spacing.sm,
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  clusterItem: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.card, padding: spacing.md,
  },
  clusterNode: {
    borderWidth: 2, borderStyle: "dashed", borderColor: colors.buyer,
    borderRadius: radius.xl, backgroundColor: colors.background, padding: spacing.lg,
  },
  anchorBox: { backgroundColor: colors.buyerSoft, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
});
