'use client'

import Image from 'next/image'
import type { FleaMarketImageView } from '@fyndstigen/shared'
import { useDeps } from '@/providers/deps-provider'

type Props = {
  images: FleaMarketImageView[]
  marketName: string
}

/**
 * Image gallery for a market detail page.
 *
 * Expects images already sorted by the view-model. A single image renders
 * 2:1; two or more render in a responsive grid.
 */
export function MarketImageGallery({ images, marketName }: Props) {
  const { images: imagesPort } = useDeps()

  if (images.length === 0) return null

  const single = images.length === 1

  return (
    <div className="mb-8 animate-fade-up">
      <div className={`grid gap-3 ${single ? '' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {images.map((img, idx) => (
          <div
            key={img.id}
            className={`relative rounded-xl overflow-hidden bg-cream-warm ${
              single ? 'aspect-[2/1]' : 'aspect-square'
            }`}
          >
            <Image
              src={imagesPort.publicUrl(img.storagePath)}
              alt={marketName}
              fill
              sizes={single ? '100vw' : '(min-width: 640px) 33vw, 50vw'}
              className="object-cover"
              priority={idx === 0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
