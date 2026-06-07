import type { ReactNode } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicSite } from '~/features/landing/content/public-site'
import type {
  PublicPolicyPageContent,
  PublicSecurityPageContent,
} from '~/features/landing/content/public-policy-pages'

function PolicyPage({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
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

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}

export function PublicPolicyPage({ page }: { page: PublicPolicyPageContent }) {
  return (
    <PolicyPage title={page.title} description={page.description}>
      {page.sections.map((section) => (
        <PolicySection key={section.title} title={section.title}>
          {section.content}
        </PolicySection>
      ))}
    </PolicyPage>
  )
}

export function PublicSecurityPage({ page }: { page: PublicSecurityPageContent }) {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <PublicPageHeader title={page.title} description={page.description} />

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {page.principles.map((principle) => {
              const Icon = principle.icon

              return (
                <section
                  key={principle.title}
                  className="rounded-lg border border-border/30 bg-secondary/20 p-6"
                >
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-lg font-semibold text-foreground">{principle.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.body}</p>
                </section>
              )
            })}
          </div>

          <article className="mx-auto mt-16 max-w-3xl space-y-10">
            {page.sections.map((section) => (
              <PolicySection key={section.title} title={section.title}>
                {section.content}
              </PolicySection>
            ))}
          </article>
        </LandingContainer>
      </main>
    </PublicPageLayout>
  )
}
