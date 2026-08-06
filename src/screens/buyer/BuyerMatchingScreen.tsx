import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowDown, Layers, MapPin, Network, Package, Star, Users } from "lucide-react-native";
import { farmerRepo, fpoRepo } from "../../db";
import { useDbQuery } from "../../db/useDbQuery";
import type { Farmer, FPO, FPOSupply, InputNeed } from "../../db/types";
import {
  DEFAULT_DEMAND, DEFAULT_SUPPLY, loadDemands, loadSupplies,
  type Demand, type SupplyPost,
} from "../../lib/buyer-storage";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Muted, Select, Text, toast,
} from "../../components/ui";
import { Meta } from "../../components/common";
import { ModeToggle, Stepper, type Mode } from "../../features/buyer-shared";

/** Ported from the web app's src/routes/buyer.matching.tsx */
export function BuyerMatchingScreen() {
  const [mode, setMode] = useState<Mode>("buyer");
  return (
    <RoleShell accent="buyer" screenName="Connect with Farmer or FPO" header={<Stepper />}>
      <ModeToggle mode={mode} setMode={setMode} />
      {mode === "buyer" ? <BuyerMatching /> : <SupplierMatching />}
    </RoleShell>
  );
}

interface Candidate { fpo: FPO; supply: FPOSupply; dist: number }

function BuyerMatching() {
  const [fpos] = useDbQuery<FPO[]>(() => fpoRepo.listFpos(), [], []);
  const [farmers] = useDbQuery<Farmer[]>(() => farmerRepo.listFarmers(), [], []);
  const [latest, setLatest] = useState<Demand>(DEFAULT_DEMAND);
  const [commodity, setCommodity] = useState(DEFAULT_DEMAND.commodity);
  const [grade, setGrade] = useState(DEFAULT_DEMAND.grade);
  const [qty, setQty] = useState(String(DEFAULT_DEMAND.qty_mt));
  const [maxKm, setMaxKm] = useState("400");

  // The web app read localStorage synchronously during render. AsyncStorage is
  // async, so we reload on focus — which also picks up a demand just posted on
  // the Home tab, matching the web behaviour of navigating straight here.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void loadDemands().then((ds) => {
      if (cancelled) return;
      const d = ds[0] ?? DEFAULT_DEMAND;
      setLatest(d);
      setCommodity(d.commodity);
      setGrade(d.grade);
      setQty(String(d.qty_mt));
    });
    return () => { cancelled = true; };
  }, []));

  const qtyNum = Number(qty) || 0;
  const kmNum = Number(maxKm) || 0;

  // Matching logic preserved verbatim from the web app, including the
  // pseudo-random distance derived from the FPO id character code.
  const candidates = useMemo<Candidate[]>(() => {
    return fpos
      .map((f) => {
        const sup = f.supply.find((x) => x.commodity.toLowerCase() === commodity.toLowerCase());
        if (!sup) return null;
        const dist = 60 + (f.id.charCodeAt(4) % 7) * 45;
        const gradeMatch = grade === "A" ? sup.grade === "A" || sup.grade === "Sortex" || sup.grade === "Export" : true;
        if (!gradeMatch) return null;
        return { fpo: f, supply: sup, dist };
      })
      .filter((c): c is Candidate => c !== null)
      .filter((c) => c.dist <= kmNum)
      .sort((a, b) => b.supply.qty_mt - a.supply.qty_mt);
  }, [fpos, commodity, grade, kmNum]);

  const fitsSingle = candidates.filter((c) => c.supply.qty_mt >= qtyNum);
  const needsCluster = fitsSingle.length === 0 && candidates.length > 0;

  // Greedy regional-cluster aggregation — preserved verbatim.
  const cluster = useMemo(() => {
    if (!needsCluster) return null;
    const picked: Candidate[] = [];
    let total = 0;
    for (const c of candidates) {
      picked.push(c);
      total += c.supply.qty_mt;
      if (total >= qtyNum) break;
    }
    return { picked, total, anchor: picked[0]?.fpo };
  }, [needsCluster, candidates, qtyNum]);

  const farmerMatches = farmers.filter((f) => f.crops.includes(commodity)).slice(0, 3);

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
            <Select value={commodity} onChange={setCommodity}
              options={["Onion", "Tomato", "Soybean", "Tur", "Banana", "Turmeric", "Cotton", "Rice", "Mosambi", "Gram"]} />
          </Field>
          <Field label="Min grade"><Select value={grade} options={["A", "B"]} onChange={setGrade} /></Field>
          <Field label="Order quantity (MT)"><Input value={qty} onChangeText={setQty} keyboardType="numeric" /></Field>
          <Field label="Max distance (km)"><Input value={maxKm} onChangeText={setMaxKm} keyboardType="numeric" /></Field>
          <View style={{ flexDirection: "row" }}>
            <Badge color={colors.buyer} bg={colors.buyerSoft}>{`Delivery: ${latest.delivery} · ${latest.location}`}</Badge>
          </View>
        </CardContent>
      </Card>

      {!needsCluster && fitsSingle.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{`Ranked FPO matches (${fitsSingle.length})`}</CardTitle></CardHeader>
          <CardContent>
            {fitsSingle.slice(0, 4).map((c, i) => <FpoCard key={c.fpo.id} c={c} score={94 - i * 6} />)}
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
              <Text size="sm" weight="700">{`${qtyNum} MT ${commodity}`}</Text>
              {` order. We assembled a regional cluster of ${cluster.picked.length} nearby FPOs:`}
            </Text>

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {cluster.picked.map((c) => (
                <View key={c.fpo.id} style={s.clusterItem}>
                  <Text size="sm" weight="600">{c.fpo.name.split(" Farmer")[0]}</Text>
                  <Muted>{`${c.fpo.district} · ${c.dist} km`}</Muted>
                  <Text size="xs" style={{ marginTop: 2 }}>{`${c.supply.qty_mt} MT · Grade ${c.supply.grade}`}</Text>
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
                  {cluster.anchor?.name}
                </Text>
                <Muted style={{ marginTop: 2 }}>Handles consolidation, quality & communication.</Muted>
              </View>
              <Button full accent={colors.buyer} style={{ marginTop: spacing.md }}
                onPress={() => toast.success("Connection request sent to the cluster anchor.")}>
                Connect with cluster
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
            {farmerMatches.map((f) => (
              <View key={f.id} style={s.itemCard}>
                <Text size="sm" weight="600">{f.name}</Text>
                <Muted>{`${f.village}, ${f.district} · ${f.landAcres} ac`}</Muted>
                <Text size="xs" style={{ marginTop: 2 }}>{`Crops: ${f.crops.join(", ")}`}</Text>
                <Button full size="sm" accent={colors.buyer} style={{ marginTop: spacing.sm }}
                  onPress={() => toast.success(`Connection request sent to ${f.name}.`)}>
                  Connect
                </Button>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {candidates.length === 0 && (
        <Card><CardContent style={{ paddingTop: spacing.lg }}>
          <Muted center>No FPOs match these filters. Try increasing distance or relaxing grade.</Muted>
        </CardContent></Card>
      )}
    </>
  );
}

function SupplierMatching() {
  const [fpos] = useDbQuery<FPO[]>(() => fpoRepo.listFpos(), [], []);
  const [farmers] = useDbQuery<Farmer[]>(() => farmerRepo.listFarmers(), [], []);
  const [latest, setLatest] = useState<SupplyPost>(DEFAULT_SUPPLY);
  const [category, setCategory] = useState(DEFAULT_SUPPLY.category);
  const [maxKm, setMaxKm] = useState("400");

  // Input needs come from the active FPO's list; the first seeded FPO owns them.
  const [allNeeds] = useDbQuery<InputNeed[]>(
    () => (fpos[0] != null ? fpoRepo.listInputNeeds(fpos[0].id) : Promise.resolve([])),
    [fpos], [],
  );

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void loadSupplies().then((ps) => {
      if (cancelled) return;
      const p = ps[0] ?? DEFAULT_SUPPLY;
      setLatest(p);
      setCategory(p.category);
    });
    return () => { cancelled = true; };
  }, []));

  const kmNum = Number(maxKm) || 0;
  const matchingNeeds = useMemo(
    () => allNeeds.filter((n) => n.category === category),
    [allNeeds, category],
  );

  const matchedFpos = useMemo(() => {
    return fpos.slice(0, 6).map((f, i) => ({
      fpo: f,
      need: matchingNeeds[i % Math.max(1, matchingNeeds.length)] ?? matchingNeeds[0],
      dist: 40 + i * 35,
      score: 95 - i * 7,
    })).filter((m) => m.dist <= kmNum && m.need);
  }, [fpos, matchingNeeds, kmNum]);

  const farmerMatches = farmers.slice(0, 3).map((f, i) => ({ farmer: f, dist: 20 + i * 30, score: 88 - i * 5 }));

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
            <Select value={category} onChange={setCategory}
              options={["Seeds", "Fertilizer", "Pesticide", "Bio-input", "Equipment rental", "Equipment sale"]} />
          </Field>
          <Field label="Max distance (km)"><Input value={maxKm} onChangeText={setMaxKm} keyboardType="numeric" /></Field>
          <View style={{ flexDirection: "row" }}>
            <Badge color={colors.buyer} bg={colors.buyerSoft}>
              {`Posting: ${latest.qty} ${latest.item} · ${latest.pricePerUnit}`}
            </Badge>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Package size={16} color={colors.buyer} />
            <CardTitle>{`FPOs needing your inputs (${matchedFpos.length})`}</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {matchedFpos.map((m) => (
            <View key={m.fpo.id} style={s.itemCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size="sm" weight="700">{m.fpo.name}</Text>
                  <Muted>{`${m.fpo.district} · ${m.dist} km`}</Muted>
                </View>
                <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${m.score}% match`}</Badge>
              </View>
              <Muted style={{ marginTop: spacing.sm }}>
                {"Needs: "}<Text size="xs" weight="600">{m.need.item}</Text>
              </Muted>
              <Muted>{`Qty: ${m.need.qty} · Window: ${m.need.window}`}</Muted>
              <Button size="sm" accent={colors.buyer} style={{ marginTop: spacing.sm }}
                onPress={() => toast.success(`Quote sent to ${m.fpo.name}.`)}>
                Connect
              </Button>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View style={s.titleRow}>
            <Users size={16} color={colors.buyer} />
            <CardTitle>Direct farmer matches</CardTitle>
          </View>
        </CardHeader>
        <CardContent>
          {farmerMatches.map((m) => (
            <View key={m.farmer.id} style={s.itemCard}>
              <View style={s.rowBetween}>
                <Text size="sm" weight="600" style={{ flex: 1 }}>{m.farmer.name}</Text>
                <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${m.score}%`}</Badge>
              </View>
              <Muted>{`${m.farmer.village}, ${m.farmer.district} · ${m.dist} km`}</Muted>
              <Text size="xs" style={{ marginTop: 2 }}>{`Crops: ${m.farmer.crops.join(", ")} · ${m.farmer.landAcres} ac`}</Text>
              <Button full size="sm" accent={colors.buyer} style={{ marginTop: spacing.sm }}
                onPress={() => toast.success(`Quote sent to ${m.farmer.name}.`)}>
                Connect
              </Button>
            </View>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function FpoCard({ c, score }: { c: Candidate; score: number }) {
  return (
    <View style={s.itemCard}>
      <View style={s.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size="sm" weight="700">{c.fpo.name}</Text>
          <Muted>{c.fpo.tagline}</Muted>
        </View>
        <Badge color={colors.buyerForeground} bg={colors.buyer}>{`${score}% match`}</Badge>
      </View>
      <View style={s.metaGrid}>
        <Meta icon={<Layers size={12} color={colors.mutedForeground} />} label={`${c.supply.qty_mt} MT available · Grade ${c.supply.grade}`} />
        <Meta icon={<MapPin size={12} color={colors.mutedForeground} />} label={`${c.dist} km · ${c.fpo.district}`} />
        <Meta icon={<Star size={12} color={colors.mutedForeground} />} label={`${c.fpo.reputation}★ (${c.fpo.reviews} reviews)`} />
        <Meta icon={<Network size={12} color={colors.mutedForeground} />} label={`${c.fpo.tier} · ${c.fpo.members} members`} />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <Button size="sm" variant="outline" accent={colors.buyer}
          onPress={() => toast.message(`${c.fpo.name} — ${c.fpo.tagline}`)}>
          View profile
        </Button>
        <Button size="sm" accent={colors.buyer}
          onPress={() => toast.success(`Connection request sent to ${c.fpo.name}.`)}>
          Connect
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
