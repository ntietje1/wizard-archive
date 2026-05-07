import { Check } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { publicSite } from '~/features/landing/content/public-site'

const trustPoints = [
  'Private by default',
  'Players join free',
  'Markdown export',
  'No data selling',
  'No AI training on private content',
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
          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
        </div>
      </LandingContainer>
    </section>
  )
}
