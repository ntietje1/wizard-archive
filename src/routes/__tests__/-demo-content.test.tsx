import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import type * as TanStackRouter from '@tanstack/react-router'
import { LocalDemoRouteContent } from '~/routes/-demo-content'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '~/editor-adapters/local/public-demo-workspace-presets'

const clientOnlyState = vi.hoisted(() => ({
  renderClient: false,
}))

const workspaceRuntimeHostMock = vi.hoisted(() => vi.fn())
const workspaceRuntimeHostProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}))
const useLocalWorkspaceRuntimeMock = vi.hoisted(() =>
  vi.fn((_props: Record<string, unknown>) => ({
    workspace: { id: 'demo-workspace', instanceId: 'demo-runtime' },
  })),
)

vi.mock('~/features/landing/components/nav-bar', () => ({
  NavBar: () => <nav aria-label="Public navigation" />,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    ClientOnly: ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) =>
      clientOnlyState.renderClient ? children : fallback,
  }
})

vi.mock('~/editor-adapters/local/use-local-workspace-runtime', () => ({
  useLocalWorkspaceRuntime: (props: Record<string, unknown>) => useLocalWorkspaceRuntimeMock(props),
}))

vi.mock('@wizard-archive/editor', () => ({
  WizardEditor: (props: Record<string, unknown>) => {
    workspaceRuntimeHostMock(props)
    workspaceRuntimeHostProps.current = props
    return <div aria-label={props.ariaLabel as string}>Local demo workspace</div>
  },
}))

describe('LocalDemoRouteContent', () => {
  beforeEach(() => {
    clientOnlyState.renderClient = false
    workspaceRuntimeHostProps.current = null
    workspaceRuntimeHostMock.mockReset()
    useLocalWorkspaceRuntimeMock.mockClear()
    window.history.replaceState(null, '', '/')
  })

  it('server-renders the local workspace loading surface', () => {
    render(<LocalDemoRouteContent />)

    expect(screen.getByLabelText('Public navigation')).toBeInTheDocument()
    expect(screen.getByLabelText('Demo page')).toContainElement(
      screen.getByLabelText('Demo workspace frame'),
    )
    expect(screen.getByText('Loading demo workspace')).toBeInTheDocument()
  })

  it('mounts the local workspace from item URL state', () => {
    clientOnlyState.renderClient = true
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)
    const resourceId = scenario.workspace.snapshot.resources[0]!.id
    window.history.replaceState(null, '', `/demo?resource=${resourceId}&heading=Intro`)

    render(<LocalDemoRouteContent />)

    expect(screen.getByText('Local demo workspace')).toBeInTheDocument()
    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResourceId: resourceId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostProps.current).toMatchObject({
      ariaLabel: 'Demo workspace',
    })
  })

  it('mounts the requested public demo scenario from URL state', () => {
    clientOnlyState.renderClient = true
    window.history.replaceState(null, '', '/demo?scenario=layered-lore-map')
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

    render(<LocalDemoRouteContent />)

    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResourceId: scenario.initialResourceId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
  })

  it('falls back to the campaign home scenario for malformed scenario URL state', () => {
    clientOnlyState.renderClient = true
    window.history.replaceState(null, '', '/demo?scenario=../../private')
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

    render(<LocalDemoRouteContent />)

    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResourceId: scenario.initialResourceId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
  })

  it('drops malformed local workspace URL state before mounting the demo', () => {
    clientOnlyState.renderClient = true
    window.history.replaceState(
      null,
      '',
      `/demo?resource=${encodeURIComponent('../private-note')}&heading=${'h'.repeat(513)}`,
    )
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

    render(<LocalDemoRouteContent />)

    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResourceId: scenario.initialResourceId,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
  })

  it('mounts the editor host with an empty heading request when URL state is absent', () => {
    clientOnlyState.renderClient = true
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

    render(<LocalDemoRouteContent />)

    expect(screen.getByLabelText('Demo workspace')).toBeInTheDocument()
    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResourceId: null,
        initialWorkspace: expect.objectContaining({
          scope: scenario.workspace.scope,
          snapshot: scenario.workspace.snapshot,
        }),
      }),
    )
    expect(workspaceRuntimeHostProps.current).toMatchObject({
      runtime: {
        workspace: { id: 'demo-workspace', instanceId: 'demo-runtime' },
      },
      workspaceName: 'Demo workspace',
    })
  })
})
