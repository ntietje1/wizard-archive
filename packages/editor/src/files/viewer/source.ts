import type { FileSession, ResolvedFile } from '../session-contract'
import type { FileItemWithContent } from '../item-contract'

export interface FileViewerSource {
  canReplaceFile: (file: FileItemWithContent) => boolean
  maxUploadBytes?: FileSession['maxUploadBytes']
  replaceFile: FileSession['replaceFile']
  resolveFile: (file: FileItemWithContent) => ResolvedFile
}
