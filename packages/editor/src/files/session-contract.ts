import type { MaybePromise } from '../../../../shared/common/async'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'
import type { FileItemWithContent } from './item-contract'
import type { ResourceImportFile } from './import-contract'

interface ResolvedFileBase {
  contentType: string | null
  name: string
  size: number | null
}

export type ResolvedFile =
  | (ResolvedFileBase & {
      allowDataUrl?: boolean
      allowObjectUrl: boolean
      downloadUrl: string
      status: 'available'
    })
  | (ResolvedFileBase & {
      allowObjectUrl: false
      downloadUrl: null
      status: 'unattached'
    })
  | (ResolvedFileBase & {
      allowObjectUrl: false
      downloadUrl: null
      reason: 'missing'
      status: 'unavailable'
    })

interface FileSessionReplaceInput {
  fileId: FileItemWithContent['id']
  file: ResourceImportFile
}

export interface FileSession {
  maxUploadBytes?: number
  replaceFile: (input: FileSessionReplaceInput) => MaybePromise<ResourceOperationResult>
  resolveFile: (file: FileItemWithContent) => ResolvedFile
}
