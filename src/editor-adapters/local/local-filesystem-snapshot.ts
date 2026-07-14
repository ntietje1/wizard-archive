import {
  createWizardEditorResource,
  createWizardEditorCatalogSnapshot,
  createWizardEditorPlainTextNoteContent,
  filterWizardEditorItemsForActor,
  parseWizardEditorResourceSlug,
} from '@wizard-archive/editor/adapter'
import { createWorkspaceResourceReadModel } from '@wizard-archive/editor/resources/items'
import type {
  WizardEditorFolderItem,
  WizardEditorFolderItemWithContent,
  WizardEditorItemWithContent,
  WizardEditorNavigationState,
  WizardEditorCatalogSnapshot,
  WizardEditorWorkspaceActor,
} from '@wizard-archive/editor/adapter'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { PermissionLevel } from 'shared/permissions/types'
import { SHARE_STATUS } from 'shared/block-shares/share-status'
import { hasPermissionForRequirement } from 'shared/permissions/requirements'
import {
  getBlockAllPlayersPermissionLevel,
  getEffectiveBlockVisibilityPermissionLevel,
} from 'shared/permissions/block-visibility'
import { getUserDisplayName } from '@wizard-archive/ui/utils/user-display-name'
import {
  requireLocalFilePayloadForItem,
  withValidLocalViewAsPlayerSelection,
} from './local-workspace-model'
import type { LocalWorkspaceState } from './local-workspace-model'

import {
  assertDomainId,
  DOMAIN_ID_KIND,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceShareId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

export type LocalFileSystemSnapshot = Omit<WizardEditorCatalogSnapshot, 'current'> & {
  workspace: LocalWorkspaceState
  current: WizardEditorCatalogSnapshot['current'] & {
    navigation: WizardEditorNavigationState
  }
}

type LocalWorkspaceItem = LocalWorkspaceState['items'][number]
type LocalItemName = WizardEditorItemWithContent['name']
type LocalItemSlug = WizardEditorItemWithContent['slug']
type LocalSidebarItemShareType = WizardEditorItemWithContent['shares'][number]['sidebarItemType']
const localResourceShareIds = new Map<string, ResourceShareId>()
type LocalSidebarItemBaseFields = Pick<
  WizardEditorItemWithContent,
  | 'id'
  | 'createdAt'
  | 'name'
  | 'iconName'
  | 'color'
  | 'slug'
  | 'campaignId'
  | 'parentId'
  | 'allPermissionLevel'
  | 'location'
  | 'status'
  | 'previewAssetId'
  | 'updatedTime'
  | 'updatedBy'
  | 'createdBy'
  | 'deletionTime'
  | 'deletedBy'
  | 'shares'
  | 'isBookmarked'
  | 'myPermissionLevel'
  | 'previewUrl'
  | 'isActive'
  | 'isTrashed'
>
type LocalCanvasItemWithContent = Extract<WizardEditorItemWithContent, { type: 'canvas' }>
type LocalFileItemWithContent = Extract<WizardEditorItemWithContent, { type: 'file' }>
type LocalMapItemWithContent = Extract<WizardEditorItemWithContent, { type: 'gameMap' }>
type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LocalNoteContent = Pick<LocalNoteItemWithContent, 'blockMeta' | 'content'>
type LocalNoteBlock = LocalNoteContent['content'][number]
type LocalNoteBlockMeta = LocalNoteContent['blockMeta'][string]
type LocalNoteBlockVisibilityRules = NonNullable<
  LocalWorkspaceState['noteBlockVisibilityById']
>[string]

export function createLocalFileSystemSnapshot(
  localWorkspace: LocalWorkspaceState,
  navigation?: WizardEditorNavigationState,
): LocalFileSystemSnapshot {
  const workspace = withValidLocalViewAsPlayerSelection(localWorkspace)
  const resolvedNavigation = navigation ?? createLocalWorkspaceInitialNavigation(workspace)
  const catalogItems = createLocalCatalogItems(workspace)
  const snapshot = createWizardEditorCatalogSnapshot({
    activeItems: catalogItems.activeItems,
    availability: {
      accessTargetLabel: localAvailabilityTargetLabel(workspace),
      actor: createLocalWorkspaceActor(workspace),
      isDirectMessageActor: true,
      subject: 'item',
    },
    current: resolvedNavigation,
    trashItems: catalogItems.trashItems,
    unavailableResource: {
      label: 'Local item',
      message: 'Select an item from the sidebar.',
    },
    visibleActiveItems: catalogItems.visibleActiveItems,
  })

  return {
    ...snapshot,
    workspace,
    current: {
      ...snapshot.current,
      navigation: resolvedNavigation,
    },
  }
}

export function createLocalWorkspaceActor(
  workspace: LocalWorkspaceState,
): WizardEditorWorkspaceActor {
  return workspace.selectedViewAsPlayerId
    ? {
        kind: 'owner_view_as',
        participantId: workspace.selectedViewAsPlayerId,
      }
    : { kind: 'owner' }
}

function localAvailabilityTargetLabel(workspace: LocalWorkspaceState) {
  const selectedPlayerId = workspace.selectedViewAsPlayerId
  if (!selectedPlayerId) return 'you'
  const selectedPlayer = workspace.playerMembers?.find((member) => member.id === selectedPlayerId)
  return selectedPlayer ? getUserDisplayName(selectedPlayer.userProfile) : 'the selected player'
}

export function createLocalWorkspaceInitialNavigation(
  workspace: LocalWorkspaceState,
  itemId?: ResourceId | null,
): WizardEditorNavigationState {
  if (itemId) {
    return {
      kind: 'resource',
      resource: createWizardEditorResource(itemId),
    }
  }
  const initialItem = workspace.items.find((item) => localWorkspaceItemIsVisible(workspace, item))
  return initialItem
    ? { kind: 'resource', resource: createWizardEditorResource(initialItem.id) }
    : { kind: 'create' }
}

function createLocalCatalogItems(state: LocalWorkspaceState) {
  const actor = createLocalWorkspaceActor(state)
  const localItemsById = new Map(state.items.map((candidate) => [candidate.id, candidate] as const))
  const itemsWithoutMapPins = state.items.map((item) =>
    createLocalCatalogItem(state, item, localItemsById),
  )
  const visibleItemsWithoutMapPins = filterLocalCatalogItemsForActor(
    itemsWithoutMapPins.filter((item) => item.isActive),
    actor,
  )
  const visibleItemsById = new Map(
    visibleItemsWithoutMapPins.map((item) => [item.id, item] as const),
  )
  const items = itemsWithoutMapPins.map((item) => {
    if (item.type !== 'gameMap') return item
    return {
      ...item,
      pins: createLocalMapPins(state, item.id, visibleItemsById),
    } satisfies LocalMapItemWithContent
  })
  const visibleActiveItemIds = new Set(visibleItemsWithoutMapPins.map((item) => item.id))
  const activeItems = items.filter((item) => item.isActive)
  const visibleActiveItems = activeItems.filter((item) => visibleActiveItemIds.has(item.id))
  const projectedTrashItems = filterLocalCatalogItemsForActor(
    items.filter((item) => item.isTrashed),
    actor,
  )

  return { activeItems, visibleActiveItems, trashItems: projectedTrashItems }
}

function filterLocalCatalogItemsForActor<TItem extends WizardEditorItemWithContent>(
  items: Array<TItem>,
  actor: ReturnType<typeof createLocalWorkspaceActor>,
): Array<TItem> {
  return filterWizardEditorItemsForActor(
    {
      data: items,
      readModel: createWorkspaceResourceReadModel(items),
      status: 'success',
      error: null,
      refresh: () => Promise.resolve(),
    },
    actor,
  ).data as Array<TItem>
}

function localNoteBodyForItem(state: LocalWorkspaceState, itemId: ResourceId) {
  return state.noteBodiesById[itemId] ?? ''
}

function localMapForItem(state: LocalWorkspaceState, itemId: ResourceId) {
  return state.mapsById[itemId] ?? { id: itemId, imageUrl: null, pins: [] }
}

function createLocalMapPins(
  state: LocalWorkspaceState,
  mapId: ResourceId,
  itemsById: ReadonlyMap<ResourceId, WizardEditorItemWithContent>,
) {
  const map = localMapForItem(state, mapId)
  return map.pins.flatMap((pin) => {
    const item = itemsById.get(pin.itemId)
    if (!item) return []

    return [
      {
        id: pin.id,
        createdAt: pin.creationTime,
        mapId: map.id,
        itemId: pin.itemId,
        layerId: pin.layerId ?? null,
        x: pin.x,
        y: pin.y,
        visible: pin.visible,
        item,
      },
    ]
  })
}

function createLocalCatalogItem(
  state: LocalWorkspaceState,
  item: LocalWorkspaceItem,
  localItemsById: ReadonlyMap<ResourceId, LocalWorkspaceItem>,
): WizardEditorItemWithContent {
  const baseItem = {
    ...localSidebarItemBaseFields(state, item, localItemsById),
    ancestors: localItemAncestors(state, item, localItemsById),
  }

  if (item.type === 'note') {
    const content = createLocalNoteContent(state, item)
    const note = {
      ...baseItem,
      type: 'note',
      ...content,
      blockShareAccessWarnings: [],
    } satisfies LocalNoteItemWithContent
    return note
  }

  if (item.type === 'canvas') {
    const canvas = {
      ...baseItem,
      type: 'canvas',
    } satisfies LocalCanvasItemWithContent
    return canvas
  }

  if (item.type === 'map') {
    const localMap = localMapForItem(state, item.id)
    const map = {
      ...baseItem,
      type: 'gameMap',
      imageAssetId: null,
      imageUrl: localMap.imageUrl,
      ...(localMap.layers
        ? {
            layers: localMap.layers.map((layer) => ({
              id: layer.id,
              imageAssetId: null,
              imageUrl: layer.imageUrl,
              name: layer.name,
            })),
          }
        : {}),
      pins: [],
    } satisfies LocalMapItemWithContent
    return map
  }

  if (item.type === 'file') {
    const filePayload = requireLocalFilePayloadForItem(state, item)

    const sidebarFile = {
      ...baseItem,
      type: 'file',
      assetId: null,
      downloadUrl: filePayload.downloadUrl,
      contentType: filePayload.contentType,
    } satisfies LocalFileItemWithContent
    return sidebarFile
  }

  const folder = {
    ...baseItem,
    type: 'folder',
    inheritShares: false,
  } satisfies WizardEditorFolderItemWithContent
  return folder
}

function localSidebarItemBaseFields(
  state: LocalWorkspaceState,
  item: LocalWorkspaceItem,
  localItemsById: ReadonlyMap<ResourceId, LocalWorkspaceItem>,
): LocalSidebarItemBaseFields {
  const isTrashed = item.status === 'trash'
  const myPermissionLevel = localItemPermissionLevel(state, item.id)
  return {
    id: item.id,
    createdAt: item.createdAt,
    name: requireLocalResourceTitle(item.title || 'Untitled'),
    iconName: item.iconName ?? null,
    color: item.color ?? null,
    slug: item.slug ?? requireLocalResourceSlug(item.id),
    campaignId: state.workspaceId,
    parentId: localVisibleParentId(state, item, localItemsById),
    allPermissionLevel: state.selectedViewAsPlayerId ? null : PERMISSION_LEVEL.FULL_ACCESS,
    location: 'sidebar',
    status: isTrashed ? 'trashed' : 'active',
    previewAssetId: null,
    updatedTime: item.updatedAt,
    updatedBy: null,
    createdBy: state.localUser.id,
    deletionTime: isTrashed ? (item.trashedAt ?? item.updatedAt) : null,
    deletedBy: isTrashed ? state.localUser.id : null,
    shares: localSidebarItemShares(state, item),
    isBookmarked: item.isBookmarked ?? false,
    myPermissionLevel,
    previewUrl: null,
    isActive: !isTrashed,
    isTrashed,
  }
}

function localSidebarItemShares(state: LocalWorkspaceState, item: LocalWorkspaceItem) {
  return Object.entries(state.memberItemPermissionsById?.[item.id] ?? {}).flatMap(
    ([candidateMemberId, permissionLevel]) => {
      if (!permissionLevel) return []
      const campaignMemberId = assertDomainId(DOMAIN_ID_KIND.campaignMember, candidateMemberId)
      return [
        {
          id: getLocalResourceShareId(state.workspaceId, item.id, campaignMemberId),
          createdAt: item.createdAt,
          campaignId: state.workspaceId,
          sidebarItemId: item.id,
          sidebarItemType: localSidebarItemType(item.type),
          campaignMemberId,
          sessionId: null,
          permissionLevel,
        },
      ]
    },
  )
}

function getLocalResourceShareId(
  workspaceId: CampaignId,
  itemId: ResourceId,
  memberId: CampaignMemberId,
) {
  const key = `${workspaceId}\0${itemId}\0${memberId}`
  const existing = localResourceShareIds.get(key)
  if (existing) return existing
  const id = generateDomainId(DOMAIN_ID_KIND.resourceShare)
  localResourceShareIds.set(key, id)
  return id
}

function localSidebarItemType(itemType: LocalWorkspaceItem['type']): LocalSidebarItemShareType {
  if (itemType === 'note') return 'note'
  if (itemType === 'canvas') return 'canvas'
  if (itemType === 'map') return 'gameMap'
  if (itemType === 'file') return 'file'
  return 'folder'
}

function localItemPermissionLevel(state: LocalWorkspaceState, itemId: ResourceId) {
  const selectedPlayerId = state.selectedViewAsPlayerId
  if (!selectedPlayerId) return PERMISSION_LEVEL.FULL_ACCESS

  return state.memberItemPermissionsById?.[itemId]?.[selectedPlayerId] ?? PERMISSION_LEVEL.NONE
}

function localWorkspaceItemIsVisible(state: LocalWorkspaceState, item: LocalWorkspaceItem) {
  return (
    item.status === 'active' &&
    hasPermissionForRequirement(localItemPermissionLevel(state, item.id), PERMISSION_LEVEL.VIEW)
  )
}

function localItemAncestors(
  state: LocalWorkspaceState,
  item: LocalWorkspaceItem,
  itemsById: ReadonlyMap<ResourceId, LocalWorkspaceItem>,
): Array<WizardEditorFolderItem> {
  const ancestors: Array<WizardEditorFolderItem> = []
  const seenIds = new Set([item.id])
  let parentId = item.parentId

  while (parentId) {
    if (seenIds.has(parentId)) break
    seenIds.add(parentId)
    const parent = itemsById.get(parentId)
    if (!parent || parent.type !== 'folder') break
    if (!localWorkspaceItemIsVisible(state, parent)) break
    ancestors.unshift({
      ...localSidebarItemBaseFields(state, parent, itemsById),
      type: 'folder',
      inheritShares: false,
    } satisfies WizardEditorFolderItem)
    parentId = parent.parentId
  }

  return ancestors
}

function requireLocalResourceTitle(value: string): LocalItemName {
  return value as LocalItemName
}

function requireLocalResourceSlug(value: string): LocalItemSlug {
  const slug = parseWizardEditorResourceSlug(value)
  if (!slug) throw new Error(`Invalid local resource slug: ${value}`)
  return slug as LocalItemSlug
}

function localVisibleParentId(
  state: LocalWorkspaceState,
  item: LocalWorkspaceItem,
  itemsById: ReadonlyMap<ResourceId, LocalWorkspaceItem>,
) {
  if (!item.parentId) return null
  const parent = itemsById.get(item.parentId)
  return parent && localWorkspaceItemIsVisible(state, parent) ? item.parentId : null
}

function createLocalNoteContent(state: LocalWorkspaceState, item: LocalWorkspaceItem) {
  const content = createLocalNoteBaseContent(state, item)
  return projectSelectedPlayerBlockVisibility(
    state,
    item.id,
    applyLocalNoteVisibilityRules(content, state.noteBlockVisibilityById?.[item.id]),
  )
}

function createLocalNoteBaseContent(state: LocalWorkspaceState, item: LocalWorkspaceItem) {
  const myPermissionLevel = localItemPermissionLevel(state, item.id)
  const plainTextContent = createWizardEditorPlainTextNoteContent({
    text: localNoteBodyForItem(state, item.id),
    fileName: `${item.title || 'Untitled Note'}.txt`,
  })
  const content = {
    ...plainTextContent,
    blockMeta: projectLocalBlockMeta(plainTextContent.blockMeta, myPermissionLevel),
  }
  const additionalBlocks = state.noteAdditionalBlocksById[item.id] ?? []
  if (additionalBlocks.length === 0) return content

  return {
    ...content,
    content: [...content.content, ...additionalBlocks],
    blockMeta: {
      ...content.blockMeta,
      ...createLocalBlockMeta(additionalBlocks, myPermissionLevel),
    },
  }
}

function applyLocalNoteVisibilityRules(
  content: LocalNoteContent,
  visibilityRules: LocalNoteBlockVisibilityRules | undefined,
) {
  if (!visibilityRules?.length) return content

  const blockMeta = { ...content.blockMeta }
  for (const rule of visibilityRules) {
    applyLocalNoteVisibilityRule(content.content, blockMeta, rule)
  }

  return { ...content, blockMeta }
}

function applyLocalNoteVisibilityRule(
  content: ReadonlyArray<LocalNoteBlock>,
  blockMeta: Record<string, LocalNoteBlockMeta>,
  rule: LocalNoteBlockVisibilityRules[number],
) {
  for (const block of content) {
    if (!getLocalNoteBlockText(block).includes(rule.textIncludes)) continue

    const currentMeta = blockMeta[block.id]
    if (!currentMeta) continue

    blockMeta[block.id] = {
      ...currentMeta,
      ...(rule.hiddenFrom ? { hiddenFrom: rule.hiddenFrom } : {}),
      ...(rule.myPermissionLevel ? { myPermissionLevel: rule.myPermissionLevel } : {}),
      ...(rule.shareStatus ? { shareStatus: rule.shareStatus } : {}),
      ...(rule.sharedWith ? { sharedWith: rule.sharedWith } : {}),
    }
  }
}

function createLocalBlockMeta(
  content: ReadonlyArray<LocalNoteBlock>,
  myPermissionLevel: PermissionLevel,
): Record<string, LocalNoteBlockMeta> {
  return Object.fromEntries(
    content.map((block) => [
      block.id,
      {
        myPermissionLevel,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedWith: [],
      } satisfies LocalNoteBlockMeta,
    ]),
  )
}

function projectLocalBlockMeta(
  blockMeta: Record<string, LocalNoteBlockMeta>,
  myPermissionLevel: PermissionLevel,
): Record<string, LocalNoteBlockMeta> {
  return Object.fromEntries(
    Object.entries(blockMeta).map(([blockId, meta]) => [
      blockId,
      {
        ...meta,
        myPermissionLevel,
      },
    ]),
  )
}

function projectSelectedPlayerBlockVisibility(
  state: LocalWorkspaceState,
  itemId: ResourceId,
  content: LocalNoteContent,
): LocalNoteContent {
  const selectedPlayerId = state.selectedViewAsPlayerId
  if (!selectedPlayerId) return content

  const notePermissionLevel = localItemPermissionLevel(state, itemId)
  return {
    ...content,
    blockMeta: Object.fromEntries(
      Object.entries(content.blockMeta).map(([blockId, meta]) => [
        blockId,
        {
          ...meta,
          myPermissionLevel: getEffectiveBlockVisibilityPermissionLevel({
            allPlayersPermissionLevel: getBlockAllPlayersPermissionLevel(meta.shareStatus),
            isDm: false,
            memberPermissionLevel: getLocalBlockMemberPermissionLevel(
              meta,
              selectedPlayerId,
              notePermissionLevel,
            ),
            notePermissionLevel,
          }),
        } satisfies LocalNoteBlockMeta,
      ]),
    ),
  }
}

function getLocalBlockMemberPermissionLevel(
  meta: LocalNoteBlockMeta,
  selectedPlayerId: string,
  notePermissionLevel: PermissionLevel,
): PermissionLevel | null {
  if ((meta.hiddenFrom ?? []).some((memberId) => memberId === selectedPlayerId)) {
    return PERMISSION_LEVEL.NONE
  }
  if (meta.sharedWith.some((memberId) => memberId === selectedPlayerId)) {
    return PERMISSION_LEVEL.VIEW
  }
  return notePermissionLevel
}

function getLocalNoteBlockText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(getLocalNoteBlockText).join('')
  }
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') {
    return value.text
  }
  return Object.values(value).map(getLocalNoteBlockText).join('')
}
