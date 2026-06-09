import { ClientOnly, lazyRouteComponent } from '@tanstack/react-router'
import { Suspense } from 'react'
import type { ReactNode } from 'react'

const LazyHeroProductDemo = lazyRouteComponent(
  () => import('~/features/landing/components/hero-product-demo-island'),
)
const LazyWorkspaceFeatureDemo = lazyRouteComponent(
  () => import('~/features/landing/components/workspace-feature-demo-island'),
)
const LazyCanvasFeatureDemo = lazyRouteComponent(
  () => import('~/features/landing/components/canvas-feature-demo-island'),
)

export function HeroProductDemo() {
  return (
    <ClientIsland fallback={<ProductDemoFrame className="h-[440px]" />}>
      <section
        className="demo-elevated-frame h-[440px] overflow-hidden rounded-lg border border-border/70 bg-background text-left"
        aria-label="Landing campaign workspace preview"
      >
        <LazyHeroProductDemo />
      </section>
    </ClientIsland>
  )
}

export function WorkspaceFeatureDemo() {
  return (
    <ClientIsland fallback={<ProductDemoFrame className="h-[420px]" />}>
      <section
        className="demo-elevated-frame h-[420px] overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Workspace demo"
      >
        <LazyWorkspaceFeatureDemo />
      </section>
    </ClientIsland>
  )
}

export function CanvasFeatureDemo() {
  return (
    <ClientIsland fallback={<ProductDemoFrame className="h-[390px]" />}>
      <section
        className="demo-elevated-frame h-[390px] overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Production canvas preview"
      >
        <LazyCanvasFeatureDemo />
      </section>
    </ClientIsland>
  )
}

function ClientIsland({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>{children}</ClientOnly>
    </Suspense>
  )
}

function ProductDemoFrame({ className }: { className: string }) {
  return (
    <section
      className={`demo-elevated-frame overflow-hidden rounded-lg border border-border/70 bg-background ${className}`}
      aria-hidden="true"
    />
  )
}
