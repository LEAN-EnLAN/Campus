import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useDemo } from '@/lib/runtime/demo'

/**
 * `/demo` — the free demo, no account. On a fresh load the composition root
 * already opened it (it reads the path); from inside the app this opens it in
 * place. Either way the visitor lands on Hoy.
 */
export const Route = createFileRoute('/demo')({
  component: DemoEntry,
})

function DemoEntry() {
  const demo = useDemo()
  const { active, start } = demo

  useEffect(() => {
    if (!active) void start()
  }, [active, start])

  if (!active) return null
  return <Navigate to="/today" replace />
}
