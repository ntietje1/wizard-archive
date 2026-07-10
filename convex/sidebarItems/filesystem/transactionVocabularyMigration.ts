const COMMAND_TYPES = {
  setAllPlayersPermission: 'setResourceAudiencePermission',
  setSidebarItemsMemberPermission: 'setResourcesMemberPermission',
  clearSidebarItemsMemberPermission: 'clearResourcesMemberPermission',
} as const

const CHANGE_TYPES = {
  insertSidebarItem: 'insertResource',
  updateSidebarItem: 'updateResource',
  removeSidebarItem: 'removeResource',
  insertSidebarItemShare: 'insertResourceShare',
  updateSidebarItemShare: 'updateResourceShare',
  removeSidebarItemShare: 'removeResourceShare',
  updateSidebarItemBookmarkState: 'updateResourceBookmarkState',
} as const

export function getFileSystemTransactionVocabularyMigrationPatch(row: {
  command: { type: string }
  changes: Array<{ type: string }>
}): { command: unknown; changes: Array<unknown> } | undefined {
  const commandType = COMMAND_TYPES[row.command.type as keyof typeof COMMAND_TYPES]
  const migratedCommand = commandType ? { ...row.command, type: commandType } : row.command
  let changed = Boolean(commandType)
  const migratedChanges = row.changes.map((change) => {
    const type = CHANGE_TYPES[change.type as keyof typeof CHANGE_TYPES]
    if (!type) return change
    changed = true
    return { ...change, type }
  })
  return changed ? { command: migratedCommand, changes: migratedChanges } : undefined
}
