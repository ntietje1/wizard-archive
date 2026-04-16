import { AudienceSection } from '~/features/landing/components/audience-section'
import { CampaignWorkspaceSection } from '~/features/landing/components/campaign-workspace-section'
import { CoreToolsBento } from '~/features/landing/components/core-tools-bento'
import { FaqSection } from '~/features/landing/components/faq-section'
import { FeatureCanvases } from '~/features/landing/components/feature-canvases'
import { FeatureMaps } from '~/features/landing/components/feature-maps'
import { FeatureSharing } from '~/features/landing/components/feature-sharing'
import { FinalCtaSection } from '~/features/landing/components/final-cta-section'
import { HeroSection } from '~/features/landing/components/hero-section'
import { LandingFooter } from '~/features/landing/components/landing-footer'
import { NavBar } from '~/features/landing/components/nav-bar'
import { PricingSection } from '~/features/landing/components/pricing-section'

export function LandingPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <HeroSection />
        <CampaignWorkspaceSection />
        <FeatureSharing />
        <AudienceSection />
        <FeatureMaps />
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
