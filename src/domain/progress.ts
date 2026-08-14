import type { ProgressSummary, SubjectStatus, SubjectView } from './types'

/** Statuses that count as academic credit earned. */
const EARNED: ReadonlySet<SubjectStatus> = new Set<SubjectStatus>(['passed', 'equivalent'])

/**
 * Career progress over a resolved curriculum.
 *
 * Electives are counted in `total` — a plan's elective slots are real requirements.
 * Credits are only reported when *every* subject declares them; a partial credit
 * total is worse than none, because it silently understates the plan.
 */
export function computeProgress(views: readonly SubjectView[]): ProgressSummary {
  const summary: ProgressSummary = {
    total: views.length,
    passed: 0,
    inProgress: 0,
    regularized: 0,
    available: 0,
    blocked: 0,
    pending: 0,
    failed: 0,
    equivalent: 0,
    ratio: 0,
    creditsEarned: null,
    creditsTotal: null,
  }

  let creditsEarned = 0
  let creditsTotal = 0
  let allDeclareCredits = views.length > 0

  for (const view of views) {
    switch (view.status) {
      case 'passed':
        summary.passed += 1
        break
      case 'equivalent':
        summary.equivalent += 1
        break
      case 'in_progress':
        summary.inProgress += 1
        break
      case 'regularized':
        summary.regularized += 1
        break
      case 'available':
        summary.available += 1
        break
      case 'blocked':
        summary.blocked += 1
        break
      case 'failed':
        summary.failed += 1
        break
      case 'pending':
        summary.pending += 1
        break
    }

    if (view.credits === null) {
      allDeclareCredits = false
    } else {
      creditsTotal += view.credits
      if (EARNED.has(view.status)) creditsEarned += view.credits
    }
  }

  const earned = summary.passed + summary.equivalent
  summary.ratio = summary.total === 0 ? 0 : earned / summary.total

  if (allDeclareCredits) {
    summary.creditsEarned = creditsEarned
    summary.creditsTotal = creditsTotal
  }

  return summary
}

/** Subjects the student is currently cursando or has regularizado. */
export function activeSubjects(views: readonly SubjectView[]): SubjectView[] {
  return views.filter((v) => v.status === 'in_progress' || v.status === 'regularized')
}
