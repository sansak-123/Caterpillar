import { useWindowDimensions } from "react-native";

import { WIDE_BREAKPOINT } from "./tokens";

/** Whether the current window is wide enough for the sidebar + multi-column layout. */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
