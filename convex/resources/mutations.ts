import type { ResourceStructureCommand } from '@wizard-archive/editor/resources/command-contract'
import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import { campaignMutation } from '../functions'
import { executeStructureCommand as executeStructureCommandFn } from './functions/executeStructureCommand'
import {
  bindNoteContentResultValidator,
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
} from './schema'
import { bindNoteContent as bindNoteContentFn } from './functions/bindNoteContent'
import { operationIdValidator, resourceIdValidator } from './validators'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>

export const executeStructureCommand = campaignMutation({
  args: {
    operationId: operationIdValidator,
    command: resourceStructureCommandValidator,
  },
  returns: resourceStructureCommandResultValidator,
  handler: async (ctx, args): Promise<StoredResourceStructureCommandResult> => {
    const result = await executeStructureCommandFn(ctx, {
      operationId: args.operationId,
      command: args.command as ResourceStructureCommand,
    })
    return result as unknown as StoredResourceStructureCommandResult
  },
})

export const bindNoteContent = campaignMutation({
  args: {
    resourceId: resourceIdValidator,
    operationId: operationIdValidator,
    update: v.bytes(),
  },
  returns: bindNoteContentResultValidator,
  handler: async (ctx, args) => await bindNoteContentFn(ctx, args),
})
