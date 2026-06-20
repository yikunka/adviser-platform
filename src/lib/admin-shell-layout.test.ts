import { describe, expect, it } from 'vitest'
import { ADMIN_SHELL_CLASSNAMES } from '@/lib/admin-shell-layout'

describe('ADMIN_SHELL_CLASSNAMES', () => {
  it('uses dynamic viewport compatibility classes instead of hard h-screen locks', () => {
    expect(ADMIN_SHELL_CLASSNAMES.root).toContain('admin-shell-viewport')
    expect(ADMIN_SHELL_CLASSNAMES.root).not.toContain('h-screen')

    expect(ADMIN_SHELL_CLASSNAMES.sidebar).not.toContain('h-screen')
    expect(ADMIN_SHELL_CLASSNAMES.sidebar).toContain('md:self-stretch')

    expect(ADMIN_SHELL_CLASSNAMES.frame).toContain('min-h-0')
    expect(ADMIN_SHELL_CLASSNAMES.frame).not.toContain('h-screen')

    expect(ADMIN_SHELL_CLASSNAMES.main).toContain('min-h-0')
  })
})
