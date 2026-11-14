import { isRedirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { PENDING_CAPTURE_KEY, readPendingCapture } from '@/features/items/share'
import { Route } from '@/routes/add'

type BeforeLoad = (ctx: { location: { searchStr: string } }) => unknown

function open(searchStr: string): unknown {
  const beforeLoad = Route.options.beforeLoad as unknown as BeforeLoad
  try {
    beforeLoad({ location: { searchStr } })
  } catch (thrown) {
    return thrown
  }
  return null
}

afterEach(() => window.sessionStorage.clear())

describe('/add', () => {
  it('keeps the shared draft and sends the student to Hoy', () => {
    const thrown = open('?kind=final&title=Final%20de%20F%C3%ADsica&ref=abcdefgh')

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: { to: string } }).options.to).toBe('/today')
    expect(readPendingCapture()).toMatchObject({
      kind: 'final',
      title: 'Final de Física',
      ref: 'abcdefgh',
    })
  })

  it('keeps the valid fields of a link with invalid ones', () => {
    open('?kind=nope&title=TP&due=ayer')

    expect(readPendingCapture()).toMatchObject({ kind: null, title: 'TP', dueAt: null })
  })

  it('still goes to Hoy, storing nothing, when nothing is usable', () => {
    const thrown = open('?foo=bar')

    expect(isRedirect(thrown)).toBe(true)
    expect(window.sessionStorage.getItem(PENDING_CAPTURE_KEY)).toBeNull()
  })
})
