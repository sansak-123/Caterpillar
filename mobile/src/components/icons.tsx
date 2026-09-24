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

// Dev-only demo panel entry point (flask icon).
export function FlaskIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={7.5} y1={15} x2={16.5} y2={15} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Checklist item state — used by the digital pre-start walkaround checklist.
export function CheckIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4 10-10" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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

// Voice input affordance on the assistant's input bar — a plain text-glyph dot read as
// an unlabeled colored circle, not a recognizable "tap to talk" control.
export function MicIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={2} width={6} height={12} rx={3} stroke={color} strokeWidth={2} />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={18} x2={12} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={8} y1={22} x2={16} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Recording-in-progress state for the same button (replaces MicIcon while listening).
export function StopIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} />
    </Svg>
  );
}

// ---- Thin-line icon set for the redesigned shell and pages (1.8 px stroke) ----

const S = 1.8;

export function GridIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={3.5} width={7} height={8} rx={1.5} stroke={color} strokeWidth={S} />
      <Rect x={13.5} y={3.5} width={7} height={5} rx={1.5} stroke={color} strokeWidth={S} />
      <Rect x={13.5} y={11.5} width={7} height={9} rx={1.5} stroke={color} strokeWidth={S} />
      <Rect x={3.5} y={14.5} width={7} height={6} rx={1.5} stroke={color} strokeWidth={S} />
    </Svg>
  );
}

export function RadioIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" stroke={color} strokeWidth={S} strokeLinecap="round" />
      <Path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function ClipboardIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4.5} width={14} height={17} rx={2} stroke={color} strokeWidth={S} />
      <Rect x={9} y={2.5} width={6} height={4} rx={1} stroke={color} strokeWidth={S} />
      <Path d="M9 13l2 2 4-4" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BookIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5v13c-3.5-2-6.5-2-9-1V5.5z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Path d="M21 5.5c-2.5-1-5.5-1-9 1v13c3.5-2 6.5-2 9-1V5.5z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={S} />
      <Path d="M12 7.5V12l3 2" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PulseIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h4l2.5-6 5 12 2.5-6h4" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v11H9l-5 4V5z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// CAT-style hard hat for the brand mark.
export function HardHatIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 16a8 8 0 0 1 16 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M10 8.5V6h4v2.5" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={2.5} y={16} width={19} height={3} rx={1} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function PinIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={2.3} stroke={color} strokeWidth={S} />
    </Svg>
  );
}

export function TruckIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={6} width={11} height={10} rx={1.2} stroke={color} strokeWidth={S} />
      <Path d="M13.5 9.5h4l3 3.5V16h-7" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Circle cx={7} cy={17.5} r={1.8} stroke={color} strokeWidth={S} />
      <Circle cx={17} cy={17.5} r={1.8} stroke={color} strokeWidth={S} />
    </Svg>
  );
}

export function WifiIcon({ color, size = 16, off = false }: IconProps & { off?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 9a14 14 0 0 1 19 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8.8 16a5 5 0 0 1 6.4 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={19.3} r={1.3} fill={color} />
      {off ? <Line x1={4} y1={3.5} x2={20} y2={21} stroke={color} strokeWidth={2} strokeLinecap="round" /> : null}
    </Svg>
  );
}

export function BellIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Path d="M10 20.5a2 2 0 0 0 4 0" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowRightIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowLeftIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M11 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 5l12 7-12 7V5z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function PauseIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={S} />
      <Path d="M10 9v6M14 9v6" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function XIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function UserIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.8} stroke={color} strokeWidth={S} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function WindIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={S} />
    </Svg>
  );
}

export function RotateIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12a8 8 0 1 1-2.4-5.7" stroke={color} strokeWidth={S} strokeLinecap="round" />
      <Path d="M20 4v4.5h-4.5" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WrenchIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"
        stroke={color}
        strokeWidth={S}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GaugeIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 17a8 8 0 1 1 16 0" stroke={color} strokeWidth={S} strokeLinecap="round" />
      <Path d="M12 17l4-5" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}

export function SlopeIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 19L21 7v12H3z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
    </Svg>
  );
}

export function MoonSmallIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke={color} strokeWidth={S} strokeLinejoin="round" />
    </Svg>
  );
}

export function TrendIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 17l6-6 4 4 8-8" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 7h6v6" stroke={color} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MonitorIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={12} rx={1.5} stroke={color} strokeWidth={S} />
      <Path d="M9 20h6M12 16v4" stroke={color} strokeWidth={S} strokeLinecap="round" />
    </Svg>
  );
}
