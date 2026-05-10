import type { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { AnySidebarItem } from '../../sidebarItems/types/types'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'

export function getCanvasForDownload(
  _item: Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.canvases }>,
  _path: string,
): DownloadItem | null {
  // TODO(getCanvasForDownload): canvases are not exported yet. Implement this by
  // returning a DownloadItem for SIDEBAR_ITEM_TYPES.canvases once canvas export
  // content exists; folder download orchestration treats null as unsupported.
  return null
}
