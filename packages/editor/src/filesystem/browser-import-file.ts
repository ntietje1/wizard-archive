import type { ResourceImportFile } from '../files/import-contract'

export function createBrowserImportFile(file: File): ResourceImportFile {
  return {
    name: file.name,
    contentType: file.type,
    size: file.size,
    arrayBuffer: () => file.arrayBuffer(),
    text: () => file.text(),
  }
}
