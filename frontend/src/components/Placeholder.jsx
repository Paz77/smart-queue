import { Hourglass } from 'lucide-react'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import { PageHeader } from './PageHeader'

// Shown for pages that are not available yet.
export function Placeholder({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={Hourglass} title="This page isn't available yet" description="Check back soon." />
      </Card>
    </>
  )
}
