import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * One quiet confirmation, with an optional way back.
 *
 * "Hecho" and "Guardado" were silent: the row vanished or the dialog closed and
 * nothing said it had worked. The region is always in the DOM and only its
 * content changes, because a live region that is created together with its
 * message is not reliably announced.
 */

export interface ToastOptions {
  message: string
  action?: { label: string; onAction: () => void }
}

interface ToastValue {
  show: (toast: ToastOptions) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const VISIBLE_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  const show = useCallback((next: ToastOptions) => {
    window.clearTimeout(timer.current)
    setToast(next)
    timer.current = window.setTimeout(() => setToast(null), VISIBLE_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext value={value}>
      {children}
      {/* Above the mobile tab bar (3.5rem) and the floating add; centred on desktop. */}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
      >
        {toast ? (
          <p className="border-rule bg-paper-elevated text-ink pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg">
            <span>{toast.message}</span>
            {toast.action ? (
              <span aria-hidden="true" className="text-ink-muted -mx-1.5">
                ·
              </span>
            ) : null}
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onAction()
                  dismiss()
                }}
                className="text-accent-ink min-h-8 font-medium underline-offset-4 hover:underline"
              >
                {toast.action.label}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </ToastContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastValue {
  const value = use(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return value
}
