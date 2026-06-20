import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreAccountDialogTriggerFocus } from './AccountCombobox'

describe('restoreAccountDialogTriggerFocus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns focus to the account trigger after dialog selection', () => {
    const focus = vi.fn()
    const setTimeout = vi.fn((callback: () => void) => {
      callback()
      return 1
    })

    vi.stubGlobal('window', { setTimeout })

    restoreAccountDialogTriggerFocus({ focus } as unknown as HTMLElement)

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0)
    expect(focus).toHaveBeenCalled()
  })

  it('does nothing when no trigger is available', () => {
    const setTimeout = vi.fn()
    vi.stubGlobal('window', { setTimeout })

    restoreAccountDialogTriggerFocus(null)

    expect(setTimeout).not.toHaveBeenCalled()
  })
})
