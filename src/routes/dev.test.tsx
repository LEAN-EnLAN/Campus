import {
  createMemoryHistory,
  createRouter,
  isNotFound,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Route as RootRoute } from './__root'
import { Route as DevRoute } from './dev'

// vitest.config.ts defines `__CAMPUS_TESTER__: false`: these run as a build
// without the tester flag, which is what a hosted build always is.
describe('/dev without the tester flag', () => {
  it('refuses before rendering anything', () => {
    const beforeLoad = DevRoute.options.beforeLoad as unknown as () => void
    let thrown: unknown = null
    try {
      beforeLoad()
    } catch (error) {
      thrown = error
    }
    expect(isNotFound(thrown)).toBe(true)
  })

  it('is the ordinary "page not found", not a screen saying the tools are off', async () => {
    const dev = DevRoute.update({
      id: '/dev',
      path: '/dev',
      getParentRoute: () => RootRoute,
    } as never)
    const router = createRouter({
      routeTree: RootRoute.addChildren([dev]),
      history: createMemoryHistory({ initialEntries: ['/dev'] }),
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('No encontramos esta página')).toBeInTheDocument()
    expect(screen.queryByText(/herramientas de tester/i)).toBeNull()
    expect(screen.queryByText(/Escenarios/)).toBeNull()
  })
})
