import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { logEditHistory } from '../../../editHistory/log'
import { PERMISSION_OPERATION } from '../../../../shared/permissions/requirements'
import { assertConvexResourceTitle } from '../../validation/name'
import { requireOptionalSidebarItemColor, requireOptionalSidebarItemIconName } from '../appearance'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type { EditHistoryChange } from '@wizard-archive/editor/resources/history-contract'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourcePatch } from '@wizard-archive/editor/resources/patch-contract'
import { createFileSystemWriteSession } from '../deltas'
import { requireSidebarItemRowOperationAccess } from '../access'
import { isActiveSidebarItem } from '../../types/status'
import type { AccessibleSidebarItemRow } from '../access'
import type { CampaignMutationCtx } from '../../../functions'
import type { StoredResourceDelta } from '../deltas'
import { requireSidebarItemRow, sidebarItemResourceId } from '../../functions/sidebarItemIdentity'
type RenameFileSystemCommand = Extract<ResourceCommand, { type: 'rename' }>
type SidebarItemUpdates = Pick<
  Extract<ResourcePatch, { type: 'updateResource' }>['fields'],
  'name' | 'iconName' | 'color'
>

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
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const rawItem = await requireSidebarItemRow(ctx, command.itemId)
  const item = await requireSidebarItemRowOperationAccess(ctx, {
    rawItem,
    operation: PERMISSION_OPERATION.RENAME_SIDEBAR_ITEM,
  })
  if (!isActiveSidebarItem(item)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active items can be renamed')
  }

  const { updates, changes } = collectRenameChanges(item, command)

  if (changes.length === 0) {
    const events = [{ type: RESOURCE_EVENT_TYPE.noop, itemId: sidebarItemResourceId(item) }]
    return await session.build({
      command,
      events,
    })
  }

  await session.updateResource(item._id, {
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

function collectRenameChanges(
  item: AccessibleSidebarItemRow,
  command: RenameFileSystemCommand,
): RenameChangeSet {
  const changeSet: RenameChangeSet = { updates: {}, changes: [] }
  collectSidebarMetadataChanges(item, command, changeSet)
  return changeSet
}

function collectSidebarMetadataChanges(
  item: AccessibleSidebarItemRow,
  command: RenameFileSystemCommand,
  changeSet: RenameChangeSet,
): void {
  const name = command.name === undefined ? undefined : assertConvexResourceTitle(command.name)
  const iconName = requireOptionalSidebarItemIconName(command.iconName)
  const color = requireOptionalSidebarItemColor(command.color)

  if (name !== undefined) {
    if (name !== item.name) {
      changeSet.updates.name = name
      changeSet.changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: item.name, to: name },
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

function buildRenameEvents(item: AccessibleSidebarItemRow, updates: SidebarItemUpdates) {
  if (updates.name === undefined) {
    return [{ type: RESOURCE_EVENT_TYPE.updated, itemId: sidebarItemResourceId(item) }]
  }
  return [{ type: RESOURCE_EVENT_TYPE.renamed, itemId: sidebarItemResourceId(item) }]
}
