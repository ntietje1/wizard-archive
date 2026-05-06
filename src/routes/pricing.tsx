import { createFileRoute } from '@tanstack/react-router'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { PricingSection } from '~/features/landing/components/pricing-section'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicPageHead, publicSite } from '~/features/landing/content/public-site'

const purchaseDetails = [
  {
    title: 'Trial and payment',
    body: `${publicSite.trial.disclosure} ${publicSite.pricing.playerAccess}`,
  },
  {
    title: 'Cancellation and refunds',
    body: `${publicSite.billing.cancellation} ${publicSite.billing.refunds}`,
  },
  {
    title: 'Your content',
    body: `${publicSite.trust.contentOwnership} ${publicSite.trust.exportAvailability}`,
  },
  {
    title: 'Privacy',
    body: `${publicSite.trust.privateByDefault} ${publicSite.trust.noDataSelling} ${publicSite.trust.noAiTraining}`,
  },
]

function PricingRouteComponent() {
  return (
    <PublicPageLayout>
      <main>
        <section className="border-b border-border/20 py-20">
          <LandingContainer>
            <PublicPageHeader
              title="Pricing"
              description={`${publicSite.trial.disclosure} ${publicSite.pricing.playerAccess}`}
            />
          </LandingContainer>
        </section>
        <PricingSection showHeader={false} />
        <section className="border-t border-border/20 pb-24">
          <LandingContainer>
            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              {purchaseDetails.map((detail) => (
                <section
                  key={detail.title}
                  className="rounded-lg border border-border/30 bg-secondary/20 p-6"
                >
                  <h2 className="text-base font-semibold text-foreground">{detail.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail.body}</p>
                </section>
              ))}
            </div>
          </LandingContainer>
        </section>
      </main>
    </PublicPageLayout>
  )
}

export const Route = createFileRoute('/pricing')({
  head: () =>
    publicPageHead({
      title: 'Pricing',
      description:
        "Pricing, trial, and paid plan details for The Wizard's Archive campaign manager.",
    }),
  component: PricingRouteComponent,
})
