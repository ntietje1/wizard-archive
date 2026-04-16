import { Link } from '@tanstack/react-router'
import { buttonVariants } from '~/features/shadcn/components/button'
import { LandingContainer } from '~/features/landing/components/landing-container'

export function FinalCtaSection() {
  return (
    <section className="py-32">
      <LandingContainer className="flex flex-col items-center text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ready to run your next session?
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Free for 14 days. Your players join free. No credit card required.
        </p>
        <Link
          to="/sign-up"
          className={buttonVariants({ size: 'lg', className: 'mt-8 text-base px-8' })}
        >
          Try for free
        </Link>
      </LandingContainer>
    </section>
  )
}
