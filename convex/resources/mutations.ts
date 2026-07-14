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

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>

export const executeStructureCommand = campaignMutation({
  args: {
    operationId: v.string(),
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
    resourceId: v.string(),
    operationId: v.string(),
    update: v.bytes(),
  },
  returns: bindNoteContentResultValidator,
  handler: async (ctx, args) => await bindNoteContentFn(ctx, args),
})
