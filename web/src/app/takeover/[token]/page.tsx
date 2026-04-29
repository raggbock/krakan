'use client'

import { use, useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import {
  useTakeoverInfo,
  useTakeoverStart,
  useTakeoverFeedback,
  useTakeoverRemove,
} from '@/hooks/use-takeover'

const ERROR_LABEL: Record<string, string> = {
  token_not_found: 'Länken är ogiltig.',
  token_already_used: 'Länken har redan använts.',
  token_invalidated: 'Länken har spärrats.',
  token_expired: 'Länken har gått ut.',
  email_mismatch: 'E-postadressen matchar inte den länken skickades till.',
  code_invalid: 'Fel kod. Försök igen.',
  code_expired: 'Koden har gått ut. Begär en ny.',
  no_code_sent: 'Ingen kod skickad. Börja om.',
  too_many_attempts: 'För många felaktiga försök. Begär en ny länk från admin.',
  market_removed: 'Den här loppisen är borttagen.',
}

function labelFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return ERROR_LABEL[msg] ?? msg
}

type View =
  | { kind: 'choose' }
  | { kind: 'claim' }
  | { kind: 'feedback' }
  | { kind: 'remove' }
  | { kind: 'success'; message: string }

export default function TakeoverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const info = useTakeoverInfo(token)
  const posthog = usePostHog()
  const [view, setView] = useState<View>({ kind: 'choose' })
  const [linkTracked, setLinkTracked] = useState(false)

  useEffect(() => {
    if (linkTracked || !info.data) return
    posthog?.capture('takeover_link_clicked', {
      market_id: info.data.marketId,
    })
    setLinkTracked(true)
  }, [info.data, linkTracked, posthog])

  if (info.isLoading) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </main>
    )
  }

  if (info.isError) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold">Det gick inte</h1>
          <p className="mt-2 text-espresso/65">{labelFor(info.error)}</p>
        </div>
      </main>
    )
  }

  const market = info.data!

  return (
    <div className="min-h-dvh">
      <header className="max-w-5xl mx-auto px-6 sm:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-display font-semibold text-forest text-[22px] tracking-tight">
          <FyndstigenLogo size={28} className="text-forest" />
          <span>fyndstigen</span>
        </div>
        <a
          href="mailto:hej@fyndstigen.se"
          className="text-sm font-semibold text-espresso-light hover:text-rust"
        >
          Kontakt
        </a>
      </header>

      {view.kind === 'choose' && (
        <ChooseView market={market} onSelect={(kind) => setView({ kind })} />
      )}

      {view.kind === 'claim' && (
        <ClaimView
          token={token}
          market={market}
          onCancel={() => setView({ kind: 'choose' })}
        />
      )}

      {view.kind === 'feedback' && (
        <FeedbackView
          token={token}
          market={market}
          onCancel={() => setView({ kind: 'choose' })}
          onDone={() =>
            setView({
              kind: 'success',
              message: 'Tack! Vi fixar det snarast och hör av oss när det är klart.',
            })
          }
        />
      )}

      {view.kind === 'remove' && (
        <RemoveView
          token={token}
          market={market}
          onCancel={() => setView({ kind: 'choose' })}
          onDone={() =>
            setView({
              kind: 'success',
              message: 'Sidan är borttagen. Tack för att ni meddelade oss.',
            })
          }
        />
      )}

      {view.kind === 'success' && <SuccessView message={view.message} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

type Market = {
  name: string
  city: string | null
  region: string | null
  sourceUrl: string | null
  maskedEmail: string | null
  marketId: string
}

function ChooseView({
  market,
  onSelect,
}: {
  market: Market
  onSelect: (kind: 'claim' | 'feedback' | 'remove') => void
}) {
  return (
    <>
      <section className="max-w-3xl mx-auto px-6 sm:px-8 pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
        <span className="inline-block text-[13px] font-bold uppercase tracking-[0.12em] text-rust bg-rust/[0.08] rounded-pill px-3.5 py-1.5 mb-4 sm:mb-7">
          Hej!
        </span>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.05] tracking-[-0.02em] text-espresso mb-6">
          Vi har lagt till{' '}
          <em className="italic font-normal text-forest">{market.name}</em>{' '}
          på&nbsp;fyndstigen.
        </h1>
        <p className="text-lg text-espresso-light max-w-xl mx-auto leading-relaxed font-medium">
          Tack för att ni ordnar loppis! Vi vill hjälpa fler hitta till er.
          Här är sidan vi skapat — ni bestämmer vad som händer nu.
        </p>
      </section>

      <div className="max-w-xl mx-auto px-6 sm:px-8 mb-16">
        <p className="text-center text-[13px] font-semibold tracking-wide text-espresso/55 mb-4">
          <span className="mx-3">—</span>Så här ser er sida ut i appen
          <span className="mx-3">—</span>
        </p>
        <div className="relative bg-card border border-cream-warm rounded-card p-7 shadow-[0_1px_2px_rgba(44,36,29,0.04),0_4px_12px_rgba(44,36,29,0.03),0_20px_40px_-20px_rgba(73,99,66,0.15)] -rotate-[0.5deg] hover:rotate-0 transition-transform duration-500">
          <span className="absolute top-4 right-4 text-[10px] font-extrabold tracking-[0.15em] text-espresso/55 bg-cream-warm rounded px-2 py-1">
            EXEMPEL
          </span>
          <h2 className="font-display text-[26px] font-medium leading-tight tracking-tight mb-2">
            {market.name}
          </h2>
          {(market.city || market.region) && (
            <p className="text-[15px] text-espresso-light font-medium mb-5">
              📍 {[market.city, market.region].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex gap-4 flex-wrap pt-4 border-t border-dashed border-cream-warm text-[13px] text-espresso/55 font-medium">
            {market.sourceUrl ? (
              <span>
                <strong className="text-espresso-light font-bold">Källa:</strong>{' '}
                <a
                  href={market.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-cream-warm hover:decoration-rust"
                >
                  {hostname(market.sourceUrl)}
                </a>
              </span>
            ) : (
              <span>
                <strong className="text-espresso-light font-bold">Källa:</strong>{' '}
                Publik information
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="max-w-5xl mx-auto px-6 sm:px-8 pb-20">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-tight mb-3">
            Vad vill ni göra?
          </h2>
          <p className="text-espresso-light font-medium max-w-md mx-auto">
            Tre alternativ, inga konstigheter. Ta er tid.
          </p>
        </div>

        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ChoiceCard
            tone="primary"
            badge="Rekommenderas"
            icon="🗝️"
            title="Ta över sidan"
            body="Gratis, tar 2 minuter — ni landar direkt på er sida, redo att redigera."
            cta="Gör anspråk →"
            onClick={() => onSelect('claim')}
            className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Benefit icon="🖼️" label="Egna bilder" />
              <Benefit icon="✏️" label="Redigera info" />
              <Benefit icon="📋" label="Bordbokning (valfritt)" />
              <Benefit icon="📈" label="Besökarstatistik" />
            </div>
            <div className="bg-parchment/50 rounded-card p-4 mb-6 text-sm">
              <p className="font-bold text-espresso text-[13px] uppercase tracking-wide mb-2">
                Så går det till
              </p>
              <ol className="space-y-1.5 text-espresso-light">
                <li>1. Skriv din e-post nedan</li>
                <li>2. Vi mailar en inloggningslänk</li>
                <li>3. Klart — du landar direkt på din sida, redo att redigera</li>
              </ol>
            </div>
          </ChoiceCard>
          <ChoiceCard
            tone="secondary"
            badge="Minimal insats"
            icon="✏️"
            title="Föreslå ändringar"
            body="Fel datum? Saknas info? Skicka en kort rad så fixar vi det åt er — utan att ni behöver skapa konto."
            cta="Skicka ändring →"
            onClick={() => onSelect('feedback')}
          />
          <ChoiceCard
            tone="tertiary"
            badge="Utan frågor"
            icon="🗑️"
            title="Ta bort sidan"
            body="Vill ni inte vara med? Klicka här så försvinner sidan direkt. Inga frågor, inga uppföljningar."
            cta="Ta bort →"
            onClick={() => onSelect('remove')}
          />
        </div>
      </section>

      <TrustSection />
      <FaqSection />
      <FooterSection />
    </>
  )
}

function ChoiceCard({
  tone,
  badge,
  icon,
  title,
  body,
  cta,
  onClick,
  className,
  children,
}: {
  tone: 'primary' | 'secondary' | 'tertiary'
  badge: string
  icon: string
  title: string
  body: string
  cta: string
  onClick: () => void
  className?: string
  children?: React.ReactNode
}) {
  const badgeClass =
    tone === 'primary'
      ? 'bg-forest text-parchment'
      : tone === 'secondary'
        ? 'bg-mustard text-espresso'
        : 'bg-cream-warm text-espresso-light'
  const btnClass =
    tone === 'primary'
      ? 'bg-forest text-parchment hover:bg-forest-light'
      : tone === 'secondary'
        ? 'bg-espresso text-parchment hover:bg-espresso-light'
        : 'bg-transparent text-espresso-light border border-cream-warm hover:border-espresso-light hover:text-espresso'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-card border border-cream-warm rounded-card p-8 text-left flex flex-col shadow-[0_1px_2px_rgba(44,36,29,0.04),0_4px_12px_rgba(44,36,29,0.03)] hover:-translate-y-0.5 hover:border-forest transition-all duration-200 cursor-pointer group${className ? ` ${className}` : ''}`}
    >
      <span
        className={`self-start text-[11px] font-extrabold uppercase tracking-[0.12em] rounded-pill px-2.5 py-1 mb-4 ${badgeClass}`}
      >
        {badge}
      </span>
      <div className="text-[32px] leading-none mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="font-display text-2xl font-medium tracking-tight mb-2.5 text-espresso">
        {title}
      </h3>
      <p className="text-[15px] text-espresso-light font-medium leading-relaxed mb-6">
        {body}
      </p>
      {children}
      <span
        className={`inline-flex items-center gap-2 self-start px-5 py-3 rounded-pill text-sm font-bold transition-all mt-auto ${btnClass}`}
      >
        {cta}
      </span>
    </button>
  )
}

function Benefit({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-parchment/50 rounded-card p-3 text-center">
      <span className="text-2xl leading-none" aria-hidden="true">
        {icon}
      </span>
      <span className="text-[12px] font-semibold text-espresso leading-tight">{label}</span>
    </div>
  )
}

function ClaimView({
  token,
  market,
  onCancel,
}: {
  token: string
  market: Market
  onCancel: () => void
}) {
  const start = useTakeoverStart()
  const posthog = usePostHog()
  // Single-step claim now: submit email → server creates user, claims
  // market, mails magic-link → done. No 6-digit code round-trip — the
  // magic-link itself proves inbox control, same as the code did.
  const [step, setStep] = useState<'email' | 'done'>('email')
  const [email, setEmail] = useState('')

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault()
    try {
      await start.mutateAsync({ token, email })
      posthog?.capture('takeover_email_submitted', {
        market_id: market.marketId,
        success: true,
      })
      setStep('done')
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err)
      const errorCode = rawMsg in ERROR_LABEL ? rawMsg : 'unknown'
      posthog?.capture('takeover_email_submitted', {
        market_id: market.marketId,
        success: false,
        error_reason: errorCode,
      })
      /* surfaced via start.isError */
    }
  }

  return (
    <FocusedPanel title={`Ta över ${market.name}`} onCancel={step === 'done' ? undefined : onCancel}>
      {step === 'email' && (
        <form onSubmit={onSubmitEmail} className="space-y-4">
          <p className="text-sm text-espresso-light">
            Skriv in samma e-post som invitet kom till
            {market.maskedEmail ? <> — <code className="font-mono">{market.maskedEmail}</code></> : null}.
            Vi skickar en inloggningslänk till den adressen.
          </p>
          <div>
            <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
              Din e-post
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@domän.se"
              className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
            />
          </div>
          <button
            type="submit"
            disabled={start.isPending}
            className="w-full bg-forest text-parchment px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-forest-light transition-colors"
          >
            {start.isPending ? 'Skickar länk…' : 'Skicka inloggningslänk'}
          </button>
          {start.isError && (
            <p className="text-error text-sm">{labelFor(start.error)}</p>
          )}
          <p className="text-xs text-espresso/55">
            Genom att fortsätta bekräftar du att du är behörig att representera{' '}
            {market.name}.
          </p>
        </form>
      )}

      {step === 'done' && (
        <div className="rounded-card border border-forest/30 bg-forest/[0.06] p-5 space-y-3">
          <h3 className="font-display text-xl font-medium text-forest">Klart!</h3>
          <p className="text-sm text-espresso-light">
            Vi har skickat en inloggningslänk till <strong>{email}</strong>.
            Klicka på den i ditt mejl så loggas du in och landar direkt på
            sidan för {market.name}, redo att redigera.
          </p>
          <p className="text-xs text-espresso/55">
            Hittar du inget mejl? Kolla skräpposten — det kommer från
            noreply@fyndstigen.se.
          </p>
        </div>
      )}
    </FocusedPanel>
  )
}

function FeedbackView({
  token,
  market,
  onCancel,
  onDone,
}: {
  token: string
  market: Market
  onCancel: () => void
  onDone: () => void
}) {
  const feedback = useTakeoverFeedback()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await feedback.mutateAsync({ token, email, message })
      onDone()
    } catch { /* surfaced via feedback.isError */ }
  }

  return (
    <FocusedPanel title={`Föreslå ändring för ${market.name}`} onCancel={onCancel}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-espresso-light">
          Berätta vad som ska ändras, så fixar vi det.
        </p>
        <div>
          <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
            E-post (så vi kan svara)
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@exempel.se"
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium focus:outline-none focus:border-forest"
          />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
            Vad ska ändras?
          </label>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="T.ex. 'Datumet är fel, ska vara 10 maj istället för 3 maj'"
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium min-h-[120px] focus:outline-none focus:border-forest"
          />
        </div>
        <button
          type="submit"
          disabled={feedback.isPending}
          className="w-full bg-forest text-parchment px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-forest-light transition-colors"
        >
          {feedback.isPending ? 'Skickar…' : 'Skicka'}
        </button>
        {feedback.isError && (
          <p className="text-error text-sm">{labelFor(feedback.error)}</p>
        )}
      </form>
    </FocusedPanel>
  )
}

function RemoveView({
  token,
  market,
  onCancel,
  onDone,
}: {
  token: string
  market: Market
  onCancel: () => void
  onDone: () => void
}) {
  const remove = useTakeoverRemove()
  const [reason, setReason] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await remove.mutateAsync({ token, reason: reason.trim() || undefined })
      onDone()
    } catch { /* surfaced via remove.isError */ }
  }

  return (
    <FocusedPanel title={`Ta bort ${market.name}`} onCancel={onCancel}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-espresso-light">
          Sidan försvinner från appen direkt. Ni behöver inte motivera.
        </p>
        <div>
          <label className="block text-[13px] font-bold text-espresso-light mb-1.5">
            Anledning <span className="font-normal text-espresso/55">(valfritt)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Hjälper oss bli bättre, men lämna tomt om ni vill"
            className="w-full px-3.5 py-3 rounded-input border border-cream-warm bg-parchment text-espresso font-medium min-h-[100px] focus:outline-none focus:border-forest"
          />
        </div>
        <button
          type="submit"
          disabled={remove.isPending}
          className="w-full bg-rust text-white px-5 py-3 rounded-pill font-bold disabled:opacity-50 hover:bg-rust-light transition-colors"
        >
          {remove.isPending ? 'Tar bort…' : 'Ta bort sidan'}
        </button>
        {remove.isError && (
          <p className="text-error text-sm">{labelFor(remove.error)}</p>
        )}
      </form>
    </FocusedPanel>
  )
}

function FocusedPanel({
  title,
  children,
  onCancel,
}: {
  title: string
  children: React.ReactNode
  onCancel?: () => void
}) {
  return (
    <main className="max-w-md mx-auto px-6 sm:px-8 py-12">
      <div className="bg-card border border-cream-warm rounded-card p-8 shadow-[0_1px_2px_rgba(44,36,29,0.04),0_4px_12px_rgba(44,36,29,0.03)]">
        <h2 className="font-display text-2xl font-medium tracking-tight mb-5 text-espresso">
          {title}
        </h2>
        {children}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 text-sm text-espresso/55 hover:text-espresso"
          >
            Avbryt
          </button>
        )}
      </div>
    </main>
  )
}

function SuccessView({ message }: { message: string }) {
  return (
    <main className="max-w-md mx-auto px-6 sm:px-8 py-16 text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-forest text-parchment grid place-items-center text-3xl font-bold">
        ✓
      </div>
      <h2 className="font-display text-3xl font-medium tracking-tight mb-3">
        Klart!
      </h2>
      <p className="text-espresso-light font-medium">{message}</p>
    </main>
  )
}

function TrustSection() {
  return (
    <section className="bg-forest text-parchment py-16 px-6 sm:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-normal italic tracking-tight mb-10">
          Så här jobbar vi
        </h2>
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-3 text-left">
          <TrustPoint num="01" title="Öppen källa alltid">
            Varje sida länkar till originalkällan — ert Facebook-event eller
            hemsida. Vi stjäl inte trafik, vi driver den till er.
          </TrustPoint>
          <TrustPoint num="02" title="Ni äger er data">
            Vill ni tas bort? Ett klick. Vill ni ändra? Ett mejl. Ingen
            inlåsning, ingen byråkrati.
          </TrustPoint>
          <TrustPoint num="03" title="Aldrig någon kostnad">
            Att vara listad kostar ingenting — nu eller senare. Bordbokning för
            säljare är valfritt och har egen prissättning.
          </TrustPoint>
        </div>
      </div>
    </section>
  )
}

function TrustPoint({
  num,
  title,
  children,
}: {
  num: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-display text-4xl italic font-normal text-mustard-light leading-none">
        {num}
      </div>
      <div className="text-[17px] font-bold text-parchment">{title}</div>
      <div className="text-sm text-parchment/75 font-medium leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function FaqSection() {
  return (
    <section className="max-w-2xl mx-auto px-6 sm:px-8 py-20">
      <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-center mb-2">
        Vanliga frågor
      </h2>
      <p className="text-center text-espresso-light font-medium mb-10">
        Om något annat är oklart, mejla oss gärna direkt.
      </p>
      <FaqItem q="Varför dyker vår loppis upp utan att vi registrerat oss?">
        Vi bygger fyndstigen till en plats där fyndjägare hittar alla loppisar
        på ett ställe. För att appen ska vara värdefull från dag ett lägger vi
        in loppisar baserat på publika källor — främst Facebook-event och
        kommunkalendrar. Ni får alltid välja om ni vill ta över sidan, justera,
        eller försvinna.
      </FaqItem>
      <FaqItem q="Kostar det något att bli listad?">
        Nej. Listningen är och kommer förbli gratis. Om ni väljer att aktivera
        bordbokning för era säljare tar vi en liten avgift per bokad plats —
        men bara om ni aktivt slår på den funktionen.
      </FaqItem>
      <FaqItem q="Vad händer om jag inte svarar alls?">
        Inget dramatiskt. Sidan ligger kvar med informationen från er publika
        källa, och vi länkar tydligt till den. Ni kan när som helst höra av er
        för att ta över eller be oss ta bort sidan.
      </FaqItem>
      <FaqItem q="Vem ligger bakom fyndstigen?">
        En ensam utvecklare i Sverige som älskar loppisar och tröttnat på att
        scrolla genom 40 Facebook-event för att planera en lördag. Ingen
        styrelse, inget riskkapital — bara ett verktyg byggt för att lösa ett
        riktigt problem.
      </FaqItem>
      <FaqItem q="Får ni använda bilder från vårt Facebook-event?">
        Nej. Vi visar bara text (namn, datum, plats) från publika källor — inga
        bilder. Om ni tar över sidan kan ni själva ladda upp era egna bilder.
      </FaqItem>
    </section>
  )
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="border-b border-cream-warm py-6 group">
      <summary className="font-display text-xl font-medium cursor-pointer flex justify-between items-center gap-4 text-espresso list-none [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span className="text-2xl text-rust font-light flex-shrink-0 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 text-espresso-light font-medium leading-relaxed">
        {children}
      </p>
    </details>
  )
}

function FooterSection() {
  return (
    <footer className="bg-cream-warm border-t border-cream-warm py-12 px-6 sm:px-8 text-center">
      <div className="max-w-2xl mx-auto">
        <p className="text-espresso-light font-medium mb-4">
          Frågor, synpunkter eller beröm? Mejla{' '}
          <a
            href="mailto:hej@fyndstigen.se"
            className="text-forest font-bold border-b border-forest"
          >
            hej@fyndstigen.se
          </a>{' '}
          — du får svar av en riktig människa inom ett dygn.
        </p>
        <p className="text-[13px] text-espresso/55 italic mt-6">
          fyndstigen är en oberoende svensk app som hjälper fyndjägare hitta och
          planera sin loppisrunda.
        </p>
      </div>
    </footer>
  )
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
