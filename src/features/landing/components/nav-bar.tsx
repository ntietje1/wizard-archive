import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { WizardArchiveLogo } from '~/shared/components/wizard-archive-logo'

export function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16',
        scrolled ? 'border-b border-border/30 bg-background' : 'bg-transparent',
      )}
    >
      <LandingContainer className="flex h-full items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5">
          <WizardArchiveLogo className="h-5 w-5" />
          <span className="text-base font-semibold text-foreground">{"Wizard's Archive"}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <a
            href="#features"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="https://discord.gg/VhfzjsaXTD"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Discord
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link to="/sign-up" className={buttonVariants()}>
            Try for Free
          </Link>
        </div>
        <button
          type="button"
          className="flex items-center justify-center md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </LandingContainer>

      {mobileOpen && (
        <div className="absolute inset-x-0 top-16 bg-background border-b border-border/30 md:hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            <a
              href="#features"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </a>
            <a
              href="#pricing"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Pricing
            </a>
            <a
              href="https://discord.gg/VhfzjsaXTD"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Discord
            </a>
            <hr className="my-2 border-border/30" />
            <Link
              to="/sign-in"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Link to="/sign-up" className={buttonVariants({ className: 'mt-1' })}>
              Try for Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
