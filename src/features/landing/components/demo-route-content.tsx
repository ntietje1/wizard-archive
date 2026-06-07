import { ClientOnly, lazyRouteComponent } from '@tanstack/react-router'
import { Suspense } from 'react'
import { NavBar } from '~/features/landing/components/nav-bar'

const LazyDemoWorkspace = lazyRouteComponent(
  () => import('~/features/landing/components/demo-workspace-island'),
)

export function DemoRouteContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main
        className="min-h-screen px-3 pb-3 pt-[4.75rem] sm:px-4 sm:pb-4"
        aria-label="Demo project"
      >
        <div className="demo-elevated-frame h-[calc(100svh-5.5rem)] min-h-[32rem] overflow-hidden rounded-lg border border-border/70 bg-background sm:h-[calc(100svh-5.75rem)]">
          <Suspense fallback={null}>
            <ClientOnly fallback={null}>
              <LazyDemoWorkspace />
            </ClientOnly>
          </Suspense>
        </div>
      </main>
    </div>
  )
}
