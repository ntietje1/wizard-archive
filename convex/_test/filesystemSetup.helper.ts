import { api } from '../_generated/api'
import { SIDEBAR_ITEM_TYPES } from '../../shared/sidebar-items/types'
import { assertSidebarItemName } from '../sidebarItems/validation/name'
import { assertSidebarItemColor } from '../../shared/sidebar-items/color'
import { assertSidebarItemIconName } from '../../shared/sidebar-items/icon'
import { makeYjsUpdateWithBlocks } from './yjs.helper'
import type { DataModel, Id } from '../_generated/dataModel'
import type { TestConvexForDataModel } from 'convex-test'
import type { CustomBlock } from '../../shared/editor-blocks/types'
import type {
  FileSystemEvent,
  FileSystemTransactionReceipt,
} from '../../shared/sidebar-items/filesystem/receipts'
import type { CreateParentTarget } from '../../shared/sidebar-items/parent-target'
import type { SidebarItemColor } from '../../shared/sidebar-items/color'
import type { SidebarItemIconName } from '../../shared/sidebar-items/icon'
import type { SidebarItemType } from '../../shared/sidebar-items/types'

type AuthedContext = TestConvexForDataModel<DataModel>

type CreateSidebarItemSetupArgs = {
  campaignId: Id<'campaigns'>
  name: string
  parentTarget?: CreateParentTarget
  iconName?: SidebarItemIconName
  color?: SidebarItemColor
}

function createdItemFromReceipt(receipt: FileSystemTransactionReceipt) {
  const created = receipt.events.find(
    (event): event is Extract<FileSystemEvent, { type: 'created' }> => event.type === 'created',
  )
  if (!created) {
    throw new Error('Expected filesystem create command to create a sidebar item')
  }
  return created
}

async function createSidebarItemViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { itemType: SidebarItemType },
) {
  const receipt = await client.mutation(
    api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
    {
      campaignId: args.campaignId,
      command: {
        type: 'create',
        itemType: args.itemType,
        name: assertSidebarItemName(args.name),
        parentTarget: args.parentTarget ?? { kind: 'direct', parentId: null },
        iconName:
          args.iconName === undefined ? undefined : assertSidebarItemIconName(args.iconName),
        color: args.color === undefined ? undefined : assertSidebarItemColor(args.color),
      },
    },
  )
  const created = createdItemFromReceipt(receipt)
  return { itemId: created.itemId, slug: created.slug, receipt }
}

export async function createNoteViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { content?: Array<CustomBlock> },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: SIDEBAR_ITEM_TYPES.notes,
  })
  if (args.content !== undefined) {
    await client.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: args.campaignId,
      documentId: created.itemId,
      update: makeYjsUpdateWithBlocks(args.content),
    })
    await client.action(api.notes.actions.persistNoteBlocks, {
      campaignId: args.campaignId,
      documentId: created.itemId,
    })
  }
  return { noteId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createFolderViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs,
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: SIDEBAR_ITEM_TYPES.folders,
  })
  return { folderId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createFileViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { storageId?: Id<'_storage'> | null },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: SIDEBAR_ITEM_TYPES.files,
  })
  if (args.storageId !== undefined) {
    await client.mutation(api.files.mutations.updateFileStorage, {
      campaignId: args.campaignId,
      fileId: created.itemId,
      storageId: args.storageId,
    })
  }
  return { fileId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createGameMapViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { imageStorageId?: Id<'_storage'> | null },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
  })
  if (args.imageStorageId !== undefined) {
    await client.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: args.campaignId,
      mapId: created.itemId,
      imageStorageId: args.imageStorageId,
    })
  }
  return { mapId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createCanvasViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs,
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: SIDEBAR_ITEM_TYPES.canvases,
  })
  return { canvasId: created.itemId, slug: created.slug, receipt: created.receipt }
}
