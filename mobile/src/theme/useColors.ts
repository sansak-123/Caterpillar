import { useThemeStore } from "../store/theme";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

export function useColors(): ColorTokens {
  const mode = useThemeStore((s) => s.mode);
  return mode === "light" ? lightColors : darkColors;
}
