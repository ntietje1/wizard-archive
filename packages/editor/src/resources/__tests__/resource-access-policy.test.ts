import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  FOLDER_ACCESS_INHERITANCE,
  RESOURCE_PERMISSION,
  canProjectResource,
  resolveResourcePermission,
} from '../resource-access-policy'
import type { ResourceAccessNode } from '../resource-access-policy'
import type { ResourceId } from '../domain-id'

const rootId = testDomainId('resource', 'access-root')
const folderId = testDomainId('resource', 'access-folder')
const noteId = testDomainId('resource', 'access-note')

describe('resource access policy', () => {
  it('resolves explicit member access before audience and inherited access', () => {
    const nodes = accessTree({
      root: folderNode(rootId, null, 'edit', 'enabled'),
      folder: folderNode(folderId, rootId, 'view', 'enabled'),
      note: resourceNode(noteId, folderId, 'view', {
        state: 'explicit',
        permission: 'none',
      }),
    })

    expect(resolveResourcePermission(noteId, nodes)).toBe(RESOURCE_PERMISSION.none)
  })

  it('uses direct audience access before the nearest inheritable ancestor', () => {
    const nodes = accessTree({
      root: folderNode(rootId, null, 'edit', 'enabled'),
      folder: folderNode(folderId, rootId, 'edit', 'enabled'),
      note: resourceNode(noteId, folderId, 'view'),
    })

    expect(resolveResourcePermission(noteId, nodes)).toBe(RESOURCE_PERMISSION.view)
  })

  it('inherits from the nearest enabled folder with an applicable grant', () => {
    const nodes = accessTree({
      root: folderNode(rootId, null, 'edit', 'enabled'),
      folder: folderNode(folderId, rootId, 'view', 'enabled'),
      note: resourceNode(noteId, folderId),
    })

    expect(resolveResourcePermission(noteId, nodes)).toBe(RESOURCE_PERMISSION.view)
  })

  it('stops inheritance at a folder whose descendant propagation is disabled', () => {
    const nodes = accessTree({
      root: folderNode(rootId, null, 'edit', 'enabled'),
      folder: folderNode(folderId, rootId, 'none', 'disabled'),
      note: resourceNode(noteId, folderId),
    })

    expect(resolveResourcePermission(noteId, nodes)).toBe(RESOURCE_PERMISSION.none)
  })

  it('does not project a directly shared child through a hidden ancestor', () => {
    const nodes = accessTree({
      root: folderNode(rootId, null),
      folder: folderNode(folderId, rootId),
      note: resourceNode(noteId, folderId, 'view'),
    })

    expect(resolveResourcePermission(noteId, nodes)).toBe(RESOURCE_PERMISSION.view)
    expect(canProjectResource(noteId, nodes)).toBe(false)
  })

  it('denies incomplete and cyclic ancestor spines', () => {
    const incomplete = accessTree({
      note: resourceNode(noteId, folderId, 'view'),
    })
    const cyclic = accessTree({
      folder: folderNode(folderId, noteId, 'view', 'enabled'),
      note: resourceNode(noteId, folderId, 'view'),
    })

    expect(canProjectResource(noteId, incomplete)).toBe(false)
    expect(canProjectResource(noteId, cyclic)).toBe(false)
  })
})

function accessTree(nodes: {
  root?: ResourceAccessNode
  folder?: ResourceAccessNode
  note: ResourceAccessNode
}) {
  return new Map<ResourceId, ResourceAccessNode>(
    [nodes.root, nodes.folder, nodes.note]
      .filter((node): node is ResourceAccessNode => node !== undefined)
      .map((node) => [node.policy.resourceId, node]),
  )
}

function folderNode(
  resourceId: ResourceId,
  parentId: ResourceId | null,
  audiencePermission: 'none' | 'view' | 'edit' = 'none',
  inheritance: 'disabled' | 'enabled' = 'disabled',
): ResourceAccessNode {
  return {
    policy: {
      resourceId,
      audiencePermission,
      subject: 'folder',
      inheritance:
        inheritance === 'enabled'
          ? FOLDER_ACCESS_INHERITANCE.enabled
          : FOLDER_ACCESS_INHERITANCE.disabled,
    },
    parentId,
    memberAccess: { state: 'default' },
  }
}

function resourceNode(
  resourceId: ResourceId,
  parentId: ResourceId | null,
  audiencePermission: 'none' | 'view' | 'edit' = 'none',
  memberAccess: ResourceAccessNode['memberAccess'] = { state: 'default' },
): ResourceAccessNode {
  return {
    policy: {
      resourceId,
      audiencePermission,
      subject: 'resource',
    },
    parentId,
    memberAccess,
  }
}
