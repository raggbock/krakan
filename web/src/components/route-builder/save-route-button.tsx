'use client'

type Props = {
  disabled: boolean
  saving: boolean
  error: string
  onSave: () => void
}

export function SaveRouteButton({ disabled, saving, error, onSave }: Props) {
  return (
    <>
      {error && (
        <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mt-4">
          {error}
        </div>
      )}
      <button
        onClick={onSave}
        disabled={disabled || saving}
        className="w-full h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 mt-6 shadow-sm"
      >
        {saving ? 'Sparar...' : 'Spara loppisrunda'}
      </button>
    </>
  )
}
