import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
  type RouteComponent,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { vi } from 'vitest'

/**
 * Render a route's component inside a real router, without the generated route
 * tree: `Link` and `useNavigate` need a router context and nothing else.
 */
export function renderRoute(Component: ComponentType, path = '/') {
  // jsdom does not implement it and the router calls it on every navigation.
  window.scrollTo = vi.fn()
  const rootRoute = createRootRoute({ component: Component as RouteComponent })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(<RouterProvider router={router} />)
}
