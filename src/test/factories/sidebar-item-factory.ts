import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorFolderItem, WizardEditorItem } from '@wizard-archive/editor/adapter'
import type { SidebarItemId, UserProfileId } from 'shared/common/ids'
import { testCampaignId } from 'shared/test/campaign-id'

let itemCounter = 0

const TEST_ITEM_LOCATION = 'sidebar'
const TEST_ITEM_STATUS = {
  active: 'active',
  trashed: 'trashed',
} as const
const TEST_ITEM_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
} as const
type NoteItem = Extract<WizardEditorItem, { type: (typeof TEST_ITEM_TYPES)['notes'] }>
type MapItem = Extract<WizardEditorItem, { type: (typeof TEST_ITEM_TYPES)['gameMaps'] }>
type FileItem = Extract<WizardEditorItem, { type: (typeof TEST_ITEM_TYPES)['files'] }>

type SidebarItemOverrides<T extends { slug: unknown; name: unknown }> = Omit<
  Partial<T>,
  'slug' | 'name'
> & {
  name?: string
  slug?: string
}

function baseFields() {
  itemCounter++
  return {
    createdAt: itemCounter,
    name: testResourceTitle(`Test Item ${itemCounter}`),
    iconName: null,
    color: null,
    slug: testResourceSlug(`test-item-${itemCounter}`),
    campaignId: testCampaignId(`campaign_${itemCounter}`),
    parentId: null,
    allPermissionLevel: null,
    location: TEST_ITEM_LOCATION as 'sidebar',
    status: TEST_ITEM_STATUS.active as 'active',
    previewUrl: null,
    previewAssetId: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: `user_${itemCounter}` as UserProfileId,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    isActive: true,
    isTrashed: false,
  }
}

function withLifecycleFacts<T extends { status: string; isActive: boolean; isTrashed: boolean }>(
  item: T,
): T {
  const isTrashed = item.status === TEST_ITEM_STATUS.trashed
  return {
    ...item,
    isActive: item.status === TEST_ITEM_STATUS.active,
    isTrashed,
  }
}

export function createNote(overrides?: SidebarItemOverrides<NoteItem>): NoteItem {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    id: `note_${itemCounter}` as SidebarItemId,
    type: TEST_ITEM_TYPES.notes,
    ...(name !== undefined ? { name: testResourceTitle(name) } : {}),
    ...(slug !== undefined ? { slug: testResourceSlug(slug) } : {}),
    ...rest,
  })
}

export function createFolder(
  overrides?: SidebarItemOverrides<WizardEditorFolderItem>,
): WizardEditorFolderItem {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    id: `folder_${itemCounter}` as WizardEditorFolderItem['id'],
    type: TEST_ITEM_TYPES.folders,
    inheritShares: true,
    ...(name !== undefined ? { name: testResourceTitle(name) } : {}),
    ...(slug !== undefined ? { slug: testResourceSlug(slug) } : {}),
    ...rest,
  })
}

export function createGameMap(overrides?: SidebarItemOverrides<MapItem>): MapItem {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    id: `map_${itemCounter}` as MapItem['id'],
    type: TEST_ITEM_TYPES.gameMaps,
    imageAssetId: null,
    imageUrl: null,
    ...(name !== undefined ? { name: testResourceTitle(name) } : {}),
    ...(slug !== undefined ? { slug: testResourceSlug(slug) } : {}),
    ...rest,
  })
}

export function createFile(overrides?: SidebarItemOverrides<FileItem>): FileItem {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    id: `file_${itemCounter}` as FileItem['id'],
    type: TEST_ITEM_TYPES.files,
    assetId: null,
    downloadUrl: null,
    contentType: null,
    ...(name !== undefined ? { name: testResourceTitle(name) } : {}),
    ...(slug !== undefined ? { slug: testResourceSlug(slug) } : {}),
    ...rest,
  })
}

function testResourceTitle(name: string): WizardEditorItem['name'] {
  return name as WizardEditorItem['name']
}

function testResourceSlug(slug: string): WizardEditorItem['slug'] {
  const parsed = parseWizardEditorResourceSlug(slug)
  if (!parsed) {
    throw new Error(`Invalid test resource slug: ${slug}`)
  }
  return parsed as WizardEditorItem['slug']
}
