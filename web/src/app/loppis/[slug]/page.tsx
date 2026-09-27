import { sessionSource } from './market-cache'
import { LoppisPageView } from './loppis-view'

type Props = { params: Promise<{ slug: string }> }

export default async function LoppisPage({ params }: Props) {
  const { slug } = await params
  return <LoppisPageView slug={slug} source={sessionSource} />
}
