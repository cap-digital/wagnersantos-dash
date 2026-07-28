"use client";

import { INK_2, INK_3, inkOn } from "./theme";

type LabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
  index?: number;
};

const n = (v: number | string | undefined, fallback = 0) =>
  typeof v === "number" ? v : typeof v === "string" ? Number(v) || fallback : fallback;

/**
 * Value on the cap of a column — always outside the mark, so it can never be
 * clipped by a short bar.
 */
export function capLabel(format: (v: number) => string, fill = INK_2) {
  return function CapLabel(props: LabelProps) {
    const value = n(props.value, NaN);
    if (!Number.isFinite(value)) return null;
    const x = n(props.x) + n(props.width) / 2;
    const y = n(props.y) - 7;
    return (
      <text x={x} y={y} textAnchor="middle" fill={fill} fontSize={10.5} fontWeight={600}>
        {format(value)}
      </text>
    );
  };
}

/**
 * Value at the tip of a horizontal bar. Sits outside the bar end unless the bar
 * is wide enough to hold it comfortably, so text is never cropped.
 */
export function tipLabel(
  format: (v: number) => string,
  opts: { inside?: boolean; fill?: string; barColor?: string } = {},
) {
  return function TipLabel(props: LabelProps) {
    const value = n(props.value, NaN);
    if (!Number.isFinite(value)) return null;
    const text = format(value);
    const width = n(props.width);
    const approx = text.length * 6.1 + 16;
    const inside = opts.inside && width > approx;
    const x = inside ? n(props.x) + width - 8 : n(props.x) + width + 7;
    const y = n(props.y) + n(props.height) / 2 + 3.5;
    return (
      <text
        x={x}
        y={y}
        textAnchor={inside ? "end" : "start"}
        fill={inside ? inkOn(opts.barColor ?? "#FFFFFF") : (opts.fill ?? INK_2)}
        fontSize={10.5}
        fontWeight={600}
      >
        {text}
      </text>
    );
  };
}

/**
 * Direct label on the last point of a line — sparing by design; the axis and
 * the tooltip carry the rest.
 */
export function endLabel(
  format: (v: number) => string,
  lastIndex: number,
  fill = INK_2,
  dy = -10,
  /** Shift left when a bar shares the same x and would sit under the text. */
  dx = 0,
) {
  return function EndLabel(props: LabelProps) {
    if (props.index !== lastIndex) return null;
    const value = n(props.value, NaN);
    if (!Number.isFinite(value)) return null;
    return (
      <text
        x={n(props.x) + dx}
        y={n(props.y) + dy}
        textAnchor="end"
        fill={fill}
        fontSize={10.5}
        fontWeight={700}
      >
        {format(value)}
      </text>
    );
  };
}

/** Label inside a stacked segment — only when the text fits with padding. */
export function segmentLabel(format: (v: number) => string, fillColor: string) {
  return function SegmentLabel(props: LabelProps) {
    const value = n(props.value, NaN);
    if (!Number.isFinite(value) || value === 0) return null;
    const text = format(value);
    const width = n(props.width);
    const height = n(props.height);
    if (width < text.length * 6.4 + 14 || height < 15) return null;
    return (
      <text
        x={n(props.x) + width / 2}
        y={n(props.y) + height / 2 + 3.5}
        textAnchor="middle"
        fill={inkOn(fillColor)}
        fontSize={10}
        fontWeight={700}
      >
        {text}
      </text>
    );
  };
}

export const MUTED_LABEL = INK_3;
