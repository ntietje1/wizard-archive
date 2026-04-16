import { Link } from '@tanstack/react-router'
import { buttonVariants } from '~/features/shadcn/components/button'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'

export function HeroSection() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center pt-16 pb-24">
      <LandingContainer className="flex flex-col items-center text-center">
        <p className="mb-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          The collaborative campaign manager for TTRPGs
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Your stories are shared.
          <br />
          Your notes should be too.
        </h1>

        <p className="mt-6 max-w-[600px] text-lg text-muted-foreground">
          The Wizard's Archive is the real-time campaign manager where DMs and players share one
          workspace — and everyone sees exactly what they should.
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
          Free for 14 days. No credit card required. Demo project coming soon.
        </p>

        <div className="mt-16 w-full max-w-4xl">
          <AssetPlaceholder
            label="Product demo video — editing → sharing → view-as → player update"
            showPlayButton
          />
        </div>
      </LandingContainer>
    </section>
  )
}
