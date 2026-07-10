import { FaqSection } from '~/features/landing/components/faq-section'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicSite } from '~/features/landing/content/public-site'

export function FaqRouteComponent() {
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
