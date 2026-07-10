import { RESOURCE_COMMAND_TYPE } from './transaction-contract'
import type { ResourceCommand } from './transaction-contract'

type CommandProgressMessage<TCommandType extends ResourceCommand['type']> = (
  command: Extract<ResourceCommand, { type: TCommandType }>,
) => string

type CommandProgressMessages = {
  [TCommandType in ResourceCommand['type']]: CommandProgressMessage<TCommandType>
}

function itemCountText(count: number) {
  return count === 1 ? 'item' : `${count} items`
}

function defineCommandProgressMessages(messages: CommandProgressMessages) {
  return messages
}

const updatingSharingMessage = () => 'Updating sharing...'

const COMMAND_PROGRESS_MESSAGES = defineCommandProgressMessages({
  [RESOURCE_COMMAND_TYPE.create]: () => 'Creating item...',
  [RESOURCE_COMMAND_TYPE.rename]: (command) =>
    command.name === undefined ? 'Updating item...' : 'Renaming item...',
  [RESOURCE_COMMAND_TYPE.copy]: (command) => `Copying ${itemCountText(command.itemIds.length)}...`,
  [RESOURCE_COMMAND_TYPE.move]: (command) => `Moving ${itemCountText(command.itemIds.length)}...`,
  [RESOURCE_COMMAND_TYPE.trash]: (command) =>
    `Moving ${itemCountText(command.itemIds.length)} to trash...`,
  [RESOURCE_COMMAND_TYPE.restore]: (command) =>
    `Restoring ${itemCountText(command.itemIds.length)}...`,
  [RESOURCE_COMMAND_TYPE.deleteForever]: (command) =>
    `Deleting ${itemCountText(command.itemIds.length)} forever...`,
  [RESOURCE_COMMAND_TYPE.emptyTrash]: () => 'Emptying trash...',
  [RESOURCE_COMMAND_TYPE.setResourceAudiencePermission]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.setResourcesMemberPermission]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.setFolderInheritShares]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.setBlocksShareStatus]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.setBlockMemberPermission]: updatingSharingMessage,
  [RESOURCE_COMMAND_TYPE.toggleBookmarks]: () => 'Updating bookmarks...',
}) satisfies Record<ResourceCommand['type'], CommandProgressMessages[ResourceCommand['type']]>

export function getCommandProgressToastText(command: ResourceCommand): string {
  const getMessage = COMMAND_PROGRESS_MESSAGES[command.type] as (command: ResourceCommand) => string
  return getMessage(command)
}

export function getHistoryProgressToastText(direction: 'undo' | 'redo') {
  return direction === 'undo' ? 'Undoing...' : 'Redoing...'
}
