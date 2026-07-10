import { ClientOnly, lazyRouteComponent } from '@tanstack/react-router'
import { Suspense } from 'react'
import type { ReactNode } from 'react'

const LazyHeroProductDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoHeroIsland,
  })),
)
const LazyWorkspaceFeatureDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoWorkspaceFeatureIsland,
  })),
)
const LazyCanvasFeatureDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoCanvasFeatureIsland,
  })),
)
const LazyMapFeatureDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoMapFeatureIsland,
  })),
)
const LazySharingFeatureDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoSharingFeatureIsland,
  })),
)
const LazyTemplateFeatureDemo = lazyRouteComponent(() =>
  import('./public-demo-islands').then((module) => ({
    default: module.PublicDemoTemplateFeatureIsland,
  })),
)

export function HeroProductDemo() {
  return (
    <ClientIsland
      fallback={
        <ProductDemoLoadingFrame
          className="h-[440px]"
          label="Loading landing campaign workspace preview"
        />
      }
    >
      <section
        className="demo-elevated-frame flex h-[440px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background text-left"
        aria-label="Landing campaign workspace preview"
      >
        <LazyHeroProductDemo />
      </section>
    </ClientIsland>
  )
}

export function WorkspaceFeatureDemo() {
  return (
    <ClientIsland
      fallback={<ProductDemoLoadingFrame className="h-[420px]" label="Loading workspace demo" />}
    >
      <section
        className="demo-elevated-frame flex h-[420px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Workspace demo"
      >
        <LazyWorkspaceFeatureDemo />
      </section>
    </ClientIsland>
  )
}

export function CanvasFeatureDemo() {
  return (
    <ClientIsland
      fallback={<ProductDemoLoadingFrame className="h-[390px]" label="Loading canvas preview" />}
    >
      <section
        className="demo-elevated-frame flex h-[390px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Production canvas preview"
      >
        <LazyCanvasFeatureDemo />
      </section>
    </ClientIsland>
  )
}

export function MapFeatureDemo() {
  return (
    <ClientIsland
      fallback={<ProductDemoLoadingFrame className="h-[390px]" label="Loading map preview" />}
    >
      <section
        className="demo-elevated-frame flex h-[390px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Map preview"
      >
        <LazyMapFeatureDemo />
      </section>
    </ClientIsland>
  )
}

export function SharingFeatureDemo() {
  return (
    <ClientIsland
      fallback={
        <ProductDemoLoadingFrame className="h-[420px]" label="Loading collaborative note preview" />
      }
    >
      <section
        className="demo-elevated-frame flex h-[420px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Collaborative note preview"
      >
        <LazySharingFeatureDemo />
      </section>
    </ClientIsland>
  )
}

export function TemplateFeatureDemo() {
  return (
    <ClientIsland
      fallback={
        <ProductDemoLoadingFrame className="h-[420px]" label="Loading template note preview" />
      }
    >
      <section
        className="demo-elevated-frame flex h-[420px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        aria-label="Template note preview"
      >
        <LazyTemplateFeatureDemo />
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

function ProductDemoLoadingFrame({ className, label }: { className: string; label: string }) {
  return (
    <output
      className={`demo-elevated-frame flex w-full items-center justify-center rounded-lg border border-border/50 bg-secondary/35 text-sm text-muted-foreground ${className}`}
      aria-label={label}
    >
      Loading preview
    </output>
  )
}
