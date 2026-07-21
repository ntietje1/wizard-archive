import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { assertSha256Digest, initialVersion, sha256Digest } from '../../resources/component-version'
import type { ReactNode } from 'react'
import type {
  MapImageAttachment,
  MapResourceContent,
  MapSession,
} from '../../resources/content-session-contract'
import { MapViewer } from '../map-viewer'
import { testDomainId } from '../../test/domain-id'
import { canonicalizeResourceTitle } from '../../resources/resource-record'
import { readWorkspaceResourceDrag } from '../../resources/workspace-resource-drag'
import { planMapResourcePins } from '../map-pin-placement'
import type { MapPinId } from '../../resources/domain-id'

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
  TransformComponent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const createObjectURL = vi.fn(() => 'blob:verified-map')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  class TestURL extends URL {}
  TestURL.createObjectURL = createObjectURL
  TestURL.revokeObjectURL = revokeObjectURL
  vi.stubGlobal('URL', TestURL)
})

afterEach(() => vi.unstubAllGlobals())

describe('MapViewer', () => {
  it('loads the selected layer through the session and revokes verified image URLs', async () => {
    const base = await attachment(new Uint8Array([1]))
    const layer = await attachment(new Uint8Array([2]))
    const loadImage = vi.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        bytes: new Uint8Array([2]),
        extension: 'png',
        mediaType: 'image/png',
      }),
    )
    const session = mapSession(
      {
        image: base,
        layers: [{ id: 'night', image: layer, name: 'Night' }],
        pins: [],
      },
      { loadImage },
    )
    const view = renderMap(session)

    expect(await screen.findByRole('img', { name: 'Harbor map' })).toHaveAttribute(
      'src',
      'blob:verified-map',
    )
    expect(loadImage).toHaveBeenCalledWith('night')
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Fit map' })).toBeVisible()

    expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Base map' }))
    await waitFor(() => expect(loadImage).toHaveBeenCalledWith(null))
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:verified-map')
  })

  it('distinguishes base, layered, missing, delayed, and changed focused pins', () => {
    const basePinId = testDomainId('mapPin', 'base-focus')
    const layerPinId = testDomainId('mapPin', 'layer-focus')
    const delayedPinId = testDomainId('mapPin', 'delayed-focus')
    const targetId = testDomainId('resource', 'focus-target')
    const destination = {
      kind: 'internal' as const,
      target: { kind: 'resource' as const, resourceId: targetId },
    }
    let content: MapResourceContent = {
      image: { status: 'unattached' },
      layers: [
        { id: 'day', image: { status: 'unattached' }, name: 'Day' },
        { id: 'night', image: { status: 'unattached' }, name: 'Night' },
      ],
      pins: [
        {
          id: basePinId,
          destination,
          layerId: null,
          visible: true,
          x: 10,
          y: 10,
        },
        {
          id: layerPinId,
          destination,
          layerId: 'night',
          visible: true,
          x: 20,
          y: 20,
        },
      ],
    }
    const session = mapSession(content)
    Object.defineProperty(session, 'content', { get: () => content })
    const view = render(mapViewer(session, true, basePinId))
    expect(screen.getByRole('button', { name: 'Base map' })).toHaveAttribute('aria-pressed', 'true')
    view.rerender(mapViewer(session, true, layerPinId))
    expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true')
    view.rerender(mapViewer(session, true, delayedPinId))
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')

    content = {
      ...content,
      pins: [
        ...content.pins,
        {
          id: delayedPinId,
          destination,
          layerId: 'night',
          visible: true,
          x: 30,
          y: 30,
        },
      ],
    }
    view.rerender(mapViewer(session, true, delayedPinId))
    expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    content = { ...content, pins: [...content.pins] }
    view.rerender(mapViewer(session, true, delayedPinId))
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')

    view.rerender(mapViewer(session, true, basePinId))
    expect(screen.getByRole('button', { name: 'Base map' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the verified image mounted across pin-only content projections', async () => {
    const image = await attachment(new Uint8Array([1]))
    let content: MapResourceContent = { image, layers: [], pins: [] }
    const loadImage = vi.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        bytes: new Uint8Array([1]),
        extension: 'png',
        mediaType: 'image/png',
      }),
    )
    const session = mapSession(content, { loadImage })
    Object.defineProperty(session, 'content', { get: () => content })
    const view = renderMap(session)
    await screen.findByRole('img', { name: 'Harbor map' })

    content = { ...content, image: { ...image } }
    view.rerender(mapViewer(session))

    expect(loadImage).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('keeps replacement controls and duplicate bars out of the map view', () => {
    renderMap(mapSession(emptyMap()), false)
    expect(screen.getByLabelText('Map content')).toHaveAttribute('data-workspace-mode', 'viewer')
    expect(screen.queryByRole('button', { name: /choose image|replace image/i })).toBeNull()
    expect(screen.queryByText('Harbor')).toBeNull()
  })

  it('renders permission-safe pins and creates new pins from workspace resource drops', async () => {
    const bytes = new Uint8Array([9])
    const image = await attachment(bytes)
    const targetId = testDomainId('resource', 'pin-target')
    const droppedId = testDomainId('resource', 'dropped-target')
    const pinId = testDomainId('mapPin', 'visible-pin')
    const content: MapResourceContent = {
      image,
      layers: [],
      pins: [
        {
          id: pinId,
          destination: { kind: 'internal', target: { kind: 'resource', resourceId: targetId } },
          layerId: null,
          visible: true,
          x: 20,
          y: 30,
        },
      ],
    }
    const execute = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, content, version: testVersion() }),
    )
    const loadImage = vi.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        bytes,
        extension: 'png',
        mediaType: 'image/png',
      }),
    )
    const openDestination = vi.fn()
    render(
      <MapViewer
        canEdit
        focusedPinId={pinId}
        mapResourceId={testDomainId('resource', 'map-viewer')}
        openDestination={openDestination}
        resolveResource={(resourceId) =>
          resourceId === targetId || resourceId === droppedId
            ? {
                id: resourceId,
                campaignId: testDomainId('campaign', 'pin-campaign'),
                displayParentId: null,
                kind: 'note',
                title: canonicalizeResourceTitle(
                  resourceId === targetId ? 'Pinned note' : 'Dropped note',
                ),
                icon: null,
                color: null,
                lifecycle: 'active',
                permission: 'edit',
                metadataVersion: testVersion(),
                createdAt: 1,
                updatedAt: 1,
              }
            : null
        }
        session={mapSession(content, { execute, loadImage })}
        title="Harbor"
      />,
    )
    const imageElement = await screen.findByRole('img', { name: 'Harbor map' })
    vi.spyOn(imageElement, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 100 }),
    )
    const pin = screen.getByRole('button', { name: 'Pinned note' })
    await waitFor(() => expect(pin).toHaveAttribute('data-selected', 'true'))
    fireEvent.click(pin)
    expect(openDestination).toHaveBeenCalledWith({
      kind: 'internal',
      target: { kind: 'resource', resourceId: targetId },
    })
    fireEvent.contextMenu(pin, { clientX: 10, clientY: 20 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove pin' }))
    expect(execute).toHaveBeenCalledWith({ type: 'removePin', pinId })

    const dataTransfer = {
      types: ['application/x-wizard-archive-resource-ids'],
      dropEffect: 'none',
      getData: () =>
        JSON.stringify({
          schema: 'resource-drag-v2',
          resourceIds: [droppedId],
        }),
    }
    expect(readWorkspaceResourceDrag(dataTransfer)).toEqual({
      resourceIds: [droppedId],
    })
    const mapSurface = imageElement.parentElement!
    const dragOver = createEvent.dragOver(mapSurface, { dataTransfer })
    Object.defineProperties(dragOver, {
      clientX: { value: 50 },
      clientY: { value: 25 },
    })
    fireEvent(mapSurface, dragOver)
    expect(mapSurface).toHaveAttribute('data-drop-feedback', 'Pin item to “Harbor”')
    expect(mapSurface).toHaveAttribute('data-drop-target', 'true')
    expect(screen.queryByText('Drop resources to create pins')).toBeNull()
    expect(
      planMapResourcePins({
        existingPins: content.pins,
        layerId: null,
        mapResourceId: testDomainId('resource', 'map-viewer'),
        position: { x: 50, y: 25 },
        resourceIds: [droppedId],
      }),
    ).toEqual({
      type: 'createPins',
      pins: [
        expect.objectContaining({
          destination: {
            kind: 'internal',
            target: { kind: 'resource', resourceId: droppedId },
          },
          layerId: null,
          x: 50,
          y: 25,
        }),
      ],
    })
  })
})

async function attachment(bytes: Uint8Array): Promise<MapImageAttachment> {
  return {
    status: 'attached',
    byteSize: bytes.byteLength,
    digest: await sha256Digest(bytes),
    mediaType: 'image/png',
  }
}

function emptyMap(): MapResourceContent {
  return { image: { status: 'unattached' }, layers: [], pins: [] }
}

function mapSession(
  content: MapResourceContent,
  overrides: Partial<Pick<MapSession, 'execute' | 'loadImage' | 'replaceImage'>> = {},
): MapSession {
  return {
    content,
    version: testVersion(),
    awareness: { status: 'unavailable' },
    execute:
      overrides.execute ??
      vi.fn(() =>
        Promise.resolve({ status: 'rejected' as const, reason: 'unauthorized' as const }),
      ),
    loadImage:
      overrides.loadImage ??
      vi.fn(() =>
        Promise.resolve({
          status: 'unavailable' as const,
          reason: 'capability_not_supported' as const,
        }),
      ),
    replaceImage:
      overrides.replaceImage ??
      vi.fn(() =>
        Promise.resolve({ status: 'rejected' as const, reason: 'unauthorized' as const }),
      ),
    dispose: vi.fn(),
  }
}

function renderMap(session: MapSession, canEdit = true) {
  return render(mapViewer(session, canEdit))
}

function mapViewer(session: MapSession, canEdit = true, focusedPinId: MapPinId | null = null) {
  return (
    <MapViewer
      canEdit={canEdit}
      focusedPinId={focusedPinId}
      mapResourceId={testDomainId('resource', 'map-viewer')}
      openDestination={vi.fn()}
      resolveResource={() => null}
      session={session}
      title="Harbor"
    />
  )
}

function testVersion() {
  return initialVersion(assertSha256Digest('a'.repeat(64)))
}
