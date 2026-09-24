import type { PropsWithChildren, ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { router, usePathname, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEMO_MACHINE_ID } from "../lib/api/client";
import { useAuthStore } from "../store/auth";
import { useConnectivityStore } from "../store/connectivity";
import { useIsWide } from "../theme/useLayout";
import { useColors } from "../theme/useColors";
import { radius, spacing, type } from "../theme/tokens";
import { ConnectivityPill } from "./ConnectivityPill";
import {
  BellIcon,
  BookIcon,
  ChatIcon,
  ClipboardIcon,
  ClockIcon,
  FlaskIcon,
  GridIcon,
  HardHatIcon,
  PinIcon,
  PulseIcon,
  RadioIcon,
  ShieldIcon,
  TruckIcon,
} from "./icons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

// Demo persona + site shown in the shell chrome (there is no real login/profile yet —
// see README "known gaps"). The operator id itself comes from the live session.
export const DEMO_OPERATOR_NAME = "James Mitchell";
export const DEMO_SITE = { name: "North Ridge Construction", sector: "Sector B" };
export const DEMO_MACHINE_MODEL = "CAT 320 GX";

type NavItem = {
  label: string;
  href: Href;
  match: (path: string) => boolean;
  icon: (color: string) => ReactNode;
  live?: boolean;
};

const NAV: NavItem[] = [
  { label: "Today", href: "/", match: (p) => p === "/", icon: (c) => <GridIcon color={c} size={17} /> },
  { label: "Live safety", href: "/safety", match: (p) => p.startsWith("/safety"), icon: (c) => <RadioIcon color={c} size={17} />, live: true },
  { label: "Pre-start check", href: "/checklist", match: (p) => p.startsWith("/checklist"), icon: (c) => <ClipboardIcon color={c} size={17} /> },
  {
    label: "Training",
    href: "/training",
    match: (p) => p.startsWith("/training") || p.startsWith("/lesson") || p.startsWith("/simulator"),
    icon: (c) => <BookIcon color={c} size={17} />,
  },
  { label: "Shift log", href: "/shift-log", match: (p) => p.startsWith("/shift-log"), icon: (c) => <ClockIcon color={c} size={17} /> },
  { label: "Assistant", href: "/assistant", match: (p) => p.startsWith("/assistant"), icon: (c) => <ChatIcon color={c} size={17} /> },
  { label: "Supervisor", href: "/supervisor", match: (p) => p.startsWith("/supervisor"), icon: (c) => <PulseIcon color={c} size={17} /> },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** App chrome: sidebar + top bar on wide screens; a slim top bar on phones (where the
 * bottom tab bar handles navigation). Purely presentational — routes are unchanged. */
export function AppShell({ children }: PropsWithChildren) {
  const colors = useColors();
  const isWide = useIsWide();

  if (!isWide) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }]}>
        <PhoneTopBar />
        <View style={styles.fill}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, styles.row, { backgroundColor: colors.bg }]}>
      <Sidebar />
      <View style={styles.fill}>
        <TopBar />
        <View style={styles.fill}>{children}</View>
      </View>
    </View>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.brand}>
      <View style={[styles.brandTile, { backgroundColor: colors.accent }]}>
        <HardHatIcon color={colors.accentOn} size={18} />
      </View>
      {compact ? null : (
        <View>
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>CATERPILLAR</Text>
          <Text style={[styles.brandSub, { color: colors.textSecondary }]}>OPERATOR SAFETY</Text>
        </View>
      )}
    </View>
  );
}

function Sidebar() {
  const colors = useColors();
  const pathname = usePathname();
  const operatorId = useAuthStore((s) => s.operatorId);
  const devNetworkCut = useConnectivityStore((s) => s.devNetworkCut);

  return (
    <View style={[styles.sidebar, { backgroundColor: colors.sidebar, borderRightColor: colors.border }]}>
      <View style={[styles.sidebarBrand, { borderBottomColor: colors.border }]}>
        <BrandMark />
      </View>

      <View style={styles.nav}>
        <Text style={[type.label, styles.navLabel, { color: colors.textSecondary }]}>WORKSPACE</Text>
        {NAV.map((item) => {
          const active = item.match(pathname);
          const fg = active ? colors.textPrimary : colors.textSecondary;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              onPress={() => {
                Haptics.selectionAsync();
                router.navigate(item.href);
              }}
              style={({ hovered }) => [
                styles.navItem,
                { backgroundColor: active ? colors.navActive : hovered ? colors.surfaceRaised : "transparent" },
              ]}
            >
              {item.icon(fg)}
              <Text style={[styles.navText, { color: fg, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium" }]}>
                {item.label}
              </Text>
              {item.live ? (
                <View style={[styles.liveDot, { backgroundColor: devNetworkCut ? colors.caution : colors.safe }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sidebarFooter}>
        <View style={[styles.siteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.siteCardTitle}>
            <ShieldIcon color={colors.safe} size={15} />
            <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>Site safety</Text>
          </View>
          <Text style={[type.small, { color: colors.textSecondary, lineHeight: 18 }]}>
            Looking out for everyone on the ground, every shift.
          </Text>
        </View>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{initials(DEMO_OPERATOR_NAME)}</Text>
          </View>
          <View style={styles.fill}>
            <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
              {DEMO_OPERATOR_NAME}
            </Text>
            <Text style={[type.small, { color: colors.textMuted, fontSize: 11 }]} numberOfLines={1}>
              Equipment operator{operatorId ? ` · ${operatorId}` : ""}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function IconButton({
  children,
  onPress,
  label,
  testID,
}: PropsWithChildren<{ onPress: () => void; label: string; testID?: string }>) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ hovered }) => [styles.iconButton, { backgroundColor: hovered ? colors.surfaceRaised : "transparent" }]}
    >
      {children}
    </Pressable>
  );
}

function TopBar() {
  const colors = useColors();
  return (
    <View style={[styles.topBar, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.breadcrumb}>
        <PinIcon color={colors.textSecondary} size={15} />
        <Text style={[type.caption, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>{DEMO_SITE.name}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>/</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{DEMO_SITE.sector}</Text>
      </View>
      <View style={styles.topActions}>
        <View style={[styles.machineChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TruckIcon color={colors.textSecondary} size={15} />
          <Text style={[type.small, { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" }]}>{DEMO_MACHINE_MODEL}</Text>
          <Text style={[type.small, { color: colors.textMuted }]}>{DEMO_MACHINE_ID}</Text>
        </View>
        <ConnectivityPill />
        <LanguageSwitcher />
        <IconButton label="Demo panel" testID="open-demo-panel" onPress={() => router.push("/demo")}>
          <FlaskIcon color={colors.textSecondary} size={17} />
        </IconButton>
        <IconButton label="Live safety alerts" onPress={() => router.navigate("/safety")}>
          <BellIcon color={colors.textSecondary} size={18} />
        </IconButton>
        <ThemeToggle />
        <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{initials(DEMO_OPERATOR_NAME)}</Text>
        </View>
      </View>
    </View>
  );
}

function PhoneTopBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.phoneBar,
        { paddingTop: insets.top + spacing.sm, backgroundColor: colors.bg, borderBottomColor: colors.border },
      ]}
    >
      <BrandMark compact />
      <View style={styles.topActions}>
        <ConnectivityPill />
        <LanguageSwitcher />
        <IconButton label="Demo panel" testID="open-demo-panel" onPress={() => router.push("/demo")}>
          <FlaskIcon color={colors.textSecondary} size={17} />
        </IconButton>
        <ThemeToggle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row" },
  sidebar: {
    width: 216,
    borderRightWidth: 1,
  },
  sidebarBrand: {
    height: 64,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  brandTile: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  brandSub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8.5,
    letterSpacing: 1.4,
    marginTop: 1,
  },
  nav: {
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.lg,
    gap: 3,
  },
  navLabel: {
    fontSize: 9.5,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  navText: {
    flex: 1,
    fontSize: 13.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sidebarFooter: {
    marginTop: "auto",
    padding: spacing.sm + 2,
    gap: spacing.md,
  },
  siteCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    gap: 6,
  },
  siteCardTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11.5,
  },
  topBar: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  machineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
});
