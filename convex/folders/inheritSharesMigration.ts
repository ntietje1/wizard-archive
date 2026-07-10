type FolderInheritSharesMigrationInput = {
  inheritShares?: boolean
}

export function getFolderInheritSharesMigrationPatch(folder: FolderInheritSharesMigrationInput) {
  if (folder.inheritShares !== undefined) return null

  return { inheritShares: false }
}
