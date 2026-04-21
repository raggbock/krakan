import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fyndstigen — Hitta loppisar nära dig',
    short_name: 'Fyndstigen',
    description:
      'Samlar loppisar på ett ställe. Hitta fynd, boka bord och planera din loppisrunda.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2EBE0',
    theme_color: '#C45B35',
    lang: 'sv-SE',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/logo-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-512.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
