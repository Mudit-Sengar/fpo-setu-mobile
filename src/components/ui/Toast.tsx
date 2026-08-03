import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { colors, radius, spacing } from "../../theme";
import { Text } from "./Text";

/**
 * Replacement for `sonner` (web-only). Keeps the exact call-site API the web app
 * used — `toast.success(msg)`, `toast.message(msg)`, `toast.error(msg)` — via a
 * module-level singleton, so screen code ports over unchanged.
 */

type ToastKind = "success" | "message" | "error";
interface ToastItem { id: number; kind: ToastKind; text: string }

type Listener = (t: ToastItem) => void;
let listener: Listener | null = null;
let nextId = 1;

function emit(kind: ToastKind, text: string) {
  listener?.({ id: nextId++, kind, text });
}

export const toast = {
  success: (text: string) => emit("success", text),
  message: (text: string) => emit("message", text),
  error: (text: string) => emit("error", text),
};

const KIND_STYLE: Record<ToastKind, { bg: string; icon: React.ReactNode }> = {
  success: { bg: colors.farmer, icon: <CheckCircle2 size={16} color="#fff" /> },
  message: { bg: "#333842", icon: <Info size={16} color="#fff" /> },
  error: { bg: colors.destructive, icon: <XCircle size={16} color="#fff" /> },
};

function ToastRow({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onDone(item.id));
    }, 2600);
    return () => clearTimeout(timer);
  }, [anim, item.id, onDone]);

  const style = KIND_STYLE[item.kind];

  return (
    <Animated.View
      style={[
        s.toast,
        {
          backgroundColor: style.bg,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      {style.icon}
      <Pressable style={{ flex: 1 }} onPress={() => onDone(item.id)}>
        <Text size="xs" weight="600" color="#ffffff">{item.text}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Mount once at the app root (the web app rendered <Toaster/> in __root.tsx). */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listener = (t) => setItems((prev) => [...prev, t]);
    return () => { listener = null; };
  }, []);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[s.host, { top: insets.top + 8 }]}>
      {items.map((t) => <ToastRow key={t.id} item={t} onDone={remove} />)}
    </View>
  );
}

const s = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 100,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
