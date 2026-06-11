import { ClientOnly, lazyRouteComponent } from '@tanstack/react-router'
import { Suspense } from 'react'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { NavBar } from '~/features/landing/components/nav-bar'
import { TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED } from '~/features/landing/components/temporary-public-demo-placeholders'

const LazyDemoWorkspace = lazyRouteComponent(
  () => import('~/features/landing/components/demo-workspace-island'),
)

export function DemoRouteContent() {
  const demoContent = TEMPORARY_PUBLIC_DEMO_PLACEHOLDERS_ENABLED ? (
    <DemoProjectPlaceholder />
  ) : (
    <div className="demo-elevated-frame min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
      <Suspense fallback={<DemoProjectPlaceholder />}>
        <ClientOnly fallback={<DemoProjectPlaceholder />}>
          <LazyDemoWorkspace />
        </ClientOnly>
      </Suspense>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="flex min-h-screen p-24" aria-label="Demo project">
        {demoContent}
      </main>
    </div>
  )
}

function DemoProjectPlaceholder() {
  return (
    <AssetPlaceholder
      aspectRatio="auto"
      className="min-h-0 flex-1"
      label="Demo project preview placeholder"
    />
  )
}
