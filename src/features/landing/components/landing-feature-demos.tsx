import { ClientOnly, lazyRouteComponent } from '@tanstack/react-router'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED } from '~/features/landing/components/temporary-public-demo-placeholders'

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
  if (TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED) {
    return (
      <ProductDemoPlaceholder
        className="h-[440px]"
        label="Landing campaign workspace preview placeholder"
      />
    )
  }

  return (
    <ClientIsland
      fallback={
        <ProductDemoPlaceholder
          className="h-[440px]"
          label="Landing campaign workspace preview placeholder"
        />
      }
    >
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
  if (TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED) {
    return <ProductDemoPlaceholder className="h-[420px]" label="Workspace demo placeholder" />
  }

  return (
    <ClientIsland
      fallback={<ProductDemoPlaceholder className="h-[420px]" label="Workspace demo placeholder" />}
    >
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
  if (TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED) {
    return (
      <ProductDemoPlaceholder className="h-[390px]" label="Production canvas preview placeholder" />
    )
  }

  return (
    <ClientIsland
      fallback={
        <ProductDemoPlaceholder
          className="h-[390px]"
          label="Production canvas preview placeholder"
        />
      }
    >
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

function ProductDemoPlaceholder({ className, label }: { className: string; label: string }) {
  return <AssetPlaceholder aspectRatio="auto" className={className} label={label} />
}
