import { useEffect, useRef } from 'react'

/**
 * Scroll reveal without a dependency.
 *
 * Content is visible by default; this only arms the hidden starting state
 * (`.lp-motion` on the root) once an IntersectionObserver exists and the
 * visitor has not asked for reduced motion. Without JS, without the API or
 * with reduced motion, every section simply stays where it is.
 */
export function useReveal<T extends HTMLElement>() {
  const rootRef = useRef<T>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-revealed', '')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    )
    root.classList.add('lp-motion')
    for (const target of targets) observer.observe(target)

    return () => {
      observer.disconnect()
      root.classList.remove('lp-motion')
    }
  }, [])

  return rootRef
}
