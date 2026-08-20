import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { FarmerTabParamList } from "../../navigation/types";
import { BookOpen, Play, Trophy } from "lucide-react-native";
import { imgSource, type Thumb } from "../../lib/mockData";
import { contentRepo } from "../../db";
import { keyToThumb } from "../../db/assets";
import { useDbQuery } from "../../db/useDbQuery";
import { colors, radius, spacing } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { Card, CardContent, CardHeader, CardTitle, Dialog, Muted } from "../../components/ui";
import { EmptyHint, SectionCard, SectionCardRow, VideoCard } from "../../components/common";
import { useFarmerBack } from "../../hooks/useFarmerBack";

interface V { title: string; duration: string; transcript: string; thumb: Thumb }

/** Ported from the web app's src/routes/farmer.learn.tsx */
export function LearnScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<FarmerTabParamList, "Learn">>();
  const goBack = useFarmerBack();
  const [tab, setTab] = useState<null | "courses" | "stories">(null);
  const [open, setOpen] = useState<V | null>(null);

  const courseRows = useDbQuery(() => contentRepo.listCourses("farmer"), [], []);
  const storyRows = useDbQuery(() => contentRepo.listStories(), [], []);

  const courses: V[] = courseRows.map((c) => ({
    title: c.name,
    duration: c.duration ?? "",
    transcript: c.transcript ?? "",
    thumb: c.thumb,
  }));
  const stories: V[] = storyRows.map((s) => ({
    title: s.title,
    duration: s.duration,
    transcript: s.transcript,
    thumb: keyToThumb(s.thumbKey),
  }));

  // Section deep-link, used by Krishi Bandhu ("success stories" -> stories).
  useEffect(() => {
    const p = route.params?.sub;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing a nav-param deep link into local tab state; intentional (see navigation/types.ts SectionParams).
    if (p === "courses" || p === "stories") setTab(p);
  }, [route.params?.sub, route.params?.req]);

  return (
    <RoleShell accent="farmer" screenName="Learn" onBack={goBack} onOpenFarmerProfile={() => nav.getParent()?.navigate("FarmerProfile" as never)}>
      <SectionCardRow>
        <SectionCard active={tab === "courses"} accent={colors.farmer} title="Courses"
          onPress={() => setTab(tab === "courses" ? null : "courses")}
          icon={<BookOpen size={22} color={tab === "courses" ? "#fff" : colors.farmer} />} />
        <SectionCard active={tab === "stories"} accent={colors.farmer} title="Success Stories"
          onPress={() => setTab(tab === "stories" ? null : "stories")}
          icon={<Trophy size={22} color={tab === "stories" ? "#fff" : colors.farmer} />} />
      </SectionCardRow>

      {tab === null && <EmptyHint>Tap a button above to begin.</EmptyHint>}

      {tab === "courses" && (
        <Card>
          <CardHeader>
            <CardTitle>Foundational courses · learn about FPOs</CardTitle>
          </CardHeader>
          <CardContent>
            <Muted style={{ marginBottom: spacing.sm }}>Follow the sequence — each course builds on the previous.</Muted>
            <View style={{ gap: spacing.md }}>
              {courses.map((v, i) => (
                <VideoCard key={v.title} title={v.title} duration={v.duration} thumb={v.thumb}
                  index={i + 1} accent={colors.farmer} onPress={() => setOpen(v)} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      {tab === "stories" && (
        <Card>
          <CardHeader><CardTitle>Success stories from FPO members</CardTitle></CardHeader>
          <CardContent>
            <View style={{ gap: spacing.md }}>
              {stories.map((v) => (
                <VideoCard key={v.title} title={v.title} duration={v.duration} thumb={v.thumb}
                  accent={colors.farmer} onPress={() => setOpen(v)} />
              ))}
            </View>
          </CardContent>
        </Card>
      )}

      <Dialog visible={open != null} onClose={() => setOpen(null)} title={open?.title}>
        {open != null && (
          <>
            <View style={s.hero}>
              <Image source={imgSource(open.thumb)} style={s.heroImage} resizeMode="cover" />
              <View style={s.heroOverlay}>
                <Play size={40} color="#ffffff" fill="#ffffff" />
              </View>
            </View>
            <Muted>{open.transcript}</Muted>
          </>
        )}
      </Dialog>
    </RoleShell>
  );
}

const s = StyleSheet.create({
  hero: { height: 180, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.muted },
  heroImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.28)",
  },
});
