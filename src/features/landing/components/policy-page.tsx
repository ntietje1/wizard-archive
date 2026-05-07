import type { ReactNode } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicSite } from '~/features/landing/content/public-site'

export function PolicyPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <article className="mx-auto max-w-3xl">
            <PublicPageHeader
              title={title}
              description={description}
              meta={`Effective date: ${publicSite.effectiveDate}`}
            />
            <div className="mt-12 space-y-10">{children}</div>
          </article>
        </LandingContainer>
      </main>
    </PublicPageLayout>
  )
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}
