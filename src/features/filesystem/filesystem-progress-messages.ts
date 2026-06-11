import type { FileSystemCommand } from 'shared/sidebar-items/filesystem/commands'

function itemCountText(count: number) {
  return count === 1 ? 'item' : `${count} items`
}

export function getCommandProgressToastText(command: FileSystemCommand): string {
  switch (command.type) {
    case 'create':
      return 'Creating item...'
    case 'rename':
      return 'Renaming item...'
    case 'copy':
      return `Copying ${itemCountText(command.itemIds.length)}...`
    case 'move':
      return `Moving ${itemCountText(command.itemIds.length)}...`
    case 'trash':
      return `Moving ${itemCountText(command.itemIds.length)} to trash...`
    case 'restore':
      return `Restoring ${itemCountText(command.itemIds.length)}...`
    case 'deleteForever':
      return `Deleting ${itemCountText(command.itemIds.length)} forever...`
    case 'emptyTrash':
      return 'Emptying trash...'
    case 'setAllPlayersPermission':
    case 'setSidebarItemsMemberPermission':
    case 'clearSidebarItemsMemberPermission':
    case 'setFolderInheritShares':
      return 'Updating sharing...'
  }
}

export function getHistoryProgressToastText(direction: 'undo' | 'redo') {
  return direction === 'undo' ? 'Undoing...' : 'Redoing...'
}
