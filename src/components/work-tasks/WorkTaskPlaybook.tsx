import { WORK_TASK_PLAYBOOK, type WorkTaskKind } from '@/lib/work-tasks/playbook-steps'

const card: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
}

export function WorkTaskPlaybook({ kind }: { kind: WorkTaskKind }) {
  const playbook = WORK_TASK_PLAYBOOK[kind]
  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        办理步骤{playbook.card ? `（Playbook ${playbook.card}）` : ''}
      </h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{playbook.deadline}</p>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm" style={{ color: 'var(--foreground)' }}>
        {playbook.steps.map((step, index) => (
          <li key={step}>{index + 1}. {step}</li>
        ))}
      </ol>
    </section>
  )
}
