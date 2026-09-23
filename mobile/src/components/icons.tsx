import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type IconProps = { color: string; size?: number };

export function TodayIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={17} rx={2} stroke={color} strokeWidth={2} />
      <Line x1={3} y1={9} x2={21} y2={9} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={2} x2={8} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={2} x2={16} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M7 13h3M7 17h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SafetyIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l7 3v6c0 4.8-3 8.5-7 10-4-1.5-7-5.2-7-10V5l7-3z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrainingIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M10 8.5l6 3.5-6 3.5v-7z" fill={color} />
    </Svg>
  );
}

export function AssistantIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16v10H9l-4 4V5z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={9} cy={10} r={1} fill={color} />
      <Circle cx={12.5} cy={10} r={1} fill={color} />
      <Circle cx={16} cy={10} r={1} fill={color} />
    </Svg>
  );
}

// Voice read-out affordance on task cards — CLAUDE.md section 2.1 Rule 6: instructions
// must be usable hands-free, not just present as text.
export function SpeakerIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={color} />
      <Path
        d="M16.5 8.5a5 5 0 0 1 0 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M19 6a8.5 8.5 0 0 1 0 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

// Marks a known hazard on a task card (buried utilities, slopes, nearby workers).
export function HazardIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 21 19H3L12 3.5z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Line x1={12} y1={10} x2={12} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={16.5} r={1} fill={color} />
    </Svg>
  );
}
