/**
 * The Campus palette, as a rule rather than a list.
 *
 * Five seeds:
 *
 *   Shadow Grey      #231f20   L 24.4  C 0.006  H   1
 *   Tomato Jam       #bb4430   L 54.8  C 0.158  H  32
 *   Tropical Teal    #7ebdc2   L 75.8  C 0.065  H 202
 *   Vanilla Custard  #f3dfa2   L 90.6  C 0.081  H  92
 *   Linen            #efe6dd   L 93.0  C 0.016  H  68
 *
 * Read them in OKLCH and the set describes itself. Four of the five live in a
 * narrow chroma band — 0.006 to 0.081 — which is exactly what "these are not
 * very intense" means when you measure it instead of squinting at it. Tomato
 * Jam sits at 0.158, twice the rest, and that is not a flaw in the set: it is
 * the one loud voice, and a design system is allowed exactly one. It is spent
 * on the accent.
 *
 * Everything else in Campus — every surface, every subject colour, every colour
 * a student will ever pick — is generated inside that band. That is the whole
 * system, and it is why it keeps itself honest: a colour cannot clash with the
 * palette if it is not possible to express a clashing colour.
 */

export interface Oklch {
  /** Perceptual lightness, 0–100. */
  l: number
  /** Chroma. 0 is grey; this palette lives between 0.01 and 0.16. */
  c: number
  /** Hue angle in degrees. */
  h: number
}

/** The five seeds, by the hue each contributes. */
export const SEED_HUES = {
  shadowGrey: 1,
  tomatoJam: 32,
  tropicalTeal: 202,
  vanillaCustard: 92,
  linen: 68,
} as const

/** The one colour allowed to be louder than the set. */
export const ACCENT_HUE = SEED_HUES.tomatoJam

/**
 * The envelope, measured off the four quiet seeds.
 *
 * `maxChroma` is the ceiling for anything that is not the accent: a shade over
 * Vanilla Custard's 0.081, which is the most saturated of the quiet four. The
 * lightness band keeps a generated colour readable on Linen and visible on
 * Shadow Grey without anyone having to check.
 */
export const HARMONY = {
  maxChroma: 0.085,
  minL: 25,
  maxL: 95,
} as const

export type HarmonicRole =
  /** A colour that carries identity: a subject's chip, a calendar event. */
  | 'subject'
  /** A tinted surface that text sits on. */
  | 'soft'
  /** Text or an icon on the matching `soft` surface. */
  | 'ink'

export type PaletteTheme = 'light' | 'dark'

/**
 * Lightness per role, per theme.
 *
 * The relationship is what matters, not the numbers: `soft` is always a near
 * surface, `ink` always has enough distance from it to read, and `subject`
 * sits where the seeds sit. In the dark theme the surfaces sink and the
 * identity colours rise, which is the same move the app's own tokens make.
 */
const ROLE: Record<PaletteTheme, Record<HarmonicRole, { l: number; c: number }>> = {
  light: {
    subject: { l: 76, c: 0.065 },
    soft: { l: 93, c: 0.03 },
    ink: { l: 42, c: 0.07 },
  },
  dark: {
    subject: { l: 72, c: 0.075 },
    soft: { l: 26, c: 0.035 },
    ink: { l: 84, c: 0.06 },
  },
}

/** A colour at the given hue, shaped for its role. Always inside the envelope. */
export function harmonic(hue: number, role: HarmonicRole, theme: PaletteTheme): Oklch {
  const { l, c } = ROLE[theme][role]
  return { l, c: Math.min(c, HARMONY.maxChroma), h: normalizeHue(hue) }
}

/**
 * The only gate the colour picker has.
 *
 * It CORRECTS rather than refuses. A student who pastes a scorching red is
 * asking for something this palette does not contain; answering with the
 * nearest colour it does contain keeps their intent — the hue, which is the
 * part they actually chose — and drops only the intensity, which is the part
 * that would have broken the set. An error message would have taught them
 * nothing and left them with no colour at all.
 */
export function clampToHarmony(input: Oklch): Oklch {
  return {
    l: Math.min(HARMONY.maxL, Math.max(HARMONY.minL, input.l)),
    c: Math.min(HARMONY.maxChroma, Math.max(0, input.c)),
    h: normalizeHue(input.h),
  }
}

/**
 * The golden angle, 137.5°.
 *
 * Subjects are coloured by their position in the plan, and the requirement is
 * that neighbours stay apart — a board where "Análisis II" and "Álgebra" are
 * two greens a shade apart has colour without information. Stepping by the
 * golden angle is the standard answer because it never settles into a cycle:
 * the first forty hues are all far from their neighbours AND all distinct,
 * which evenly spacing by `360 / n` cannot promise unless you know `n` up
 * front — and a student can always add a subject.
 */
const GOLDEN_ANGLE = 137.508

export function subjectHue(index: number): number {
  // Offset so subject zero is not Tomato: the accent's hue belongs to the app,
  // not to whichever subject happens to sort first.
  return normalizeHue(SEED_HUES.tropicalTeal + index * GOLDEN_ANGLE)
}

function normalizeHue(hue: number): number {
  const wrapped = hue % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** `oklch(76% 0.065 202)` — the form a browser and a CSS variable both take. */
export function toCss({ l, c, h }: Oklch): string {
  return `oklch(${round(l)}% ${round(c, 3)} ${round(h)})`
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
