import { ERROR_CODE, throwClientError } from '../../../errors'
import { logEditHistory } from '../../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../editHistory/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { getSidebarItem } from '../../functions/getSidebarItem'
import { requireItemAccess } from '../../validation/access'
import { requireOptionalSidebarItemName } from '../../validation/name'
import { requireOptionalSidebarItemColor } from '../../validation/color'
import { requireOptionalSidebarItemIconName } from '../../validation/icon'
import { prepareSidebarItemRename } from '../../validation/orchestration'
import { FILE_SYSTEM_EVENT_TYPE } from '../receipts'
import { createFileSystemWriteSession } from '../deltas'
import type { CampaignMutationCtx } from '../../../functions'
import type { EditHistoryChange } from '../../../editHistory/types'
import type { RenameFileSystemCommand } from '../commands'
import type { FileSystemDelta, SidebarItemFieldPatch } from '../receipts'
import type { AnySidebarItem } from '../../types/types'

type SidebarItemUpdates = SidebarItemFieldPatch

type RenameChangeSet = {
  updates: SidebarItemUpdates
  changes: Array<EditHistoryChange>
}

export async function executeRenameCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: RenameFileSystemCommand
  },
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const rawItem = await getSidebarItem(ctx, command.itemId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const item = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const { updates, changes } = await collectRenameChanges(ctx, item, command)

  if (changes.length === 0) {
    const events = [{ type: FILE_SYSTEM_EVENT_TYPE.noop, itemId: item._id }]
    return await session.build({
      command,
      events,
    })
  }

  await session.updateSidebarItem(item._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    changes,
  })

  const events = buildRenameEvents(item, updates)

  return await session.build({
    command,
    events,
  })
}

async function collectRenameChanges(
  ctx: CampaignMutationCtx,
  item: AnySidebarItem,
  command: RenameFileSystemCommand,
): Promise<RenameChangeSet> {
  const changeSet: RenameChangeSet = { updates: {}, changes: [] }
  await collectSidebarMetadataChanges(ctx, item, command, changeSet)
  return changeSet
}

async function collectSidebarMetadataChanges(
  ctx: CampaignMutationCtx,
  item: AnySidebarItem,
  command: RenameFileSystemCommand,
  changeSet: RenameChangeSet,
): Promise<void> {
  const name = requireOptionalSidebarItemName(command.name)
  const iconName = requireOptionalSidebarItemIconName(command.iconName)
  const color = requireOptionalSidebarItemColor(command.color)

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, { item, newName: name })
    if (rename) {
      changeSet.updates.name = rename.name
      changeSet.updates.slug = rename.slug
      changeSet.changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: item.name, to: rename.name },
      })
    }
  }

  if (iconName !== undefined && iconName !== item.iconName) {
    changeSet.updates.iconName = iconName
    changeSet.changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: item.iconName, to: iconName },
    })
  }

  if (color !== undefined && color !== item.color) {
    changeSet.updates.color = color
    changeSet.changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: item.color, to: color },
    })
  }
}

function buildRenameEvents(item: AnySidebarItem, updates: SidebarItemUpdates) {
  if (typeof updates.slug !== 'string')
    return [{ type: FILE_SYSTEM_EVENT_TYPE.noop, itemId: item._id }]
  return [
    {
      type: FILE_SYSTEM_EVENT_TYPE.renamed,
      itemId: item._id,
      slug: updates.slug,
      previousSlug: item.slug,
    },
  ]
}
