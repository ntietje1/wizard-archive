import { createFileRoute } from '@tanstack/react-router'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { NavBar } from '~/features/landing/components/nav-bar'
import { publicPageHead } from '~/features/landing/content/public-site'

function DemoRouteComponent() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="pt-16">
        <div className="relative h-[calc(100svh-4rem)] px-8 pb-8 sm:px-14 sm:pb-14 lg:px-20 lg:pb-20">
          <AssetPlaceholder
            label="Demo project preview placeholder"
            aspectRatio="auto"
            className="h-full"
          />
          <h1 className="pointer-events-none absolute inset-x-0 bottom-12 text-center text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground sm:bottom-20 lg:bottom-28">
            Demo Project
          </h1>
        </div>
      </main>
    </div>
  )
}

export const Route = createFileRoute('/demo')({
  head: () =>
    publicPageHead({
      title: 'Demo',
      description: "Demo project preview for The Wizard's Archive.",
    }),
  component: DemoRouteComponent,
})
