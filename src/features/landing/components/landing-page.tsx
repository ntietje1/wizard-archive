import { NavBar } from '~/features/landing/components/nav-bar'
import { HeroSection } from '~/features/landing/components/hero-section'
import { FeatureSharing } from '~/features/landing/components/feature-sharing'
import { FeatureCanvases } from '~/features/landing/components/feature-canvases'
import { CoreToolsBento } from '~/features/landing/components/core-tools-bento'
import { AudienceSection } from '~/features/landing/components/audience-section'
import { PricingSection } from '~/features/landing/components/pricing-section'
import { FaqSection } from '~/features/landing/components/faq-section'
import { FinalCtaSection } from '~/features/landing/components/final-cta-section'
import { LandingFooter } from '~/features/landing/components/landing-footer'

export function LandingPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <HeroSection />
        <AudienceSection />
        <FeatureSharing />
        <FeatureCanvases />
        <CoreToolsBento />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
