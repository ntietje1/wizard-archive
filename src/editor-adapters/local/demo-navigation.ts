import { PUBLIC_DEMO_SCENARIO_IDS } from './public-demo-workspace-presets'
import type { PublicDemoScenarioId } from './public-demo-workspace-presets'
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
