import type { LocalWorkspaceSeparateItemNavigation } from './local-workspace-runtime-adapter'
import { PUBLIC_DEMO_SCENARIO_IDS } from './public-demo-workspace-presets'
import type { PublicDemoScenarioId } from './public-demo-workspace-presets'
import { openBrowserExternalUrl } from '~/editor-adapters/browser/open-browser-external-url'

const PUBLIC_DEMO_ROUTE_PATH = '/demo'
const PUBLIC_DEMO_SCENARIO_VALUES = new Set<string>(Object.values(PUBLIC_DEMO_SCENARIO_IDS))

const DEFAULT_PUBLIC_DEMO_SCENARIO_ID = PUBLIC_DEMO_SCENARIO_IDS.campaignHome

type PublicDemoRouteSearch = {
  scenarioId: PublicDemoScenarioId
}

function parsePublicDemoScenarioId(value: string | null | undefined): PublicDemoScenarioId {
  return value && PUBLIC_DEMO_SCENARIO_VALUES.has(value)
    ? (value as PublicDemoScenarioId)
    : DEFAULT_PUBLIC_DEMO_SCENARIO_ID
}

export function parsePublicDemoRouteSearchParams(
  searchParams: URLSearchParams,
): PublicDemoRouteSearch {
  return {
    scenarioId: parsePublicDemoScenarioId(searchParams.get('scenario')),
  }
}

export function createOpenSeparateDemoItem({
  basePath = PUBLIC_DEMO_ROUTE_PATH,
  scenarioId,
}: {
  basePath?: string
  scenarioId: PublicDemoScenarioId
}): LocalWorkspaceSeparateItemNavigation {
  return ({ heading, itemId }) => {
    const url = new URL(basePath, window.location.origin)
    url.searchParams.set('scenario', scenarioId)
    url.searchParams.set('item', itemId)
    if (heading) {
      url.searchParams.set('heading', heading)
    }
    openBrowserExternalUrl(url.toString())
  }
}
