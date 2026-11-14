import { afterEach, describe, expect, it, vi } from 'vitest'

import { consentGatedRecorder, setTrackRecorder, track } from './track'

afterEach(() => setTrackRecorder(null))

/** Let queued microtasks (the recorder's awaits) run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('track', () => {
  it('does nothing when no recorder is installed (Local, signed out)', () => {
    expect(() => track('share_copied', { ref: 'abcdefgh' })).not.toThrow()
  })

  it('hands the event to the installed recorder', async () => {
    const recorder = vi.fn(() => Promise.resolve())
    setTrackRecorder(recorder)
    track('share_saved', { ref: 'abcdefgh' })
    await settle()
    expect(recorder).toHaveBeenCalledWith('share_saved', { ref: 'abcdefgh' })
  })

  it('never throws when the recorder throws or rejects', async () => {
    setTrackRecorder(() => {
      throw new Error('boom')
    })
    expect(() => track('share_copied')).not.toThrow()

    setTrackRecorder(() => Promise.reject(new Error('network')))
    expect(() => track('share_copied')).not.toThrow()
    await settle()
  })
})

describe('consentGatedRecorder', () => {
  it('records nothing without consent', async () => {
    const record = vi.fn(() => Promise.resolve())
    setTrackRecorder(consentGatedRecorder({ hasConsent: async () => false, record }))
    track('share_copied', { ref: 'abcdefgh' })
    await settle()
    expect(record).not.toHaveBeenCalled()
  })

  it('records nothing when consent cannot be read', async () => {
    const record = vi.fn(() => Promise.resolve())
    setTrackRecorder(
      consentGatedRecorder({ hasConsent: () => Promise.reject(new Error('offline')), record }),
    )
    track('share_copied', { ref: 'abcdefgh' })
    await settle()
    expect(record).not.toHaveBeenCalled()
  })

  it('records the event and its ref with consent', async () => {
    const record = vi.fn(() => Promise.resolve())
    setTrackRecorder(consentGatedRecorder({ hasConsent: async () => true, record }))
    track('share_saved', { ref: 'abcdefgh' })
    track('share_copied')
    await settle()
    expect(record).toHaveBeenCalledWith('share_saved', 'abcdefgh')
    expect(record).toHaveBeenCalledWith('share_copied', null)
  })

  it('swallows a failed insert', async () => {
    setTrackRecorder(
      consentGatedRecorder({
        hasConsent: async () => true,
        record: () => Promise.reject(new Error('42501')),
      }),
    )
    expect(() => track('share_saved', { ref: 'abcdefgh' })).not.toThrow()
    await settle()
  })
})
