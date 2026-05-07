import { createFileRoute } from '@tanstack/react-router'
import { FaqSection } from '~/features/landing/components/faq-section'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicPageHead, publicSite } from '~/features/landing/content/public-site'

function FaqRouteComponent() {
  return (
    <PublicPageLayout>
      <main>
        <section className="border-b border-border/20 py-20">
          <LandingContainer>
            <PublicPageHeader
              title="FAQ"
              description={`Product, trial, billing, privacy, and support details for ${publicSite.brandName}.`}
            />
          </LandingContainer>
        </section>
        <FaqSection showTitle={false} />
      </main>
    </PublicPageLayout>
  )
}

export const Route = createFileRoute('/faq')({
  head: () =>
    publicPageHead({
      title: 'FAQ',
      description:
        "Product, pricing, trial, privacy, and support answers for The Wizard's Archive campaign workspace.",
    }),
  component: FaqRouteComponent,
})
