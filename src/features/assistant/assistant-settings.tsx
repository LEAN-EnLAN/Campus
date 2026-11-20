import { ChevronDown, ExternalLink, KeyRound } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { fieldControlClass, fieldHeightClass } from '@/components/ui/field'
import {
  SettingsCallout,
  SettingsPanel,
  SettingsRow,
  SettingsStatement,
} from '@/features/settings/settings-ui'
import { checkApiKey } from '@/lib/ai/anthropic-client'
import { toAssistantError } from '@/lib/ai/errors'
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_MODEL,
  isAssistantModel,
  type AssistantModelId,
} from '@/lib/ai/models'
import { cn } from '@/lib/utils'

import { AssistantIllustration } from './assistant-illustration'
import {
  clearAssistantSettings,
  maskApiKey,
  saveAssistantSettings,
  useAssistantSettings,
} from './storage'

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

/**
 * Ajustes → Asistente: "traé tu propia clave".
 *
 * The key is pasted here, kept in this browser only and sent nowhere but the
 * `x-api-key` header of requests to Anthropic. Never echoed back in full.
 */
export function AssistantSettingsSection() {
  const settings = useAssistantSettings()
  const [draftKey, setDraftKey] = useState('')
  const [draftModel, setDraftModel] = useState<AssistantModelId | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const keyId = useId()
  const keyHintId = useId()
  const keyErrorId = useId()
  const modelId = useId()
  const modelHintId = useId()

  const model = draftModel ?? settings?.model ?? DEFAULT_ASSISTANT_MODEL
  const modelHint = ASSISTANT_MODELS.find((m) => m.id === model)?.hint

  function save(event: FormEvent) {
    event.preventDefault()
    const apiKey = draftKey.trim() || settings?.apiKey || ''
    if (!apiKey) {
      setKeyError('Pegá tu clave de Anthropic.')
      return
    }
    setKeyError(null)
    saveAssistantSettings({ apiKey, model })
    setDraftKey('')
    setDraftModel(null)
    setStatus({ kind: 'ok', message: 'Guardado en este dispositivo.' })
  }

  async function test() {
    const apiKey = draftKey.trim() || settings?.apiKey
    if (!apiKey) {
      setKeyError('Pegá tu clave de Anthropic.')
      return
    }
    setKeyError(null)
    setStatus({ kind: 'checking' })
    try {
      await checkApiKey(apiKey, model)
      setStatus({ kind: 'ok', message: 'La clave funciona con este modelo.' })
    } catch (error) {
      setStatus({ kind: 'error', message: toAssistantError(error).message })
    }
  }

  function remove() {
    clearAssistantSettings()
    setDraftKey('')
    setDraftModel(null)
    setStatus({ kind: 'ok', message: 'Borramos la clave de este dispositivo.' })
  }

  return (
    <SettingsPanel
      id="settings-assistant"
      title="Asistente"
      description="Traé tu propia clave de Anthropic y preguntale a Claude sobre tu cursada."
      art={<AssistantIllustration fit="crop" />}
    >
      <form onSubmit={save} noValidate>
        <SettingsRow label="Estado">
          <p className="settings-value flex items-center gap-2">
            <KeyRound aria-hidden="true" className="text-ink-muted size-4 shrink-0" />
            {settings
              ? `Clave guardada en este dispositivo (termina en ${maskApiKey(settings.apiKey)}).`
              : 'Todavía no cargaste una clave.'}
          </p>
        </SettingsRow>

        <SettingsRow
          label={settings ? 'Reemplazar clave' : 'Clave de API de Anthropic'}
          labelFor={keyId}
          helper="Empieza con sk-ant-. La creás en console.anthropic.com → API keys."
          helperId={keyHintId}
          required={!settings}
          align="start"
        >
          <input
            id={keyId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={settings ? 'Dejala vacía para mantener la actual' : 'sk-ant-…'}
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            aria-describedby={keyError ? `${keyHintId} ${keyErrorId}` : keyHintId}
            aria-invalid={Boolean(keyError)}
            className={cn(fieldControlClass, fieldHeightClass)}
          />
          {keyError ? (
            <p id={keyErrorId} role="alert" className="settings-error">
              {keyError}
            </p>
          ) : null}
        </SettingsRow>

        <SettingsRow
          label="Modelo"
          labelFor={modelId}
          helper={modelHint}
          helperId={modelHintId}
          align="start"
        >
          <div className="relative">
            <select
              id={modelId}
              value={model}
              aria-describedby={modelHint ? modelHintId : undefined}
              onChange={(event) => {
                if (isAssistantModel(event.target.value)) setDraftModel(event.target.value)
              }}
              className={cn(fieldControlClass, fieldHeightClass, 'appearance-none pr-9')}
            >
              {ASSISTANT_MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="text-ink-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
            />
          </div>
        </SettingsRow>

        <SettingsRow className="settings-row-actions">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              {settings ? 'Guardar cambios' : 'Guardar clave'}
            </Button>
            <Button onClick={() => void test()} disabled={status.kind === 'checking'}>
              {status.kind === 'checking' ? 'Probando…' : 'Probar clave'}
            </Button>
            {settings ? (
              <Button variant="danger" onClick={remove}>
                Borrar clave
              </Button>
            ) : null}
          </div>
          <p
            aria-live="polite"
            className={cn(
              'empty:hidden',
              status.kind === 'error'
                ? 'text-danger text-sm font-medium'
                : 'text-ink-muted text-sm',
            )}
          >
            {status.kind === 'ok' || status.kind === 'error' ? status.message : null}
          </p>
        </SettingsRow>
      </form>

      <SettingsRow label="Dónde queda tu clave" align="start">
        <SettingsStatement detail="No pasa por los servidores de Campus, no se sincroniza y no se incluye en la exportación de datos.">
          Queda solo en este dispositivo, en este navegador.
        </SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Cómo viaja" align="start">
        <SettingsStatement detail="Le pagás a Anthropic según tu uso; Campus no cobra nada.">
          Cada consulta va directo de tu dispositivo a Anthropic.
        </SettingsStatement>
      </SettingsRow>
      <SettingsRow label="Qué se envía" align="start">
        <SettingsStatement detail="Solo los datos que el asistente necesita para responderla, como nombres de materias, sus estados y tus próximas fechas.">
          Tu pregunta y lo justo para responderla. Nunca tus notas, tus archivos ni tu email.
        </SettingsStatement>
      </SettingsRow>

      <SettingsCallout
        title="¿Compartís este dispositivo?"
        action={
          <a
            className="settings-link"
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tus claves en Anthropic
            <ExternalLink aria-hidden="true" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        }
      >
        Cualquiera que use este navegador puede usar tu clave: borrala si el dispositivo es
        compartido.
      </SettingsCallout>
    </SettingsPanel>
  )
}
