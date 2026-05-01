'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth-context'
import { BlockSaleForm } from '@/components/block-sale-form'
import { useBlockSaleCreate } from '@/hooks/use-block-sale'

export default function CreateBlockSalePage() {
  const { user } = useAuth()
  const router = useRouter()
  const posthog = usePostHog()
  const mut = useBlockSaleCreate()

  useEffect(() => {
    posthog?.capture('block_sale_create_started', {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-espresso/70">Logga in för att skapa ett kvartersloppis.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="font-display text-3xl font-bold mb-4">Skapa kvartersloppis</h1>
      <p className="text-espresso/70 mb-6">
        Som arrangör skapar du eventet — sen kan grannar ansöka om att stå med sina egna stånd.
      </p>
      <BlockSaleForm
        onSubmit={async (input) => {
          const res = await mut.mutateAsync(input)
          router.push(`/kvartersloppis/${res.slug}/admin`)
        }}
        busy={mut.isPending}
        error={mut.error}
      />
    </div>
  )
}
