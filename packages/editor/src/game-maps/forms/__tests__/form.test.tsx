import type { ResourceId } from '../../../resources/domain-id'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { MapForm } from '../form'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { MapFormSource } from '../source'
import type { MapItem } from '../../../game-maps/item-contract'
import { completedResourceOperation } from '../../../filesystem/transaction-contract'
import { handleError } from '../../../errors/handle-error'

vi.mock('../../../errors/handle-error', () => ({
  handleError: vi.fn(),
}))

vi.mock('../../../filesystem/forms/sidebar-item-metadata-controls', () => ({
  SidebarItemMetadataControls: () => <div data-testid="metadata-controls" />,
}))

vi.mock('../../../filesystem/forms/sidebar-item-upload-field', () => ({
  SidebarItemUploadField: ({
    children,
    isSubmitting,
  }: {
    children: ReactNode
    isSubmitting: boolean
  }) => (
    <div data-submitting={String(isSubmitting)} data-testid="upload-field">
      {children}
    </div>
  ),
}))

vi.mock('../../../filesystem/forms/use-document-drop-upload-target', () => ({
  useDocumentDropUploadTarget: vi.fn(),
}))

describe('MapForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does not reject an edited map title because a sibling uses it', async () => {
    const parentId = 'folder-1' as ResourceId
    const mapId = 'map-1' as ResourceId
    const map = createExistingMap(mapId, { parentId })

    render(
      <MapForm
        mapId={mapId}
        mapState={{ status: 'ready', item: map, isPending: false, error: null }}
        onClose={vi.fn()}
        source={createSource()}
        upload={createUpload({ file: createImageFile() })}
      />,
    )

    fireEvent.change(screen.getByLabelText('Map Name'), { target: { value: 'Cavern' } })

    await waitFor(() => expect(screen.getByDisplayValue('Cavern')).toBeInTheDocument())
  })

  it('keeps edit controls disabled when the backing map is missing', () => {
    render(
      <MapForm
        mapId={'missing-map' as ResourceId}
        mapState={{ status: 'not_found', item: null, isPending: false, error: null }}
        onClose={vi.fn()}
        source={createSource()}
        upload={createUpload()}
      />,
    )

    expect(screen.getByLabelText('Map Name')).toBeDisabled()
    expect(screen.getByTestId('upload-field')).toHaveAttribute('data-submitting', 'true')
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
  })

  it('updates an existing map and only uploads a newly selected image', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const updateItemMetadata = vi.fn().mockResolvedValue(undefined)
    const mapId = 'map-1' as ResourceId
    const updateMapImage = vi.fn().mockResolvedValue(completedMapImageUpdate(mapId))
    const map = createExistingMap(mapId)
    const source = createSource({ updateItemMetadata, updateMapImage })

    const { rerender } = render(
      <MapForm
        mapId={mapId}
        mapState={{ status: 'ready', item: map, isPending: false, error: null }}
        onClose={onClose}
        onSuccess={onSuccess}
        source={source}
        upload={createUpload()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Update' })).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(updateItemMetadata).toHaveBeenCalledExactlyOnceWith({
        item: map,
        name: map.name,
        iconName: map.iconName,
        color: map.color,
      })
    })
    expect(updateMapImage).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()

    vi.clearAllMocks()

    rerender(
      <MapForm
        mapId={mapId}
        mapState={{ status: 'ready', item: map, isPending: false, error: null }}
        onClose={onClose}
        onSuccess={onSuccess}
        source={source}
        upload={createUpload({ file: createImageFile() })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(updateMapImage).toHaveBeenCalledOnce()
    })
  })

  it('reports replacement upload failures after existing map metadata is saved', async () => {
    const onSuccess = vi.fn()
    const mapId = 'map-1' as ResourceId
    const map = createExistingMap(mapId)
    const updateMapImage = vi.fn().mockResolvedValue({
      status: 'error' as const,
      error: new Error('Upload failed'),
    })
    const source = createSource({ updateMapImage })

    render(
      <MapForm
        mapId={mapId}
        mapState={{ status: 'ready', item: map, isPending: false, error: null }}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        source={source}
        upload={createUpload({ file: createImageFile() })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(source.updateItemMetadata).toHaveBeenCalled()
    })
    expect(updateMapImage).toHaveBeenCalledWith({
      mapId,
      file: expect.objectContaining({
        contentType: 'image/png',
        name: 'map.png',
      }),
    })
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      'Map details were saved, but the image upload failed.',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

function createSource(overrides: Partial<MapFormSource> = {}): MapFormSource {
  return {
    updateItemMetadata: vi.fn().mockResolvedValue(undefined),
    updateMapImage: vi.fn().mockResolvedValue(completedMapImageUpdate('map-1' as ResourceId)),
    ...overrides,
  } as MapFormSource
}

function completedMapImageUpdate(mapId: ResourceId) {
  return completedResourceOperation({
    kind: 'mapImageUpdated',
    itemId: mapId,
    affectedCount: 1,
  })
}

function createUpload(overrides: Partial<FileUploadControl> = {}): FileUploadControl {
  return {
    file: null,
    preview: '',
    fileMetadata: null,
    isUploading: false,
    uploadError: '',
    isDragActive: false,
    uploadProgress: { percentage: 0 },
    fileInputRef: { current: null },
    handleFileSelect: vi.fn(),
    handleDrag: vi.fn(),
    handleDrop: vi.fn(),
    ...overrides,
  } as FileUploadControl
}

function createImageFile() {
  return new File(['image'], 'map.png', { type: 'image/png' })
}

function createExistingMap(id: ResourceId, overrides: Partial<MapItem> = {}): MapItem {
  return {
    id: id,
    name: 'Dungeon',
    parentId: null,
    iconName: null,
    color: null,
    imageAssetId: 'storage-1',
    ...overrides,
  } as MapItem
}
