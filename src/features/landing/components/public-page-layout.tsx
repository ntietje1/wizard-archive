import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { LandingFooter } from '~/features/landing/components/landing-footer'
import { publicSite } from '~/features/landing/content/public-site'
import { buttonVariants } from '~/features/shadcn/components/button'
import { WizardArchiveLogo } from '~/shared/components/wizard-archive-logo'

export function PublicPageLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="relative border-b border-border/20">
        <LandingContainer className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <WizardArchiveLogo className="h-7 w-7" />
            <span className="text-base font-semibold text-foreground">{publicSite.brandName}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="/#features"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Features
            </a>
            <a
              href={publicSite.routes.pricing}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </a>
            <Link
              to={publicSite.routes.community}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Community
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/sign-in"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Log in
            </Link>
            <Link to="/sign-up" className={buttonVariants({ size: 'sm' })}>
              Try for free
            </Link>
            <button
              type="button"
              className="flex items-center justify-center text-foreground md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </LandingContainer>

        {mobileOpen && (
          <div className="absolute inset-x-0 top-16 z-50 border-b border-border/30 bg-background md:hidden">
            <div className="flex flex-col gap-1 px-6 py-4">
              <a
                href="/#features"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Features
              </a>
              <a
                href={publicSite.routes.pricing}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </a>
              <Link
                to={publicSite.routes.community}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Community
              </Link>
              <hr className="my-2 border-border/30" />
              <Link
                to="/sign-in"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
            </div>
          </div>
        )}
      </header>
      {children}
      <LandingFooter />
    </div>
  )
}

export function PublicPageHeader({
  title,
  description,
  meta,
}: {
  title: string
  description?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      {description ? (
        <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
      ) : null}
      {meta ? <p className="mt-4 text-xs text-muted-foreground">{meta}</p> : null}
    </div>
  )
}
