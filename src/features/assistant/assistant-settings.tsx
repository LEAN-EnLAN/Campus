import { KeyRound, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/ui/field'
import { checkApiKey } from '@/lib/ai/anthropic-client'
import { toAssistantError } from '@/lib/ai/errors'
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_MODEL,
  isAssistantModel,
  type AssistantModelId,
} from '@/lib/ai/models'

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
    <section id="asistente" className="blue-settings-card" aria-labelledby="settings-assistant">
      <header className="blue-settings-card-head">
        <div className="min-w-0">
          <h2 id="settings-assistant">Asistente</h2>
          <p>Traé tu propia clave de Anthropic y preguntale a Claude sobre tu cursada.</p>
        </div>
        <span className="bg-accent-soft text-accent-ink flex size-12 shrink-0 items-center justify-center rounded-2xl">
          <Sparkles aria-hidden="true" className="size-6" />
        </span>
      </header>

      <form className="flex flex-col gap-4" onSubmit={save} noValidate>
        <p className="text-ink flex items-center gap-2 text-sm">
          <KeyRound aria-hidden="true" className="text-ink-muted size-4" />
          {settings
            ? `Clave guardada en este dispositivo (termina en ${maskApiKey(settings.apiKey)}).`
            : 'Todavía no cargaste una clave.'}
        </p>

        <TextField
          label={settings ? 'Reemplazar clave' : 'Clave de API de Anthropic'}
          hint="Empieza con sk-ant-. La creás en console.anthropic.com → API keys."
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={settings ? 'Dejala vacía para mantener la actual' : 'sk-ant-…'}
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          error={keyError}
        />

        <SelectField
          label="Modelo"
          hint={modelHint}
          value={model}
          onChange={(event) => {
            if (isAssistantModel(event.target.value)) setDraftModel(event.target.value)
          }}
        >
          {ASSISTANT_MODELS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>

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
          className={
            status.kind === 'error'
              ? 'text-danger text-sm font-medium'
              : 'text-ink-muted text-sm'
          }
        >
          {status.kind === 'ok' || status.kind === 'error' ? status.message : null}
        </p>
      </form>

      <div className="blue-settings-prose">
        <p>
          <strong>Dónde queda tu clave:</strong> solo en este dispositivo, en este navegador. No
          pasa por los servidores de Campus, no se sincroniza y no se incluye en la exportación
          de datos. Cualquiera que use este navegador puede usarla: borrala si el dispositivo es
          compartido.
        </p>
        <p>
          <strong>Cómo viaja:</strong> cada consulta va directo de tu dispositivo a Anthropic.
          Le pagás a Anthropic según tu uso; Campus no cobra nada.
        </p>
        <p>
          <strong>Qué se envía:</strong> tu pregunta y solo los datos que el asistente necesita
          para responderla, como nombres de materias, sus estados y tus próximas fechas. Nunca
          tus notas, tus archivos ni tu email.
        </p>
      </div>
    </section>
  )
}
