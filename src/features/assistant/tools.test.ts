import { describe, expect, it } from 'vitest'

import type { ToolUseBlock } from '@/lib/ai/anthropic-client'

import { assistantData } from './fixtures'
import { ASSISTANT_TOOLS, dispatchTool } from './tools'

const call = (name: string, input: unknown): ToolUseBlock => ({
  type: 'tool_use',
  id: `tu_${name}`,
  name,
  input,
})

describe('ASSISTANT_TOOLS', () => {
  it('offers four read tools and one proposal tool, all streaming their input', () => {
    expect(ASSISTANT_TOOLS.map((t) => t.name)).toEqual([
      'get_upcoming',
      'get_plan_status',
      'get_pending_finals',
      'what_if_simulation',
      'propose_item',
    ])
    expect(ASSISTANT_TOOLS.every((t) => t.eager_input_streaming)).toBe(true)
  })
})

describe('dispatchTool', () => {
  const data = assistantData()

  it('answers a read tool with JSON for the same tool_use id', () => {
    const { result } = dispatchTool(call('get_upcoming', { days: 7 }), data)
    expect(result.tool_use_id).toBe('tu_get_upcoming')
    expect(result.is_error).toBeUndefined()
    expect(JSON.parse(result.content)).toHaveProperty('proximas')
  })

  it('runs the simulator from validated input', () => {
    const { result } = dispatchTool(
      call('what_if_simulation', { changes: [{ subject_id: 'so', status: 'passed' }] }),
      data,
    )
    expect(JSON.parse(result.content)).toMatchObject({
      se_abren_para_cursar: ['Redes de Datos'],
    })
  })

  it('turns malformed input into an error result the model can retry', () => {
    const { result } = dispatchTool(call('what_if_simulation', { changes: 'todo' }), data)
    expect(result.is_error).toBe(true)
    const bad = dispatchTool(
      call('what_if_simulation', { changes: [{ subject_id: 'so', status: 'aprobada' }] }),
      data,
    )
    expect(bad.result.is_error).toBe(true)
  })

  it('answers a call whose JSON did not parse with INVALID_JSON', () => {
    const { result } = dispatchTool(call('get_upcoming', {}), data, { invalidJson: true })
    expect(result).toMatchObject({ is_error: true })
    expect(result.content).toMatch(/INVALID_JSON/)
  })

  it('rejects an unknown tool', () => {
    expect(dispatchTool(call('delete_everything', {}), data).result.is_error).toBe(true)
  })

  it('propose_item only proposes: it returns a card, and says nothing was saved', () => {
    const outcome = dispatchTool(
      call('propose_item', {
        title: 'TP 3',
        kind: 'assignment',
        subject_id: 'so',
        date: '2026-11-27',
        time: '18:00',
      }),
      data,
    )
    expect(outcome.proposal).toMatchObject({
      title: 'TP 3',
      kind: 'assignment',
      kindLabel: 'Entrega',
      curriculumSubjectId: 'so',
      subjectName: 'Sistemas Operativos',
      whenLabel: '27/11 · 18:00',
    })
    expect(new Date(outcome.proposal!.dueAt!).getHours()).toBe(18)
    expect(JSON.parse(outcome.result.content)).toMatchObject({ guardado: false })
  })

  it('propose_item refuses an impossible date or a subject outside the plan', () => {
    const date = dispatchTool(
      call('propose_item', { title: 'TP', kind: 'assignment', date: '2026-02-31' }),
      data,
    )
    expect(date.proposal).toBeUndefined()
    expect(date.result.is_error).toBe(true)
    const subject = dispatchTool(
      call('propose_item', { title: 'TP', kind: 'assignment', subject_id: 'inventada' }),
      data,
    )
    expect(subject.result.is_error).toBe(true)
  })
})
