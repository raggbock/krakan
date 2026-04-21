import type { ImageUploadStatus } from '@/hooks/use-create-market'

export function ImageUploadList({ statuses }: { statuses: ImageUploadStatus[] }) {
  return (
    <ul className="space-y-2 mb-5 bg-parchment rounded-xl p-3 border border-cream-warm">
      {statuses.map((s, i) => (
        <li
          key={`${s.name}-${i}`}
          className="flex items-center gap-3 text-sm"
        >
          <StatusIcon state={s.state} />
          <span
            className={`flex-1 truncate ${
              s.state === 'error'
                ? 'text-error'
                : s.state === 'done'
                  ? 'text-espresso/60'
                  : 'text-espresso'
            }`}
          >
            {s.name}
          </span>
          <span
            className={`text-xs font-medium shrink-0 ${
              s.state === 'error'
                ? 'text-error'
                : s.state === 'done'
                  ? 'text-forest'
                  : 'text-espresso/45'
            }`}
          >
            {labelFor(s.state)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function labelFor(state: ImageUploadStatus['state']): string {
  switch (state) {
    case 'pending':
      return 'Väntar'
    case 'uploading':
      return 'Laddar upp...'
    case 'done':
      return 'Klar'
    case 'error':
      return 'Misslyckades'
  }
}

function StatusIcon({ state }: { state: ImageUploadStatus['state'] }) {
  if (state === 'uploading') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0 animate-spin text-rust"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path
          d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (state === 'done') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0 text-forest"
      >
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
        <path
          d="M4.5 7.2L6.3 9L9.5 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (state === 'error') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0 text-error"
      >
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 5L9 9M9 5L5 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="shrink-0 text-espresso/25"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}
