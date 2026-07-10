import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { publicSite } from '~/features/landing/content/public-site'
import { buttonVariants } from '@wizard-archive/ui/shadcn/components/button-variants'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

const proFeatures = [
  'Unlimited campaigns',
  'Unlimited notes, maps, and canvases',
  'Unlimited free players',
  'Real-time collaboration',
  'Granular sharing controls',
  'View-as mode',
  'File uploads and storage',
  'Markdown import and export',
]

const freeFeatures = [
  'View and export all your campaigns',
  "Join and collaborate on others' campaigns",
]

export function PricingSection({ showHeader = true }: { showHeader?: boolean }) {
  const [annual, setAnnual] = useState(true)

  return (
    <section id="pricing" className="py-24">
      <LandingContainer className="flex flex-col items-center text-center">
        {showHeader ? (
          <>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Try it free for 14 days
            </h2>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Simple pricing
            </p>
          </>
        ) : null}

        <div
          className={cn(
            'grid w-full max-w-3xl gap-6 md:grid-cols-2',
            showHeader ? 'mt-12' : 'mt-0',
          )}
        >
          {/* Basic (Free) */}
          <div className="flex flex-col rounded-lg border border-border/30 bg-secondary/20 p-8 text-left">
            <h3 className="text-lg font-semibold text-foreground">Basic</h3>
            <p className="mt-1 text-sm text-muted-foreground">Join campaigns and keep access.</p>
            <p className="mt-6 text-3xl font-bold text-foreground">Free plan</p>
            <ul className="mt-8 flex-1 space-y-3">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-lg border border-primary/40 bg-secondary/30 p-8 text-left">
            <div className="absolute top-0 right-6 -translate-y-1/2">
              <div
                role="group"
                aria-label="Billing frequency"
                className="inline-flex rounded-full border border-border/50 bg-background/95 p-1 shadow-sm backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                    annual
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'bg-primary text-primary-foreground',
                  )}
                  aria-pressed={!annual}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                    annual
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={annual}
                >
                  Annual
                </button>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Pro</h3>
            <p className="mt-1 text-sm text-muted-foreground">Prepare, run, and share campaigns.</p>
            <div className="mt-6">
              {annual ? (
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm text-muted-foreground line-through">$10</span>
                    <span className="text-3xl font-bold text-foreground">
                      {publicSite.pricing.annualMonthly}
                    </span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                    <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      {publicSite.pricing.annualSavings}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {publicSite.pricing.annualTotal} billed annually.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {publicSite.pricing.monthly}
                    </span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Billed monthly.</p>
                </div>
              )}
            </div>
            <ul className="mt-8 flex-1 space-y-3">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Link
          to="/sign-up"
          className={buttonVariants({ size: 'lg', className: 'mt-10 text-base px-8' })}
        >
          Start free trial
        </Link>

        <p className="mt-4 text-xs text-muted-foreground">{publicSite.trial.disclosure}</p>
        <p className="mt-2 text-xs text-muted-foreground">{publicSite.pricing.playerAccess}</p>
      </LandingContainer>
    </section>
  )
}
