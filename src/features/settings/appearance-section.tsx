import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'

import { Illustration } from '@/components/ui/illustration'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  ACCENTS,
  DEFAULT_ACCENT_HUE,
  type AccentId,
  type ThemePreference,
} from '@/lib/theme/theme'
import { useTheme } from '@/lib/theme/theme-context'
import { cn } from '@/lib/utils'

import { SettingsPanel, SettingsRow } from './settings-ui'

const MODES = [
  { value: 'light', label: 'Claro', icon: <Sun /> },
  { value: 'dark', label: 'Oscuro', icon: <Moon /> },
  { value: 'system', label: 'Sistema', icon: <Monitor /> },
] as const satisfies readonly { value: ThemePreference; label: string; icon: ReactNode }[]

/** Literal classes so Tailwind sees them; values live in tokens.css. */
const SWATCH: Record<AccentId, string> = {
  azul: 'bg-(--swatch-azul)',
  verde: 'bg-(--swatch-verde)',
  coral: 'bg-(--swatch-coral)',
  violeta: 'bg-(--swatch-violeta)',
}

/**
 * Ajustes → Apariencia: mode and accent, both kept on this device. No saved
 * accent means Azul Campus; ThemeProvider owns persistence.
 */
export function AppearanceSection() {
  const { preference, setPreference, accentHue, setAccentHue } = useTheme()
  const activeHue = accentHue ?? DEFAULT_ACCENT_HUE

  return (
    <SettingsPanel
      id="settings-appearance"
      title="Apariencia"
      description="Elegí el modo y el color con el que querés ver Campus."
      art={<Illustration name="settings-appearance" decorative fit="crop" />}
    >
      <SettingsRow label="Modo" helper="Sistema sigue el modo de tu dispositivo.">
        <SegmentedControl
          label="Tema de la aplicación"
          options={MODES}
          value={preference}
          onChange={setPreference}
        />
      </SettingsRow>
      <SettingsRow label="Color" helper="El de los botones, los enlaces y lo seleccionado.">
        <div role="group" aria-label="Color de acento" className="flex flex-wrap gap-1.5">
          {ACCENTS.map((accent) => {
            const selected = accent.hue === activeHue
            return (
              <button
                key={accent.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAccentHue(accent.hue)}
                className={cn(
                  'rounded-pill inline-flex min-h-10 items-center gap-1.5 border py-1.5 pr-3 pl-1.5 text-sm font-medium',
                  'ease-out-expo transition-[background-color,border-color,color] duration-150',
                  'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                  selected
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-rule bg-paper-elevated text-ink-muted hover:border-field hover:text-ink',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-white',
                    SWATCH[accent.id],
                  )}
                >
                  {selected ? <Check className="size-3.5" /> : null}
                </span>
                {accent.label}
              </button>
            )
          })}
        </div>
      </SettingsRow>
      <p className="settings-footnote">
        Tus preferencias de apariencia se guardan en este dispositivo.
      </p>
    </SettingsPanel>
  )
}
