import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServerData } from '@fyndstigen/shared'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'missing_slug' }, { status: 400 })

  const sb = await createSupabaseServerClient()
  const port = createSupabaseServerData(sb)
  const id = await port.getBlockSaleIdBySlug(slug)
  if (!id) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const meta = await port.getBlockSaleMeta(id)
  if (!meta) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ id, ...meta })
}
