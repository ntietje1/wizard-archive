import { api } from '../_generated/api'
import {
  assertResourceItemColor,
  assertResourceItemIconName,
} from '@wizard-archive/editor/resources/items'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { CreateParentTarget } from '@wizard-archive/editor/resources/items'
import type {
  ResourceColor,
  ResourceIconName,
  ResourceKind,
} from '@wizard-archive/editor/resources/resource-contract'

import { assertConvexSidebarItemName } from '../sidebarItems/validation/name'
import { makeYjsUpdateWithBlocks } from './yjs.helper'
import type { DataModel, Id } from '../_generated/dataModel'
import type { TestConvexForDataModel } from 'convex-test'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type {
  ResourceEvent,
  ResourceTransactionReceipt,
} from '@wizard-archive/editor/resources/transaction-contract'
type AuthedContext = TestConvexForDataModel<DataModel>

type CreateSidebarItemSetupArgs = {
  campaignId: Id<'campaigns'>
  name: string
  parentTarget?: CreateParentTarget
  iconName?: ResourceIconName
  color?: ResourceColor
}

function createdItemFromReceipt(receipt: ResourceTransactionReceipt) {
  const created = receipt.events.find(
    (event): event is Extract<ResourceEvent, { type: 'created' }> => event.type === 'created',
  )
  if (!created) {
    throw new Error('Expected filesystem create command to create a sidebar item')
  }
  return created
}

async function createSidebarItemViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { itemType: ResourceKind },
) {
  const receipt = await client.mutation(
    api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
    {
      campaignId: args.campaignId,
      command: {
        type: 'create',
        itemType: args.itemType,
        name: assertConvexSidebarItemName(args.name),
        parentTarget: args.parentTarget ?? { kind: 'direct', parentId: null },
        iconName:
          args.iconName === undefined ? undefined : assertResourceItemIconName(args.iconName),
        color: args.color === undefined ? undefined : assertResourceItemColor(args.color),
      },
    },
  )
  const created = createdItemFromReceipt(receipt)
  return { itemId: created.itemId, slug: created.slug, receipt }
}

export async function createNoteViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { content?: Array<NoteBlock> },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: RESOURCE_TYPES.notes,
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
    itemType: RESOURCE_TYPES.folders,
  })
  return { folderId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createFileViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { uploadSessionId?: Id<'fileStorage'> | null },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: RESOURCE_TYPES.files,
  })
  if (args.uploadSessionId !== undefined) {
    await client.mutation(api.files.mutations.updateFileStorage, {
      campaignId: args.campaignId,
      fileId: created.itemId,
      uploadSessionId: args.uploadSessionId,
    })
  }
  return { fileId: created.itemId, slug: created.slug, receipt: created.receipt }
}

export async function createGameMapViaFilesystem(
  client: AuthedContext,
  args: CreateSidebarItemSetupArgs & { uploadSessionId?: Id<'fileStorage'> | null },
) {
  const created = await createSidebarItemViaFilesystem(client, {
    ...args,
    itemType: RESOURCE_TYPES.gameMaps,
  })
  if (args.uploadSessionId !== undefined) {
    const replacementToken = args.uploadSessionId
      ? await client.mutation(api.gameMaps.mutations.beginMapImageReplacement, {
          campaignId: args.campaignId,
          mapId: created.itemId,
        })
      : null
    await client.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: args.campaignId,
      mapId: created.itemId,
      replacementToken,
      uploadSessionId: args.uploadSessionId,
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
    itemType: RESOURCE_TYPES.canvases,
  })
  return { canvasId: created.itemId, slug: created.slug, receipt: created.receipt }
}
