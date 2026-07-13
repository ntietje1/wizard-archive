import type { ResourceStructureCommand } from '@wizard-archive/editor/resources/command-contract'
import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import { resourceCampaignMutation } from '../functions'
import { executeStructureCommand as executeStructureCommandFn } from './functions/executeStructureCommand'
import {
  resourceStructureCommandResultValidator,
  resourceStructureCommandValidator,
} from './schema'

type StoredResourceStructureCommandResult = Infer<typeof resourceStructureCommandResultValidator>

export const executeStructureCommand = resourceCampaignMutation({
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
