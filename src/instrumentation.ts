export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAMLScheduler } = await import('./lib/aml/scheduler')
    startAMLScheduler()
  }
}
