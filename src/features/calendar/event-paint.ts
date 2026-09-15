import type { AcademicItemKind } from '@/domain/types'
import { HARMONY, SEED_HUES, subjectHue, toCss, type PaletteTheme } from '@/lib/design/palette'

/**
 * What colour an event is, and why.
 *
 * Two dimensions, deliberately separated:
 *
 *   HUE   says which subject it belongs to.
 *   SHADE says how much it matters.
 *
 * Keeping those apart is what makes the colour readable at a glance. If a
 * parcial and a class in the same subject were different hues, the colour
 * would carry no information at all — you would be looking at decoration.
 *
 * Every value still comes out of the palette's envelope, so forty subjects
 * cannot produce a single colour that fights the rest of the app.
 */

export type EventEmphasis = 'strong' | 'medium' | 'quiet'

/**
 * How loud an event is allowed to be.
 *
 * Exams first, because they are what a student can fail. Deliverables next.
 * Classes recede: they repeat every week and a calendar shouting about them
 * drowns the things that happen once. Enrolment sits with the deliverables —
 * it is a window that closes.
 */
export function emphasisOf(kind: AcademicItemKind): EventEmphasis {
  switch (kind) {
    case 'midterm':
    case 'final':
      return 'strong'
    case 'assignment':
    case 'task':
    case 'registration':
      return 'medium'
    default:
      return 'quiet'
  }
}

/**
 * The hue that belongs to a subject.
 *
 * Derived from its position in the plan rather than stored, so a fresh vault is
 * already colourful and nothing has to be migrated. An item pointing at a
 * subject this plan does not contain — a leftover from a plan the student
 * changed — takes the accent rather than silently borrowing subject zero's
 * colour, which would be a quiet lie.
 */
export function hueForSubject(
  subjectId: string | null,
  orderedSubjectIds: readonly string[],
): number {
  if (!subjectId) return SEED_HUES.tropicalTeal
  const index = orderedSubjectIds.indexOf(subjectId)
  return index < 0 ? SEED_HUES.tropicalTeal : subjectHue(index)
}

/** Lightness and chroma per emphasis, per theme. */
const SHADE: Record<
  PaletteTheme,
  Record<EventEmphasis, { l: number; c: number; ink: number }>
> = {
  light: {
    strong: { l: 62, c: 0.085, ink: 99 },
    medium: { l: 80, c: 0.055, ink: 35 },
    quiet: { l: 92, c: 0.028, ink: 40 },
  },
  dark: {
    strong: { l: 58, c: 0.085, ink: 97 },
    medium: { l: 38, c: 0.055, ink: 88 },
    quiet: { l: 26, c: 0.03, ink: 80 },
  },
}

export interface EventPaint {
  hue: number
  /** Lightness of the fill, exposed so tests can assert the ordering. */
  l: number
  /** Lightness of the ink on it. */
  inkL: number
  bg: string
  ink: string
  line: string
}

/**
 * The fill and the ink for one event.
 *
 * `done` changes nothing here on purpose. A finished parcial is still that
 * subject's parcial, and recolouring it would spend the one channel that says
 * "which subject" on a state the chip already shows by striking the title
 * through. Colour for identity, everything else for state.
 */
export function eventPaint(
  hue: number,
  kind: AcademicItemKind,
  theme: PaletteTheme,
  done: boolean,
): EventPaint {
  void done
  const shade = SHADE[theme][emphasisOf(kind)]
  const c = Math.min(shade.c, HARMONY.maxChroma)

  return {
    hue,
    l: shade.l,
    inkL: shade.ink,
    bg: toCss({ l: shade.l, c, h: hue }),
    ink: toCss({ l: shade.ink, c: shade.ink > 60 ? 0.02 : 0.05, h: hue }),
    line: toCss({ l: theme === 'light' ? shade.l - 12 : shade.l + 14, c, h: hue }),
  }
}
