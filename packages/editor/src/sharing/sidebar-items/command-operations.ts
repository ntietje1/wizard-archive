import type { ResourceCommand, ResourceCommandResult } from '../../filesystem/transaction-contract'
import type { ResourceShareOperations } from '../contracts'

type SidebarItemsShareCommand =
  | Extract<ResourceCommand, { type: 'setResourceAudiencePermission' }>
  | Extract<ResourceCommand, { type: 'setResourcesMemberPermission' }>
  | Extract<ResourceCommand, { type: 'clearResourcesMemberPermission' }>
  | Extract<ResourceCommand, { type: 'setFolderInheritShares' }>

type ExecuteSidebarItemsShareCommand = (
  command: SidebarItemsShareCommand,
) => Promise<ResourceCommandResult>

export function createSidebarItemsShareCommandOperations({
  executeCommand,
}: {
  executeCommand: ExecuteSidebarItemsShareCommand
}): ResourceShareOperations {
  return {
    setDefaultPermission: async (input) => {
      return await executeCommand({ type: 'setResourceAudiencePermission', ...input })
    },
    setParticipantPermission: async ({ participantId, ...input }) => {
      return await executeCommand({
        type: 'setResourcesMemberPermission',
        ...input,
        campaignMemberId: participantId,
      })
    },
    clearParticipantPermission: async ({ participantId, ...input }) => {
      return await executeCommand({
        type: 'clearResourcesMemberPermission',
        ...input,
        campaignMemberId: participantId,
      })
    },
    setFolderInheritShares: async (input) => {
      return await executeCommand({ type: 'setFolderInheritShares', ...input })
    },
  }
}
