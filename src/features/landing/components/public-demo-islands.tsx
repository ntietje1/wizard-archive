import { LocalWorkspaceRuntimeHost } from '~/editor-adapters/local/local-workspace-runtime-host'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '~/editor-adapters/local/public-demo-workspace-presets'
import type { PublicDemoScenario } from '~/editor-adapters/local/public-demo-workspace-presets'

export function PublicDemoHeroIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

  return <PublicDemoIsland ariaLabel="Demo workspace" canEdit={false} scenario={scenario} />
}

export function PublicDemoWorkspaceFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)

  return (
    <PublicDemoIsland
      ariaLabel="Text editor link autocomplete preview"
      canEdit
      scenario={scenario}
      sidebar="none"
    />
  )
}

export function PublicDemoCanvasFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)

  return scenario.initialItemId ? (
    <PublicDemoIsland ariaLabel="Canvas feature preview" scenario={scenario} sidebar="none" />
  ) : null
}

export function PublicDemoMapFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

  return scenario.initialItemId ? (
    <PublicDemoIsland ariaLabel="Map feature preview" scenario={scenario} sidebar="none" />
  ) : null
}

export function PublicDemoSharingFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

  return (
    <PublicDemoIsland
      ariaLabel="Collaborative note preview"
      canEdit
      scenario={scenario}
      sidebar="none"
    />
  )
}

export function PublicDemoTemplateFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate)

  return (
    <PublicDemoIsland ariaLabel="Template note editor" canEdit scenario={scenario} sidebar="none" />
  )
}

function PublicDemoIsland({
  ariaLabel,
  canEdit = true,
  scenario,
  sidebar = 'fixed',
}: {
  ariaLabel: string
  canEdit?: boolean
  scenario: PublicDemoScenario
  sidebar?: 'fixed' | 'none' | 'resizable'
}) {
  return (
    <LocalWorkspaceRuntimeHost
      ariaLabel={ariaLabel}
      canEdit={canEdit}
      initialItemId={scenario.initialItemId}
      initialWorkspace={scenario.workspace}
      sidebar={sidebar}
      workspaceName="Demo workspace"
    />
  )
}
