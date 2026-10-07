import type { Oklch } from './palette'

/**
 * WCAG contrast, computed from OKLCH tokens.
 *
 * The palette is written in OKLCH, so "is this readable?" cannot be answered by
 * squinting at a hex. This converts a token to sRGB, takes its relative
 * luminance and returns the WCAG 2.x ratio — which is what the thresholds in
 * 1.4.3 (text, 4.5:1) and 1.4.11 (non-text, 3:1) are defined in.
 */

/** OKLCH (L in 0–100) → linear-light sRGB, clipped to the gamut. */
export function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const L = l / 100
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3

  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  const clip = (v: number) => Math.min(1, Math.max(0, v))
  return [clip(r), clip(g), clip(bl)]
}

/** WCAG relative luminance of an OKLCH colour. */
export function luminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1–21, order-independent. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Parse `oklch(42% 0.07 202)` — the only form the stylesheet uses. */
export function parseOklch(css: string): Oklch | null {
  const match = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(css)
  if (!match) return null
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) }
}
