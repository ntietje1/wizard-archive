import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { CanvasViewer } from '~/features/canvas/components/canvas-viewer'
import { FileViewer } from '~/features/editor/components/viewer/file/file-viewer'
import { FolderViewer } from '~/features/editor/components/viewer/folder/folder-viewer'
import { MapViewer } from '~/features/editor/components/viewer/map/map-viewer'
import { NoteEditor } from '~/features/editor/components/viewer/note/note-editor'
import { assertNever } from '~/shared/utils/utils'
import type { ViewerProps } from '~/shared/viewer/viewer-props'

type SidebarItemViewerProps = ViewerProps<AnySidebarItemWithContent>

export function SidebarItemViewer({ item }: SidebarItemViewerProps) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return <NoteEditor key={item._id} item={item} />
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return <MapViewer key={item._id} item={item} />
    case SIDEBAR_ITEM_TYPES.folders:
      return <FolderViewer key={item._id} item={item} />
    case SIDEBAR_ITEM_TYPES.files:
      return <FileViewer key={item._id} item={item} />
    case SIDEBAR_ITEM_TYPES.canvases:
      return <CanvasViewer key={item._id} item={item} />
    default:
      return assertNever(item)
  }
}
