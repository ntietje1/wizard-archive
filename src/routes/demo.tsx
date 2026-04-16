import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { buttonVariants } from '~/features/shadcn/components/button'

function DemoRouteComponent() {
  return (
    <main className="dark min-h-screen bg-background py-24 text-foreground">
      <LandingContainer className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Sparkles className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Demo Project
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          The interactive demo is on the way.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          We&apos;re putting together a guided sample campaign so visitors can explore the product
          without spoilers, dead ends, or placeholder UI. This page is the stub for that future demo
          experience.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link to="/" className={buttonVariants({ size: 'lg', className: 'px-6' })}>
            <ArrowLeft className="size-4" />
            Back to landing page
          </Link>
          <Link
            to="/sign-up"
            className={buttonVariants({
              size: 'lg',
              variant: 'outline',
              className: 'px-6',
            })}
          >
            Start free trial
          </Link>
        </div>
      </LandingContainer>
    </main>
  )
}

export const Route = createFileRoute('/demo')({
  component: DemoRouteComponent,
})
