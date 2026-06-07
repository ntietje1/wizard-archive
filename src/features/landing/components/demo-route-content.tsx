import { DemoWorkspace } from '~/features/landing/components/demo-workspace'
import { NavBar } from '~/features/landing/components/nav-bar'

export function DemoRouteContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="pt-16" aria-label="Demo project">
        <DemoWorkspace />
      </main>
    </div>
  )
}
