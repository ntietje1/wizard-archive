import { requireSidebarItemName } from '../../validation/name'
import { requireCreateParentTarget } from '../../validation/parent'
import { requireOptionalSidebarItemColor } from '../../validation/color'
import { requireOptionalSidebarItemIconName } from '../../validation/icon'
import { FILE_SYSTEM_EVENT_TYPE } from '../receipts'
import { createFileSystemWriteSession } from '../deltas'
import { initializeEmptySidebarItemCompanion } from '../companionInitialization'
import { resolveCreateCommandParentId } from '../pathParentResolver'
import type { CampaignMutationCtx } from '../../../functions'
import type { Id } from '../../../_generated/dataModel'
import type { CreateFileSystemCommand } from '../commands'
import type { FileSystemDelta } from '../receipts'
import type { FileSystemWriteSession } from '../deltas'

type CreatedItem = {
  itemId: Id<'sidebarItems'>
  slug: string
}

async function createSidebarItem(
  ctx: CampaignMutationCtx,
  session: FileSystemWriteSession,
  command: CreateFileSystemCommand,
): Promise<CreatedItem> {
  const name = requireSidebarItemName(command.name)
  const parentTarget = requireCreateParentTarget(command.parentTarget)
  const iconName = requireOptionalSidebarItemIconName(command.iconName)
  const color = requireOptionalSidebarItemColor(command.color)
  const parentId = await resolveCreateCommandParentId(ctx, session, { parentTarget })

  const { itemId, slug } = await session.insertSidebarItem({
    type: command.itemType,
    name,
    parentId,
    iconName: iconName ?? undefined,
    color: color ?? undefined,
  })

  await initializeEmptySidebarItemCompanion(ctx, { itemId, itemType: command.itemType })
  return { itemId, slug }
}

export async function executeCreateCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: CreateFileSystemCommand
  },
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const created = await createSidebarItem(ctx, session, command)
  const events = [
    { type: FILE_SYSTEM_EVENT_TYPE.created, itemId: created.itemId, slug: created.slug },
  ]
  return await session.build({
    command,
    events,
  })
}
