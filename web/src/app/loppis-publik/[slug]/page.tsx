import { publicSource } from '@/app/loppis/[slug]/market-cache'
import { LoppisPageView } from '@/app/loppis/[slug]/loppis-view'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export default async function LoppisPublicPage({ params }: Props) {
  const { slug } = await params
  return <LoppisPageView slug={slug} source={publicSource} />
}
