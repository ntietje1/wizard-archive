import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import {
  assertSha256Digest,
  initialVersion,
} from '@wizard-archive/editor/resources/component-version'
import type { ResourceCatalogSnapshot } from '@wizard-archive/editor/resources/catalog-contract'
import type { InMemoryEditorContent } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import { createInMemoryEditorRuntime } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import {
  FILE_CLASSIFICATION,
  FILE_VIEWER_UNAVAILABLE_REASON,
} from '@wizard-archive/editor/resources/file-content-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { LocalWorkspaceState } from './local-workspace-model'
import { SAMPLE_LOCAL_WORKSPACE } from './sample-local-workspace'

const LOCAL_CONTENT_VERSION = initialVersion(
  assertSha256Digest('0000000000000000000000000000000000000000000000000000000000000000'),
)

export function useLocalWorkspaceRuntime({
  canEdit = true,
  initialItemId,
  initialWorkspace,
}: {
  canEdit?: boolean
  initialItemId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceState
  [key: string]: unknown
}) {
  const [core] = useState(() => {
    const workspace = initialWorkspace ?? SAMPLE_LOCAL_WORKSPACE
    return createInMemoryEditorRuntime({
      scope: {
        campaignId: workspace.workspaceId,
        actorId: workspace.actorId,
        projection: workspace.selectedViewAsPlayerId ? 'player' : 'dm',
        schema: RESOURCE_INDEX_SCHEMA,
      },
      snapshot: createCatalogSnapshot(workspace),
      content: createContent(workspace),
      navigation: createLocalResourceNavigation(initialItemId ?? null),
      authorize: () => canEdit && !workspace.selectedViewAsPlayerId,
    })
  })

  useEffect(() => core.dispose, [core])
  return core.runtime
}

function createCatalogSnapshot(workspace: LocalWorkspaceState): ResourceCatalogSnapshot {
  return {
    campaignId: workspace.workspaceId,
    resources: workspace.items.map((item) => localResourceRecord(workspace, item)),
    tombstones: [],
    aliases: [],
    roles: [],
  }
}

function localResourceRecord(
  workspace: LocalWorkspaceState,
  item: LocalWorkspaceState['items'][number],
): ResourceRecord {
  return {
    id: item.id,
    campaignId: workspace.workspaceId,
    parentId: item.parentId,
    kind: item.type,
    title: canonicalizeResourceTitle(item.title),
    icon: item.iconName ?? null,
    color: item.color ?? null,
    lifecycle:
      item.status === 'active'
        ? { state: 'active' }
        : { state: 'trashed', at: item.trashedAt ?? item.updatedAt, by: workspace.actorId },
    metadataVersion: item.metadataVersion ?? LOCAL_CONTENT_VERSION,
    created: { at: item.createdAt, by: workspace.actorId },
    updated: { at: item.updatedAt, by: workspace.actorId },
  }
}

function createContent(workspace: LocalWorkspaceState): InMemoryEditorContent {
  const notes: Array<NonNullable<InMemoryEditorContent['notes']>[number]> = []
  const files: Array<NonNullable<InMemoryEditorContent['files']>[number]> = []
  const maps: Array<NonNullable<InMemoryEditorContent['maps']>[number]> = []
  const canvases: Array<NonNullable<InMemoryEditorContent['canvases']>[number]> = []

  for (const item of workspace.items) {
    switch (item.type) {
      case 'note':
        notes.push({
          resourceId: item.id,
          content: noteDocument(workspace.noteBodiesById[item.id] ?? ''),
          version: LOCAL_CONTENT_VERSION,
        })
        break
      case 'file': {
        const file = workspace.filePayloadsById[item.id]
        if (!file) throw new Error(`Missing local file content for ${item.id}`)
        files.push({
          resourceId: item.id,
          content: {
            assetId: null,
            byteSize: file.size,
            classification: FILE_CLASSIFICATION.inert,
            detectedFormat: null,
            extension: fileExtension(file.name),
            mediaType: file.contentType,
            viewerUnavailableReason: FILE_VIEWER_UNAVAILABLE_REASON.unsupportedFormat,
          },
          version: LOCAL_CONTENT_VERSION,
        })
        break
      }
      case 'map': {
        const map = workspace.mapsById[item.id]
        if (!map) throw new Error(`Missing local map content for ${item.id}`)
        maps.push({
          resourceId: item.id,
          content: {
            imageAssetId: null,
            layers: (map.layers ?? []).map((layer) => ({
              id: layer.id,
              imageAssetId: null,
              name: layer.name,
            })),
            pins: map.pins.map((pin) => ({
              id: pin.id,
              targetResourceId: pin.itemId,
              layerId: pin.layerId ?? null,
              x: pin.x,
              y: pin.y,
              visible: pin.visible,
            })),
          },
          version: LOCAL_CONTENT_VERSION,
        })
        break
      }
      case 'canvas':
        canvases.push({
          resourceId: item.id,
          content: canvasDocument(workspace.canvasPayloadsById[item.id]),
          version: LOCAL_CONTENT_VERSION,
        })
        break
      case 'folder':
        break
    }
  }

  return { notes, files, maps, canvases }
}

function noteDocument(body: string) {
  const document = new Y.Doc()
  document.getText('body').insert(0, body)
  return document
}

function canvasDocument(payload: LocalWorkspaceState['canvasPayloadsById'][string] | undefined) {
  if (!payload) throw new Error('Missing local canvas content')
  const document = new Y.Doc()
  document.getMap('canvas').set('payload', JSON.stringify(payload))
  return document
}

function fileExtension(name: string) {
  const match = /\.([^.]+)$/.exec(name)
  return match?.[1]?.toLowerCase() ?? null
}

function createLocalResourceNavigation(initialResourceId: ResourceId | null): ResourceNavigation {
  let currentResourceId = initialResourceId
  const listeners = new Set<() => void>()
  return {
    current: () => currentResourceId,
    open: (resourceId) => {
      if (resourceId === currentResourceId) return
      currentResourceId = resourceId
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
