import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PublicDemoHeroIsland,
  PublicDemoSharingFeatureIsland,
} from '~/features/landing/components/public-demo-islands'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '~/editor-adapters/local/public-demo-workspace-presets'
import { LocalWorkspaceRuntimeHost } from '~/editor-adapters/local/local-workspace-runtime-host'
import { LocalDemoRouteContent } from '~/routes/-demo-content'
import type { ReactNode } from 'react'
import type * as TanStackRouter from '@tanstack/react-router'

vi.mock('~/features/landing/components/nav-bar', () => ({
  NavBar: () => <nav aria-label="Public navigation" />,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    ClientOnly: ({ children }: { children: ReactNode }) => children,
  }
})

const RUNTIME_SURFACE_TIMEOUT_MS = 10_000
const RUNTIME_NAVIGATION_TEST_TIMEOUT_MS = 15_000

describe('landing demo runtime surfaces', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('DOMMatrix', MockDOMMatrix)
    Element.prototype.getAnimations = vi.fn(() => [])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (Element.prototype as { getAnimations?: Element['getAnimations'] }).getAnimations
  })

  it(
    'navigates the landing replica from note to the shared canvas surface',
    async () => {
      render(<PublicDemoHeroIsland />)

      fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))

      expect(
        await screen.findByLabelText('Canvas surface', {}, { timeout: RUNTIME_SURFACE_TIMEOUT_MS }),
      ).toBeInTheDocument()
    },
    RUNTIME_NAVIGATION_TEST_TIMEOUT_MS,
  )

  it(
    'navigates the editable demo workspace from note to the shared canvas editor surface',
    async () => {
      render(<LocalDemoRouteContent />)

      fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))

      expect(
        await screen.findByLabelText('Canvas surface', {}, { timeout: RUNTIME_SURFACE_TIMEOUT_MS }),
      ).toBeInTheDocument()
    },
    RUNTIME_NAVIGATION_TEST_TIMEOUT_MS,
  )

  it('mounts the collaborative landing note without live campaign providers', async () => {
    render(<PublicDemoSharingFeatureIsland />)

    expect(await screen.findByLabelText('Collaborative note preview')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Session Notes')).toBeInTheDocument()
  })

  it('mounts collaborative Session Notes with an embedded revealed prep note state', async () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)
    const sessionBlocks = scenario.workspace.noteAdditionalBlocksById['note-session'] ?? []

    render(
      <LocalWorkspaceRuntimeHost
        ariaLabel="Collaborative Session Notes"
        canEdit
        initialItemId={scenario.initialItemId}
        initialWorkspace={scenario.workspace}
        openSeparateItem={vi.fn()}
        sidebar="none"
        workspaceName="Demo workspace"
      />,
    )

    expect(await screen.findByLabelText('Collaborative Session Notes')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Session Notes')).toBeInTheDocument()
    expect(scenario.workspace.noteBodiesById['note-session']).toContain('Scene: Moonwell Docks')
    expect(scenario.workspace.noteBodiesById['note-market']).toContain(
      'GM secret: Mara Vell planted the blue-glass invoice to bait the Salt Warehouse clerk',
    )
    expect(sessionBlocks).toEqual([
      expect.objectContaining({
        type: 'embed',
        props: expect.objectContaining({
          targetKind: 'resource',
          resourceId: 'note-market',
        }),
      }),
    ])
  })

  it('renders layered map pins with unavailable linked items omitted from player view', async () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

    render(
      <LocalWorkspaceRuntimeHost
        ariaLabel="Layered lore map"
        canEdit
        initialItemId={scenario.initialItemId}
        initialWorkspace={scenario.workspace}
        openSeparateItem={vi.fn()}
        sidebar="none"
        workspaceName="Demo workspace"
      />,
    )

    expect(await screen.findByLabelText('Layered lore map')).toBeInTheDocument()
    fireEvent.load(await screen.findByAltText('Moonwell Docks - Layer 1'))

    expect(await screen.findByRole('button', { name: 'Blue-glass Invoice' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '???' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Harbor Heist Board' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Layer 2' }))
    fireEvent.load(await screen.findByAltText('Moonwell Docks - Layer 2'))

    expect(await screen.findByRole('button', { name: 'Tide Tunnel Sketch' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Blue-glass Invoice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Harbor Heist Board' })).not.toBeInTheDocument()
  })

  it('renders the player-preview scenario with private prep hidden from the selected player', async () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.playerPreview)

    render(
      <LocalWorkspaceRuntimeHost
        ariaLabel="Player preview"
        canEdit
        initialItemId={scenario.initialItemId}
        initialWorkspace={scenario.workspace}
        openSeparateItem={vi.fn()}
        sidebar="none"
        workspaceName="Demo workspace"
      />,
    )

    expect(await screen.findByLabelText('Player preview')).toBeInTheDocument()
    expect(await screen.findByText(/Players know the public auction starts at dusk/)).toBeVisible()
    expect(screen.queryByText(/GM secret:/)).not.toBeInTheDocument()
  })

  it('renders the revealed-in-play scenario with the revealed prep visible to the selected player', async () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay)

    render(
      <LocalWorkspaceRuntimeHost
        ariaLabel="Revealed in play"
        canEdit
        initialItemId={scenario.initialItemId}
        initialWorkspace={scenario.workspace}
        openSeparateItem={vi.fn()}
        sidebar="none"
        workspaceName="Demo workspace"
      />,
    )

    expect(await screen.findByLabelText('Revealed in play')).toBeInTheDocument()
    expect(
      await screen.findByText(
        /GM secret: Mara Vell planted the blue-glass invoice to bait the Salt Warehouse clerk/,
      ),
    ).toBeVisible()
  })

  it('opens the landing replica trash view without live campaign providers', async () => {
    render(<PublicDemoHeroIsland />)

    fireEvent.click(screen.getByRole('button', { name: 'Trash' }))

    expect(
      await screen.findByText(/Items older than \d+ days are automatically deleted/),
    ).toBeInTheDocument()
  })
})

class MockResizeObserver implements ResizeObserver {
  readonly observed: Array<Element> = []

  observe(element: Element) {
    this.observed.push(element)
  }

  unobserve(element: Element) {
    const index = this.observed.indexOf(element)
    if (index >= 0) this.observed.splice(index, 1)
  }

  disconnect() {
    this.observed.length = 0
  }
}

class MockDOMMatrix {}
