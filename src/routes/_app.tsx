import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AcademicShell } from '@/components/academic-shell'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { SearchPalette } from '@/features/search/search-palette'
import { useAcademicPlan } from '@/features/academic/queries'
import { useRequiresAccount } from '@/lib/runtime/identity'
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
  // LOCAL mode has no account and never will. Gating on a Supabase session
  // here sent those students to a login screen they cannot satisfy.
  const requiresAccount = useRequiresAccount()
  const navigate = useNavigate()

  const [captureOpen, setCaptureOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const resourcesQuery = useResources()
  const createItem = useCreateAcademicItem()

  useEffect(() => {
    if (requiresAccount && !loading && !session) void navigate({ to: '/login' })
  }, [requiresAccount, loading, session, navigate])

  // A student with no academic context has nothing to look at here. Routing that
  // decision at the layout — rather than at the screen that happened to send them —
  // means it holds no matter how they arrived: signup, a bookmark, or a reload.
  useEffect(() => {
    if (requiresAccount && (loading || !session)) return
    // Three guards, each for a different way this went wrong before:
    //   contextSettled — mid-refetch the query still reads null, which would bounce
    //                    a student who had just finished onboarding;
    //   contextError   — a failed fetch is NOT "no carrera". Redirecting on it sends a
    //                    returning student back through the wizard, where re-running
    //                    onboarding would deactivate the context they already had;
    //   hasContext     — the actual condition we care about.
    if (!plan.contextSettled || plan.contextError || plan.hasContext) return
    // The workspace works BEFORE a carrera is chosen: notes need a folder, not
    // a plan. Bouncing /vault through onboarding would tell a student their
    // own files are gated behind picking a university.
    if (window.location.pathname.startsWith('/vault')) return
    void navigate({ to: '/onboarding' })
  }, [loading, session, plan.contextSettled, plan.contextError, plan.hasContext, navigate])

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

  if (requiresAccount && !session) return null

  async function handleCapture(values: QuickCaptureValues) {
    // The dialog stays open and `createItem.error` is what the student reads; catching
    // here just keeps a failed save from surfacing as an unhandled rejection.
    try {
      await createItem.mutateAsync({
        title: values.title,
        kind: values.kind,
        curriculumSubjectId: values.curriculumSubjectId,
        dueAt: values.dueAt,
      })
      setCaptureOpen(false)
    } catch {
      /* surfaced through createItem.error */
    }
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
