import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

export function loadSourceFiles(root, directories, { skippedDirectories = [] } = {}) {
  const files = []
  const skipped = new Set(skippedDirectories)
  for (const directory of directories) collectSourceFiles(root, directory, files, skipped)
  return files
}

function collectSourceFiles(root, relativeDirectory, files, skippedDirectories) {
  const directory = path.join(root, relativeDirectory)
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        collectSourceFiles(root, relativePath, files, skippedDirectories)
      }
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push({
        path: relativePath,
        source: readFileSync(path.join(root, relativePath), 'utf8'),
      })
    }
  }
}
