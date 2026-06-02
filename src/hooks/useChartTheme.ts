"use client";

import { type CSSProperties } from "react";
import { useTheme } from "next-themes";

export type ChartTheme = {
  grid: string;
  tick: string;
  tooltipBorder: string;
  tooltipBg: string;
  tooltipText: string;
};

const LIGHT: ChartTheme = {
  grid: "#E5E7EB",
  tick: "#6B7280",
  tooltipBorder: "#E5E7EB",
  tooltipBg: "#ffffff",
  tooltipText: "#111111",
};

const DARK: ChartTheme = {
  grid: "#262626",
  tick: "#a3a3a3",
  tooltipBorder: "#262626",
  tooltipBg: "#171717",
  tooltipText: "#fafafa",
};

export function chartTooltipStyle(theme: ChartTheme): CSSProperties {
  return {
    borderRadius: "8px",
    border: `1px solid ${theme.tooltipBorder}`,
    backgroundColor: theme.tooltipBg,
    color: theme.tooltipText,
    fontSize: "12px",
  };
}

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}
