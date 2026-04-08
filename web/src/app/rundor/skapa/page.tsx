'use client'

import dynamic from 'next/dynamic'

const RouteBuilder = dynamic(() => import('@/components/route-builder'), {
  ssr: false,
})

export default function CreateRoutePage() {
  return <RouteBuilder />
}
