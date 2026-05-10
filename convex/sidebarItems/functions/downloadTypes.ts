import type { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { CustomBlock } from '../../notes/editorSpecs'

/**
 * A downloadable sidebar artifact. `downloadUrl` is nullable for binary-backed
 * items when no file is attached or a signed URL cannot be generated; consumers
 * must skip or report those entries instead of fetching blindly.
 */
export type DownloadItem =
  | {
      type: typeof SIDEBAR_ITEM_TYPES.files | typeof SIDEBAR_ITEM_TYPES.gameMaps
      name: string
      path: string
      downloadUrl: string | null
    }
  | {
      type: typeof SIDEBAR_ITEM_TYPES.notes
      name: string
      path: string
      content: Array<CustomBlock>
    }
