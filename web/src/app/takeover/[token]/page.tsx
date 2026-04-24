'use client'

import { use, useState } from 'react'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import {
  useTakeoverInfo,
  useTakeoverStart,
  useTakeoverVerify,
} from '@/hooks/use-takeover'

const ERROR_LABEL: Record<string, string> = {
  token_not_found: 'Länken är ogiltig.',
  token_already_used: 'Länken har redan använts.',
  token_invalidated: 'Länken har spärrats.',
  token_expired: 'Länken har gått ut.',
  email_mismatch: 'E-postadressen matchar inte den du angav först.',
  code_invalid: 'Fel kod. Försök igen.',
  code_expired: 'Koden har gått ut. Begär en ny.',
  no_code_sent: 'Ingen kod skickad. Börja om.',
  too_many_attempts: 'För många felaktiga försök. Begär en ny länk från admin.',
}

function labelFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return ERROR_LABEL[msg] ?? msg
}

type Step = 'email' | 'code' | 'done'

export default function TakeoverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const info = useTakeoverInfo(token)
  const start = useTakeoverStart()
  const verify = useTakeoverVerify()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  if (info.isLoading) {
    return (
      <Centered><FyndstigenLogo size={40} className="text-rust animate-bob" /></Centered>
    )
  }

  if (info.isError) {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Det gick inte</h1>
          <p className="mt-2 text-espresso/65">{labelFor(info.error)}</p>
        </div>
      </Centered>
    )
  }

  const market = info.data!

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault()
    await start.mutateAsync({ token, email })
    setStep('code')
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault()
    await verify.mutateAsync({ token, email, code })
    setStep('done')
  }

  return (
    <Centered>
      <div className="max-w-md w-full space-y-6">
        <header className="text-center">
          <FyndstigenLogo size={36} className="text-rust mx-auto" />
          <h1 className="font-display text-2xl font-bold mt-3">Ta över {market.name}</h1>
          {(market.city || market.region) && (
            <p className="text-espresso/65 mt-1 text-sm">
              {[market.city, market.region].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="text-espresso/65 mt-3 text-sm">
            Vi har lagt upp en grundprofil baserat på offentlig info. Verifiera
            din e-post nedan så du kan redigera den fritt.
          </p>
        </header>

        {step === 'email' && (
          <form onSubmit={onSubmitEmail} className="space-y-3">
            <label className="block text-sm font-medium">Din e-post</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@domän.se"
              className="w-full px-3 py-2 rounded-md border border-cream-warm"
            />
            <button
              type="submit"
              disabled={start.isPending}
              className="w-full bg-rust text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
            >
              {start.isPending ? 'Skickar kod…' : 'Skicka verifieringskod'}
            </button>
            {start.isError && (
              <p className="text-red-700 text-sm">{labelFor(start.error)}</p>
            )}
            <p className="text-xs text-espresso/55">
              Genom att fortsätta bekräftar du att du är behörig att representera
              {' '}{market.name}.
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onSubmitCode} className="space-y-3">
            <p className="text-sm text-espresso/70">
              Vi har skickat en 6-siffrig kod till <strong>{email}</strong>.
              Koden gäller i 15 minuter.
            </p>
            <label className="block text-sm font-medium">Verifieringskod</label>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-3 py-2 rounded-md border border-cream-warm tracking-[0.4em] text-center text-2xl font-mono"
            />
            <button
              type="submit"
              disabled={verify.isPending || code.length !== 6}
              className="w-full bg-rust text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
            >
              {verify.isPending ? 'Verifierar…' : 'Bekräfta'}
            </button>
            {verify.isError && (
              <p className="text-red-700 text-sm">{labelFor(verify.error)}</p>
            )}
            <button
              type="button"
              onClick={() => { setStep('email'); setCode('') }}
              className="text-sm text-rust hover:underline"
            >
              Tillbaka
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <h2 className="font-display text-lg font-bold text-emerald-900">Klart!</h2>
            <p className="text-sm text-emerald-900">
              Profilen är nu kopplad till <strong>{email}</strong>. Vi har skickat
              en inloggningslänk till samma adress — klicka på den för att börja
              redigera {market.name}.
            </p>
          </div>
        )}
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">{children}</div>
  )
}
