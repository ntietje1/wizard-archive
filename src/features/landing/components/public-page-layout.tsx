import type { ReactNode } from 'react'
import { LandingFooter } from '~/features/landing/components/landing-footer'
import { NavBar } from '~/features/landing/components/nav-bar'

export function PublicPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <NavBar />
      <div className="pt-16">{children}</div>
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
