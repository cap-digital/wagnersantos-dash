/**
 * Chart tokens. Mirrors the CSS custom properties in globals.css and the
 * literals in tailwind.config.ts, because Recharts needs concrete values for
 * SVG attributes. Keep the three in sync.
 *
 * The dashboard sits on the campaign's royal blue rather than near-black, so
 * marks are LIGHTER than the surface. That is the light-mode band
 * (OKLCH L 0.43–0.77) applied to a mid-tone plane. Validated with the dataviz
 * palette validator against the card surface #25377F:
 *   categorical adjacent, 6 slots    → ALL PASS (CVD ΔE 10.5 · normal ΔE 19.1)
 *   categorical all-pairs, slots 1–3 → ALL PASS (CVD ΔE 11.4 · normal ΔE 19.1)
 *   ordinal aqua ramp, 6 steps       → ALL PASS
 */

export const SURFACE = "#25377F";
export const SURFACE_2 = "#2C4090";
export const PAGE = "#1B2A6C";

export const INK_1 = "#FFFFFF"; /* 10.9:1 */
export const INK_2 = "#D5DDF8"; /*  8.0:1 */
export const INK_3 = "#A8B4E4"; /*  5.3:1 */

export const GRID = "#3B4E9E";
export const AXIS = "#46599F";

/** Single-series marks, hero figures and active chrome. */
export const ACCENT = "#FFD84D"; /* 7.9:1 */

/** Categorical slots — assign in order, never cycle, never reassign on filter. */
export const SERIES = ["#D6AA35", "#43CBBA", "#A99BF7", "#5FC97D", "#7FB4F5", "#F58BB0"];

/** Ordinal ramp (aqua), light → dark. Use for funnel stages and tiers. */
export const ORDINAL = ["#E8FBF6", "#B0EBE0", "#7ED9C9", "#4FC4B2", "#2CA997", "#17897A"];

export const STATUS = {
  good: "#3FD97F",
  goodText: "#7CE8A6",
  warning: "#FFB03A",
  serious: "#FF9E6B",
  critical: "#FF6B6B",
  criticalText: "#FF9090",
};

/** Text inside a coloured fill: pick by the fill's luminance. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.42 ? "#16255F" : "#FFFFFF";
}

/** Shared axis styling — hairline, solid, recessive. */
export const axisTick = { fill: INK_3, fontSize: 11, fontWeight: 500 } as const;
export const axisLine = { stroke: AXIS, strokeWidth: 1 } as const;
export const gridLine = { stroke: GRID, strokeWidth: 1 } as const;

/** Bars never fill their band — cap at 24px and let the leftover be air. */
export const BAR_MAX = 24;
/** 4px rounded data-end, square at the baseline. */
export const BAR_RADIUS_UP: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [0, 4, 4, 0];

/** 2px surface gap between touching fills, expressed as a stroke of the surface. */
export const stackGap = { stroke: SURFACE, strokeWidth: 2 } as const;
