import { LandingContainer } from '~/features/landing/components/landing-container'
import { PricingSection } from '~/features/landing/components/pricing-section'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicSite } from '~/features/landing/content/public-site'

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

export function PricingRouteComponent() {
  return (
    <PublicPageLayout>
      <main>
        <section className="pt-20">
          <LandingContainer>
            <PublicPageHeader
              title="Pricing"
              description={`${publicSite.trial.disclosure} ${publicSite.pricing.playerAccess}`}
            />
          </LandingContainer>
        </section>
        <PricingSection showHeader={false} />
        <section className="pb-24">
          <LandingContainer>
            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              {purchaseDetails.map((detail) => (
                <section key={detail.title} className="rounded-lg p-6">
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
