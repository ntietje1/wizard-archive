import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  PublicDemoCanvasFeatureIsland,
  PublicDemoHeroIsland,
  PublicDemoMapFeatureIsland,
  PublicDemoSharingFeatureIsland,
  PublicDemoTemplateFeatureIsland,
  PublicDemoWorkspaceFeatureIsland,
} from '~/features/landing/components/public-demo-islands'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '~/editor-adapters/local/public-demo-workspace-presets'

const { localRuntimeInputMock } = vi.hoisted(() => {
  return {
    localRuntimeInputMock: vi.fn(),
  }
})
const { workspaceRuntimeHostMock, useLocalWorkspaceRuntimeMock } = vi.hoisted(() => ({
  workspaceRuntimeHostMock: vi.fn(),
  useLocalWorkspaceRuntimeMock: vi.fn((_props: Record<string, unknown>) => ({
    workspace: { id: 'demo-workspace', instanceId: 'runtime' },
  })),
}))

vi.mock('~/editor-adapters/local/use-local-workspace-runtime', () => ({
  useLocalWorkspaceRuntime: (props: Record<string, unknown>) => {
    localRuntimeInputMock(props)
    return useLocalWorkspaceRuntimeMock(props)
  },
}))

vi.mock('@wizard-archive/editor', () => ({
  WizardEditor: (props: Record<string, unknown>) => {
    workspaceRuntimeHostMock(props)
    const ariaLabel = typeof props.ariaLabel === 'string' ? props.ariaLabel : 'Demo workspace'
    const sidebar = typeof props.sidebar === 'string' ? props.sidebar : 'fixed'
    return (
      <section aria-label={ariaLabel} data-sidebar={sidebar}>
        Workspace runtime host
      </section>
    )
  },
  createBrowserWizardEditorViewStateStores: () => ({}),
}))

describe('public demo feature islands', () => {
  beforeEach(() => {
    localRuntimeInputMock.mockReset()
    workspaceRuntimeHostMock.mockReset()
    useLocalWorkspaceRuntimeMock.mockClear()
  })

  it('mounts the hero preview through the view-only local runtime and shared editor host', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

    render(<PublicDemoHeroIsland />)

    expect(screen.getByRole('region', { name: 'Demo workspace' })).toBeInTheDocument()
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Demo workspace',
        runtime: { workspace: { id: 'demo-workspace', instanceId: 'runtime' } },
        sidebar: 'fixed',
        workspaceName: 'Demo workspace',
      }),
    )
  })

  it('renders the workspace feature through the focused local runtime and shared editor host', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    render(<PublicDemoWorkspaceFeatureIsland />)

    expect(
      screen.getByRole('region', { name: 'Text editor link autocomplete preview' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region')).toHaveAttribute('data-sidebar', 'none')
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Text editor link autocomplete preview',
        sidebar: 'none',
      }),
    )
  })

  it('renders the standalone canvas demo through the focused local runtime and shared editor host', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)

    render(<PublicDemoCanvasFeatureIsland />)

    expect(screen.getByRole('region', { name: 'Canvas feature preview' })).toBeInTheDocument()
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Canvas feature preview',
        sidebar: 'none',
      }),
    )
  })

  it('renders the standalone map demo through the focused local runtime and shared editor host', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

    render(<PublicDemoMapFeatureIsland />)

    expect(screen.getByRole('region', { name: 'Map feature preview' })).toBeInTheDocument()
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Map feature preview',
        sidebar: 'none',
      }),
    )
  })

  it('renders the sharing demo through source-owned collaborative public workspace playback', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

    render(<PublicDemoSharingFeatureIsland />)

    expect(screen.getByRole('region', { name: 'Collaborative note preview' })).toBeInTheDocument()
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Collaborative note preview',
        sidebar: 'none',
      }),
    )
  })

  it('renders the templates demo through the focused local runtime and shared editor host', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate)

    render(<PublicDemoTemplateFeatureIsland />)

    expect(screen.getByRole('region', { name: 'Template note editor' })).toBeInTheDocument()
    expect(localRuntimeInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        initialItemId: scenario.initialItemId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Template note editor',
        sidebar: 'none',
      }),
    )
  })
})
