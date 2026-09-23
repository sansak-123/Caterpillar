import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { type } from "../theme/tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 12,
  color,
  trackColor,
  label,
  value,
  valueColor,
}: {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  label?: string;
  value?: string;
  valueColor?: string;
}) {
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          origin={`${size / 2}, ${size / 2}`}
          rotation={-90}
        />
      </Svg>
      {value ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[type.h1, { color: valueColor }]}>{value}</Text>
          {label ? <Text style={[type.caption, { color: valueColor, opacity: 0.7 }]}>{label}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
