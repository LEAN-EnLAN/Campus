import { describe, expect, it } from 'vitest'

import {
  buildContextHeader,
  getPendingFinals,
  getPlanStatus,
  getUpcoming,
  whatIf,
} from './context'
import { assistantData } from './fixtures'

describe('buildContextHeader', () => {
  it('carries today, the carrera and the shape of the plan in a few lines', () => {
    const header = buildContextHeader(assistantData())
    expect(header).toContain('2026-11-19')
    expect(header).toContain('Ingeniería de Prueba')
    expect(header).toContain('5 materias (1 aprobadas, 1 cursando, 1 regularizadas)')
    expect(header.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('tells the model not to claim correlativas the source does not publish', () => {
    const header = buildContextHeader(assistantData({ prerequisitesKnown: false }))
    expect(header).toMatch(/NO las publica/)
  })
})

describe('getUpcoming', () => {
  it('splits overdue, next days and undated, and counts what is further out', () => {
    const out = getUpcoming(assistantData(), 14)
    expect(out.vencidas.map((e) => e.titulo)).toEqual(['Informe'])
    expect(out.proximas.map((e) => e.titulo)).toEqual(['TP 2', 'Parcial 1'])
    expect(out.proximas[0]).toMatchObject({ materia: 'Sistemas Operativos', fecha: '20/11' })
    expect(out.sin_fecha).toEqual(['Leer apunte'])
    expect(out.mas_adelante).toBe(1)
  })

  it('never sends item notes', () => {
    expect(JSON.stringify(getUpcoming(assistantData(), 60))).not.toContain('nota privada')
  })
})

describe('getPlanStatus', () => {
  it('groups subjects by state with ids for the simulator', () => {
    const out = getPlanStatus(assistantData())
    expect(out.cursando.map((s) => s.id)).toEqual(['so'])
    expect(out.regularizadas.map((s) => s.nombre)).toEqual(['Análisis Matemático I'])
    expect(out.disponibles.map((s) => s.id)).toContain('am2')
    expect(out.bloqueadas.map((s) => s.id)).toEqual(['redes'])
    expect(out.bloqueadas[0]?.le_falta.join(' ')).toContain('Sistemas Operativos')
  })

  it('says availability is unverified when correlativas are not published', () => {
    const out = getPlanStatus(assistantData({ prerequisitesKnown: false }))
    expect(out.correlativas_publicadas).toBe(false)
    expect(out.nota_correlativas).toMatch(/no publica/)
  })
})

describe('getPendingFinals', () => {
  it('lists regularizadas with what their final habilita', () => {
    const out = getPendingFinals(assistantData())
    expect(out.finales).toEqual([
      expect.objectContaining({
        id: 'am1',
        materia: 'Análisis Matemático I',
        habilita_el_final_de: ['Análisis Matemático II'],
      }),
    ])
  })
})

describe('whatIf', () => {
  it('reports what a hypothetical status would open, without touching the data', () => {
    const data = assistantData()
    const before = JSON.stringify(data.views)
    const out = whatIf(data, [{ subjectId: 'so', status: 'passed' }])
    expect(out).toMatchObject({ se_abren_para_cursar: ['Redes de Datos'] })
    expect(JSON.stringify(data.views)).toBe(before)
  })

  it('refuses to simulate a plan with no correlativas', () => {
    const out = whatIf(assistantData({ availabilityInput: null, isUnmapped: true }), [
      { subjectId: 'so', status: 'passed' },
    ])
    expect(out).toHaveProperty('error')
  })

  it('rejects ids that are not in the plan', () => {
    expect(
      whatIf(assistantData(), [{ subjectId: 'inventada', status: 'passed' }]),
    ).toHaveProperty('error')
  })
})
