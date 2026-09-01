import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { useApp } from "../../lib/app-state";
import { tr } from "../../lib/i18n";
import { colors, fontSize } from "../../theme";

/**
 * Drop-in replacement for RN's <Text> that auto-translates string children.
 *
 * This is the React Native equivalent of the web app's DomTranslator: instead of
 * walking DOM text nodes with a MutationObserver, we translate at render time.
 * Each string child is looked up independently — mirroring how the web version
 * translated each DOM Text node separately (so `<Text>Hi {name}</Text>` translates
 * the "Hi " segment and leaves the interpolated value alone, exactly as before).
 */
export interface TextProps extends RNTextProps {
  /** Font size token or explicit number. */
  size?: keyof typeof fontSize | number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  center?: boolean;
  /** Skip translation (for user-entered content that must stay verbatim). */
  noTranslate?: boolean;
}

// Caps how far Android's system "Font size" + "Display size" accessibility
// settings can scale this text. Without a cap, a phone set to the largest
// accessibility font size can grow text past 2x, which overruns every
// fixed-width/fixed-height container in the app. 1.3x still gives a real
// accessibility benefit while staying inside what the layouts below were
// built to tolerate. Screens that truly need the OS default can still pass
// `maxFontSizeMultiplier` through `...rest`.
const DEFAULT_MAX_FONT_SCALE = 1.3;

export function Text({
  children,
  size = "base",
  weight,
  color = colors.foreground,
  center,
  noTranslate,
  style,
  maxFontSizeMultiplier = DEFAULT_MAX_FONT_SCALE,
  ...rest
}: TextProps) {
  const { lang } = useApp();

  const translate = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") return noTranslate ? node : tr(node, lang);
    if (Array.isArray(node)) return node.map((c, i) => <React.Fragment key={i}>{translate(c)}</React.Fragment>);
    return node;
  };

  const resolvedSize = typeof size === "number" ? size : fontSize[size];

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        // RN scales a numeric lineHeight together with fontSize under Android's
        // font-size accessibility setting, so this stays proportional as the
        // system font grows — `maxFontSizeMultiplier` above is what keeps that
        // growth from overrunning fixed-size containers elsewhere in the app.
        { fontSize: resolvedSize, color, lineHeight: Math.round(resolvedSize * 1.4) },
        weight ? { fontWeight: weight } : null,
        center ? { textAlign: "center" as const } : null,
        style,
      ]}
      {...rest}
    >
      {translate(children)}
    </RNText>
  );
}

/** Muted secondary text — the web app's `text-muted-foreground` equivalent. */
export function Muted(props: TextProps) {
  return <Text size="xs" color={colors.mutedForeground} {...props} />;
}
