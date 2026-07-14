import { assertConvexResourceTitle } from '../../validation/name'
import { requireCreateParentTarget } from '../../validation/parent'
import { requireOptionalSidebarItemColor, requireOptionalSidebarItemIconName } from '../appearance'
import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import { createFileSystemWriteSession } from '../deltas'
import { initializeEmptySidebarItemCompanion } from '../companionInitialization'
import { resolveCreateCommandParentId } from '../pathParentResolver'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../capabilities'
import { evaluateCreateItem } from '@wizard-archive/editor/resources/operation-capabilities'
import type { CampaignMutationCtx } from '../../../functions'
import type { Id } from '../../../_generated/dataModel'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { FileSystemWriteSession, StoredResourceDelta } from '../deltas'

type CreateFileSystemCommand = Extract<ResourceCommand, { type: 'create' }>

type CreatedItem = {
  itemId: Id<'sidebarItems'>
  resourceId: ResourceId
}

async function createSidebarItem(
  ctx: CampaignMutationCtx,
  session: FileSystemWriteSession,
  command: CreateFileSystemCommand,
): Promise<CreatedItem> {
  assertSidebarOperationAllowed(
    evaluateCreateItem(operationActorFromRole(ctx.membership.role), command.itemType),
  )
  const name = assertConvexResourceTitle(command.name)
  const parentTarget = requireCreateParentTarget(command.parentTarget)
  const iconName = requireOptionalSidebarItemIconName(command.iconName)
  const color = requireOptionalSidebarItemColor(command.color)
  const parentId = await resolveCreateCommandParentId(ctx, session, { parentTarget })

  const { itemId, resourceId } = await session.insertResource({
    resourceId: command.resourceId,
    type: command.itemType,
    name,
    parentId,
    iconName: iconName ?? undefined,
    color: color ?? undefined,
  })

  await initializeEmptySidebarItemCompanion(ctx, { itemId, itemType: command.itemType })
  return { itemId, resourceId }
}

export async function executeCreateCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: CreateFileSystemCommand
  },
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const created = await createSidebarItem(ctx, session, command)
  const events = [{ type: RESOURCE_EVENT_TYPE.created, itemId: created.resourceId }]
  return await session.build({
    command,
    events,
  })
}
