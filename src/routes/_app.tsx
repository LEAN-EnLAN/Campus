import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AcademicShell } from '@/components/academic-shell'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { SearchPalette } from '@/features/search/search-palette'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { useAcademicItems, useCreateAcademicItem, useResources } from '@/features/items/queries'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

/**
 * The protected shell.
 *
 * Auth-gating happens here once, not in every screen. Quick capture and search
 * live at this level so CAP-CAPTURE-001 ("from any screen") is structural rather
 * than repeated per route.
 */
function AppLayout() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [captureOpen, setCaptureOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const resourcesQuery = useResources()
  const createItem = useCreateAcademicItem()

  useEffect(() => {
    if (!loading && !session) void navigate({ to: '/login' })
  }, [loading, session, navigate])

  // A student with no academic context has nothing to look at here. Routing that
  // decision at the layout — rather than at the screen that happened to send them —
  // means it holds no matter how they arrived: signup, a bookmark, or a reload.
  useEffect(() => {
    if (loading || !session) return
    // `contextSettled` matters: mid-refetch the query still reads null, and
    // redirecting on that would bounce a student who just finished onboarding.
    if (!plan.contextSettled || plan.hasContext) return
    void navigate({ to: '/onboarding' })
  }, [loading, session, plan.contextSettled, plan.hasContext, navigate])

  // Cmd/Ctrl+K captures, "/" searches — the two things a student does most.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCaptureOpen(true)
        return
      }
      if (event.key === '/' && !typing && !captureOpen) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [captureOpen])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-ink-muted text-sm">Cargando tu cursada…</p>
      </div>
    )
  }

  if (!session) return null

  async function handleCapture(values: QuickCaptureValues) {
    await createItem.mutateAsync({
      title: values.title,
      kind: values.kind,
      curriculumSubjectId: values.curriculumSubjectId,
      dueAt: values.dueAt,
    })
    setCaptureOpen(false)
  }

  return (
    <>
      <AcademicShell
        onQuickCapture={() => setCaptureOpen(true)}
        onSearch={() => setSearchOpen(true)}
      >
        <Outlet />
      </AcademicShell>

      <QuickCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        subjects={plan.views}
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error ? (createItem.error as Error).message : null}
      />

      <SearchPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        subjects={plan.views}
        items={itemsQuery.data ?? []}
        resources={resourcesQuery.data ?? []}
      />
    </>
  )
}
