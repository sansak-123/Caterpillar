import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { router } from "expo-router";

import { useIsWide } from "../theme/useLayout";
import { useColors } from "../theme/useColors";
import { PAGE_MAX_WIDTH, spacing, type } from "../theme/tokens";
import { Badge, type BadgeTone } from "./Badge";
import { ScreenBackground } from "./ScreenBackground";
import { ArrowLeftIcon } from "./icons";

// Bottom tab bar floats over content on the phone layout (see (tabs)/_layout.tsx).
const TAB_BAR_CLEARANCE = 72;

/** Scrollable page body: warm background, centered max-width column, reference-style
 * header (eyebrow · big title · subtitle · status pill on the right). */
export function Page({
  eyebrow,
  title,
  subtitle,
  status,
  right,
  showBack = false,
  scroll = true,
  children,
}: PropsWithChildren<{
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { label: string; tone: BadgeTone };
  right?: ReactNode;
  /** Show a "Back" link: `true` on the phone layout only (the sidebar covers wide
   * screens), `"always"` for pages the sidebar can't lead back to (e.g. a lesson). */
  showBack?: boolean | "always";
  /** false → children fill the remaining height (e.g. a chat with its own ScrollView). */
  scroll?: boolean;
}>) {
  const isWide = useIsWide();
  const header = (
    <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} status={status} right={right} showBack={showBack === "always" || (showBack === true && !isWide)} />
  );
  const padding: ViewStyle = {
    paddingHorizontal: isWide ? spacing.xl : spacing.md,
    paddingTop: isWide ? spacing.xl : spacing.md,
    paddingBottom: isWide ? spacing.xxl : spacing.xl + TAB_BAR_CLEARANCE,
  };

  if (!scroll) {
    return (
      <ScreenBackground>
        <View style={[styles.column, styles.fill, padding]}>
          {header}
          {children}
        </View>
      </ScreenBackground>
    );
  }
  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={padding} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {header}
          {children}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  status,
  right,
  showBack,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { label: string; tone: BadgeTone };
  right?: ReactNode;
  showBack?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <ArrowLeftIcon color={colors.textSecondary} size={14} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>Back</Text>
        </Pressable>
      ) : null}
      {eyebrow ? <Text style={[type.label, { color: colors.textSecondary }]}>{eyebrow.toUpperCase()}</Text> : null}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[type.display, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[type.caption, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {right ?? (status ? <Badge label={status.label} tone={status.tone} /> : null)}
      </View>
    </View>
  );
}

/** Two columns side by side on wide screens (main ~62%, side ~38%); stacked on phones. */
export function Columns({ main, side, sideWidth = 360 }: { main: ReactNode; side: ReactNode; sideWidth?: number }) {
  const isWide = useIsWide();
  if (!isWide) {
    return (
      <View style={styles.stack}>
        {main}
        {side}
      </View>
    );
  }
  return (
    <View style={styles.columns}>
      <View style={[styles.stack, styles.mainCol]}>{main}</View>
      <View style={[styles.stack, { width: sideWidth }]}>{side}</View>
    </View>
  );
}

/** Responsive grid: `cols` columns on wide screens, `phoneCols` on phones. */
export function Grid({ children, cols = 2, phoneCols = 1, gap = spacing.md }: PropsWithChildren<{ cols?: number; phoneCols?: number; gap?: number }>) {
  const isWide = useIsWide();
  const n = isWide ? cols : phoneCols;
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
  const rows: ReactNode[][] = [];
  items.forEach((child, i) => {
    if (i % n === 0) rows.push([]);
    rows[rows.length - 1].push(child);
  });
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap }}>
          {row.map((child, c) => (
            <View key={c} style={styles.gridCell}>
              {child}
            </View>
          ))}
          {Array.from({ length: n - row.length }).map((_, k) => (
            <View key={`pad-${k}`} style={styles.gridCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Section heading between cards ("Your modules", "Safety signals"). */
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[type.h2, { color: colors.textPrimary }]}>{title}</Text>
      {typeof right === "string" ? <Text style={[type.small, { color: colors.textMuted }]}>{right}</Text> : right}
    </View>
  );
}

/** Card heading block: small caps eyebrow, bold title, optional right slot. */
export function CardHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.cardHeader}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={[type.label, { color: colors.textSecondary, fontSize: 10 }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[type.h2, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[type.small, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Small rounded-square icon tile used at the start of rows and cards. */
export function IconTile({ children, bg, size = 34 }: PropsWithChildren<{ bg: string; size?: number }>) {
  return <View style={[styles.iconTile, { backgroundColor: bg, width: size, height: size }]}>{children}</View>;
}

/** Hairline divider. */
export function Divider() {
  const colors = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong }} />;
}

const styles = StyleSheet.create({
  column: {
    width: "100%",
    maxWidth: PAGE_MAX_WIDTH,
    alignSelf: "center",
    gap: spacing.md + 2,
  },
  fill: {
    flex: 1,
  },
  header: {
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  headerText: {
    flex: 1,
    minWidth: 200,
    gap: 4,
  },
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md + 2,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
  },
  stack: {
    gap: spacing.md + 2,
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconTile: {
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});
