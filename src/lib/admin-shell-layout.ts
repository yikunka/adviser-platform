export const ADMIN_SHELL_CLASSNAMES = {
  root: 'theme-dark admin-console admin-shell-viewport flex overflow-hidden',
  sidebar: `
    fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col flex-shrink-0
    transform transition-transform duration-300 ease-in-out
    md:sticky md:top-0 md:bottom-auto md:self-stretch md:translate-x-0
  `,
  frame: 'flex-1 flex min-w-0 min-h-0 flex-col overflow-hidden',
  main: 'flex-1 min-h-0 overflow-auto p-6',
} as const
