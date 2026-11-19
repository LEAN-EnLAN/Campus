/**
 * The models the assistant offers. Exact ids, no date suffix.
 *
 * Sonnet is the default (criterio para planificar); Haiku is the cheap one.
 */
export const ASSISTANT_MODELS = [
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    hint: 'Recomendado: mejor criterio para planificar.',
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    hint: 'Más rápido y mucho más barato.',
  },
] as const

export type AssistantModelId = (typeof ASSISTANT_MODELS)[number]['id']

export const DEFAULT_ASSISTANT_MODEL: AssistantModelId = 'claude-sonnet-5-5'

export function isAssistantModel(value: unknown): value is AssistantModelId {
  return ASSISTANT_MODELS.some((model) => model.id === value)
}
