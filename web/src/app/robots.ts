import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/profile/', '/auth', '/admin', '/admin/'],
      },
    ],
    sitemap: 'https://fyndstigen.se/sitemap.xml',
  }
}
