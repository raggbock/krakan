import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Skapa loppisrunda',
  description:
    'Planera din egen loppisrunda — välj loppisar på kartan, optimera rutten och dela med vänner.',
  alternates: { canonical: '/rundor/skapa' },
}

export default function SkapaRundaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
