import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Does this person want motion kept to a minimum?
 *
 * Read as state rather than left to CSS because some animation is JavaScript —
 * a requestAnimationFrame loop does not stop just because a media query says
 * so, and a loop nobody can see is still a loop burning a battery.
 *
 * Subscribed, not sampled once: the setting can change while the app is open.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
