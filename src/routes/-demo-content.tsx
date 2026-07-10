import { ClientOnly } from '@tanstack/react-router'
import { parseWorkspaceRouteSearchParams } from '~/editor-adapters/workspace-route-search'
import {
  createOpenSeparateDemoItem,
  parsePublicDemoRouteSearchParams,
} from '~/editor-adapters/local/demo-navigation'
import { LocalWorkspaceRuntimeHost } from '~/editor-adapters/local/local-workspace-runtime-host'
import { NavBar } from '~/features/landing/components/nav-bar'
import { createPublicDemoScenario } from '~/editor-adapters/local/public-demo-workspace-presets'

export function LocalDemoRouteContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main aria-label="Demo page" className="px-5 pb-5 pt-[84px]">
        <section
          aria-label="Demo workspace frame"
          className="demo-elevated-frame flex h-[calc(100vh-104px)] min-h-[520px] flex-col overflow-hidden rounded-lg border border-border/70 bg-background"
        >
          <ClientOnly fallback={<DemoProjectLoadingFrame />}>
            <LocalDemoWorkspace />
          </ClientOnly>
        </section>
      </main>
    </div>
  )
}

function LocalDemoWorkspace() {
  const initialSearch = getInitialDemoRouteSearch()
  const scenario = createPublicDemoScenario(initialSearch.scenarioId)

  return (
    <LocalWorkspaceRuntimeHost
      ariaLabel="Demo workspace"
      collaborationPlayback={scenario.collaborationPlayback}
      initialItemId={initialSearch.item ?? scenario.initialItemId}
      initialWorkspace={scenario.workspace}
      noteHeadingRequest={{
        heading: initialSearch.heading ?? null,
        onConsumed: clearInitialHeading,
      }}
      openSeparateItem={createOpenSeparateDemoItem({ scenarioId: scenario.id })}
      workspaceName="Demo workspace"
    />
  )
}

function DemoProjectLoadingFrame() {
  return (
    <div
      aria-label="Demo workspace"
      className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground"
    >
      Loading demo workspace
    </div>
  )
}

function getInitialDemoRouteSearch() {
  const searchParams =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search)
  return readDemoRouteSearch(searchParams)
}

function readDemoRouteSearch(searchParams: URLSearchParams) {
  return {
    ...parsePublicDemoRouteSearchParams(searchParams),
    ...parseWorkspaceRouteSearchParams(searchParams),
  }
}

function clearInitialHeading() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('heading')
  window.history.replaceState(window.history.state, '', url)
}
