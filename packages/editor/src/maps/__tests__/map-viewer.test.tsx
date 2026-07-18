import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    fireEvent.change(screen.getByRole('combobox', { name: 'Map layer' }), {
      target: { value: '' },
    })
    await waitFor(() => expect(loadImage).toHaveBeenCalledWith(null))
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:verified-map')
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

  it('uploads opaque map bytes without inspecting them', async () => {
    const replaceImage = vi.fn(() =>
      Promise.resolve({
        status: 'completed' as const,
        content: emptyMap(),
        version: testVersion(),
      }),
    )
    const session = mapSession(emptyMap(), { replaceImage })
    renderMap(session)
    const input = screen.getByLabelText('Choose map image')
    const bytes = new Uint8Array([1, 2, 3])
    const invalid = new File([Uint8Array.from(bytes).buffer], 'notes.txt', { type: 'text/plain' })
    Object.defineProperty(invalid, 'arrayBuffer', {
      value: () => Promise.resolve(Uint8Array.from(bytes).buffer),
    })
    fireEvent.change(input, { target: { files: [invalid] } })
    await waitFor(() =>
      expect(replaceImage).toHaveBeenCalledWith(null, session.version, {
        bytes,
        fileName: 'notes.txt',
      }),
    )
  })

  it('requires a fresh image replacement after a version conflict', async () => {
    const firstVersion = testVersion()
    const currentVersion = initialVersion(assertSha256Digest('b'.repeat(64)))
    const replaceImage = vi
      .fn<MapSession['replaceImage']>()
      .mockResolvedValueOnce({ status: 'rejected', reason: 'version_conflict' })
      .mockResolvedValueOnce({
        status: 'completed',
        content: emptyMap(),
        version: initialVersion(assertSha256Digest('c'.repeat(64))),
      })
    let version = firstVersion
    const session = mapSession(emptyMap(), { replaceImage })
    Object.defineProperty(session, 'version', { get: () => version })
    const staleBytes = new Uint8Array([1])
    const currentBytes = new Uint8Array([2])
    const staleImage = new File([staleBytes], 'stale.png', { type: 'image/png' })
    const currentImage = new File([currentBytes], 'current.png', { type: 'image/png' })
    Object.defineProperty(staleImage, 'arrayBuffer', {
      value: () => Promise.resolve(staleBytes.buffer),
    })
    Object.defineProperty(currentImage, 'arrayBuffer', {
      value: () => Promise.resolve(currentBytes.buffer),
    })
    const view = renderMap(session)

    fireEvent.change(screen.getByLabelText('Choose map image'), {
      target: { files: [staleImage] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This map changed while the image was uploading.',
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(replaceImage).toHaveBeenCalledOnce()

    version = currentVersion
    view.rerender(mapViewer(session))
    fireEvent.change(screen.getByLabelText('Choose map image'), {
      target: { files: [currentImage] },
    })

    await waitFor(() => expect(replaceImage).toHaveBeenCalledTimes(2))
    expect(replaceImage.mock.calls[0]![1]).toBe(firstVersion)
    expect(replaceImage.mock.calls[1]![1]).toBe(currentVersion)
    expect(replaceImage.mock.calls[1]![2]).not.toBe(replaceImage.mock.calls[0]![2])
  })

  it('retries an uncertain image replacement against the exact captured target', async () => {
    const replaceImage = vi
      .fn<MapSession['replaceImage']>()
      .mockResolvedValueOnce({ status: 'retryable', reason: 'response_lost' })
      .mockResolvedValueOnce({
        status: 'completed',
        content: emptyMap(),
        version: initialVersion(assertSha256Digest('d'.repeat(64))),
      })
    const session = mapSession(emptyMap(), { replaceImage })
    const bytes = new Uint8Array([1, 2, 3])
    const image = new File([bytes], 'map.png', { type: 'image/png' })
    Object.defineProperty(image, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer),
    })
    renderMap(session)

    fireEvent.change(screen.getByLabelText('Choose map image'), { target: { files: [image] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The map image replacement could not be confirmed.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(replaceImage).toHaveBeenCalledTimes(2))
    expect(replaceImage.mock.calls[1]![0]).toBe(replaceImage.mock.calls[0]![0])
    expect(replaceImage.mock.calls[1]![1]).toBe(replaceImage.mock.calls[0]![1])
    expect(replaceImage.mock.calls[1]![2]).toBe(replaceImage.mock.calls[0]![2])
  })

  it('retires a retry when layer selection changes its immutable target', async () => {
    const replaceImage = vi.fn<MapSession['replaceImage']>(() =>
      Promise.resolve({ status: 'retryable' as const, reason: 'response_lost' as const }),
    )
    const session = mapSession(
      {
        image: { status: 'unattached' },
        layers: [
          { id: 'day', image: { status: 'unattached' }, name: 'Day' },
          { id: 'night', image: { status: 'unattached' }, name: 'Night' },
        ],
        pins: [],
      },
      { replaceImage },
    )
    renderMap(session)
    const bytes = new Uint8Array([1, 2, 3])
    const image = new File([Uint8Array.from(bytes).buffer], 'map.png', { type: 'image/png' })
    Object.defineProperty(image, 'arrayBuffer', {
      value: () => Promise.resolve(Uint8Array.from(bytes).buffer),
    })

    fireEvent.change(screen.getByLabelText('Choose map image'), { target: { files: [image] } })
    expect(await screen.findByRole('alert')).toBeVisible()
    fireEvent.change(screen.getByRole('combobox', { name: 'Map layer' }), {
      target: { value: 'night' },
    })

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(replaceImage).toHaveBeenCalledOnce()
    expect(replaceImage.mock.calls[0]![0]).toBe('day')
  })

  it('shows a truthful readonly banner and keeps image replacement unavailable', () => {
    renderMap(mapSession(emptyMap()), false)
    expect(screen.getByText('Viewing map — changes are disabled')).toBeVisible()
    expect(screen.queryByRole('button', { name: /choose image|replace image/i })).toBeNull()
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
    const openResource = vi.fn()
    render(
      <MapViewer
        canEdit
        mapResourceId={testDomainId('resource', 'map-viewer')}
        openResource={openResource}
        resolveResource={(resourceId) =>
          resourceId === targetId
            ? {
                id: targetId,
                campaignId: testDomainId('campaign', 'pin-campaign'),
                displayParentId: null,
                kind: 'note',
                title: canonicalizeResourceTitle('Pinned note'),
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
    fireEvent.doubleClick(pin)
    expect(openResource).toHaveBeenCalledWith(targetId)
    fireEvent.contextMenu(pin, { clientX: 10, clientY: 20 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove pin' }))
    expect(execute).toHaveBeenCalledWith({ type: 'removePin', pinId })

    const dataTransfer = {
      types: ['application/x-wizard-archive-resource-ids'],
      dropEffect: 'none',
      getData: () =>
        JSON.stringify({
          schema: 'resource-drag-v1',
          resourceIds: [droppedId],
          lifecycle: 'active',
        }),
    }
    expect(readWorkspaceResourceDrag(dataTransfer)).toEqual({
      lifecycle: 'active',
      resourceIds: [droppedId],
    })
    const mapSurface = imageElement.parentElement!
    fireEvent.dragOver(mapSurface, { dataTransfer })
    expect(screen.getByText('Drop resources to create pins')).toBeVisible()
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

function mapViewer(session: MapSession, canEdit = true) {
  return (
    <MapViewer
      canEdit={canEdit}
      mapResourceId={testDomainId('resource', 'map-viewer')}
      openResource={vi.fn()}
      resolveResource={() => null}
      session={session}
      title="Harbor"
    />
  )
}

function testVersion() {
  return initialVersion(assertSha256Digest('a'.repeat(64)))
}
