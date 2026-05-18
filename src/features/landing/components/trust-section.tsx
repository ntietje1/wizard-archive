import { Check } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { publicSite } from '~/features/landing/content/public-site'

const trustPoints = [
  'Private by default',
  'Players join free',
  'Markdown export',
  'No data selling',
  'No AI training or AI features',
]

export function TrustSection() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your campaign stays yours.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                {publicSite.trust.contentOwnership} {publicSite.trust.exportAvailability}
              </p>
              <p>
                {publicSite.trust.privateByDefault} {publicSite.trust.noDataSelling}{' '}
                {publicSite.trust.noAiTraining}
              </p>
            </div>
          </div>
          <ul className="mt-6 grid gap-3">
            {trustPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </LandingContainer>
    </section>
  )
}
