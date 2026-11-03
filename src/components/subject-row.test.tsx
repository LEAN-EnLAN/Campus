import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { computeSubjectViews } from '@/domain/availability'
import { subject } from '@/domain/test-fixtures'

import { SubjectRow } from './subject-row'

async function renderRow(control?: React.ReactNode) {
  const [view] = computeSubjectViews({
    subjects: [subject('am1', 'Análisis I')],
    prerequisites: [],
    states: [],
    prerequisitesKnown: true,
  })
  const root = createRootRoute({
    component: () => <SubjectRow subject={view!} control={control} />,
  })
  const course = createRoute({
    getParentRoute: () => root,
    path: '/courses/$courseId',
    component: () => null,
  })
  const router = createRouter({
    routeTree: root.addChildren([course]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByText('Análisis I')
}

describe('SubjectRow', () => {
  it('links to the subject', async () => {
    await renderRow()
    expect(screen.getByRole('link', { name: /Análisis I/ })).toHaveAttribute(
      'href',
      '/courses/am1',
    )
  })

  it('writes the status in words when it has no control to carry it', async () => {
    await renderRow()
    expect(
      screen.getByRole('link', { name: /Análisis I.*Disponible para cursar/ }),
    ).toBeInTheDocument()
  })

  it('leaves the status word to the control when there is one', async () => {
    await renderRow(<button type="button">Estado: Disponible para cursar</button>)
    expect(screen.getByRole('link', { name: /Análisis I/ })).not.toHaveTextContent('Disponible')
  })

  it('carries a control without nesting it inside the link', async () => {
    await renderRow(<button type="button">Aprobada</button>)
    const button = screen.getByRole('button', { name: 'Aprobada' })
    expect(button.closest('a')).toBeNull()
    expect(screen.getByRole('link', { name: /Análisis I/ })).toBeInTheDocument()
  })
})
