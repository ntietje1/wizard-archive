import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { buttonVariants } from '~/features/shadcn/components/button'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { publicSite } from '~/features/landing/content/public-site'

const trustHighlights = [
  '14-day trial',
  'No card required',
  'Players join free',
  'Private by default',
  'Markdown import & export',
]

export function HeroSection() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center pt-16 pb-24">
      <LandingContainer className="flex flex-col items-center text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Your stories are shared.
          <br />
          Your notes should be too.
        </h1>

        <p className="mt-6 max-w-[600px] text-lg text-muted-foreground">
          The Wizard's Archive is a collaborative campaign manager where DMs and players can share
          notes and more.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            to="/sign-up"
            className={buttonVariants({ size: 'lg', className: 'text-base px-6' })}
          >
            Try for Free
          </Link>
          <Link
            to="/demo"
            className={buttonVariants({
              variant: 'outline',
              size: 'lg',
              className: 'text-base px-6',
            })}
          >
            Explore demo project
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {publicSite.trial.short} Demo project coming soon.
        </p>

        <div className="mt-16 w-full max-w-4xl">
          <AssetPlaceholder label="Hero product clip: campaign sidebar, active note, linked map, sharing controls, and a player preview showing the prepare-to-play workflow in one screen" />
        </div>

        <ul className="mt-6 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {trustHighlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" aria-hidden="true" />
              {highlight}
            </li>
          ))}
        </ul>
      </LandingContainer>
    </section>
  )
}
