import { RESOURCE_TYPES } from '../../items-persistence-contract'
import type { AnyItemWithContent } from '../../items'
import { CanvasViewer } from '../../../canvas/viewer/viewer'
import { FileViewer } from '../../../files/viewer/viewer'
import { FolderViewer } from '../../../folders/viewer/viewer'
import { MapViewer } from '../../../game-maps/viewer/viewer'
import { NoteEditor } from '../../../notes/viewer/note-editor'
import type { CanvasViewerContentSource } from '../../../canvas/viewer/source'
import type { FileViewerSource } from '../../../files/viewer/source'
import type { FolderViewerSource } from '../../../filesystem/cards/source'
import type { MapViewerSource } from '../../../game-maps/viewer/source'
import type { NoteEditorSource } from '../../../notes/viewer/note-editor-source'
import { throwUnhandledResourceItem } from '../utils/unhandled-resource-item'

export interface SidebarItemViewerSource {
  resolveCanvas: () => CanvasViewerContentSource
  resolveFile: () => FileViewerSource
  resolveFolder: () => FolderViewerSource
  resolveMap: () => MapViewerSource
  resolveNote: () => NoteEditorSource
}

type SidebarItemViewerProps = {
  item: AnyItemWithContent
  source: SidebarItemViewerSource
}

export function SidebarItemViewer({ item, source }: SidebarItemViewerProps) {
  switch (item.type) {
    case RESOURCE_TYPES.notes:
      return <NoteEditor key={item.id} item={item} source={source.resolveNote()} />
    case RESOURCE_TYPES.gameMaps:
      return <MapViewer key={item.id} item={item} source={source.resolveMap()} />
    case RESOURCE_TYPES.folders:
      return <FolderViewer key={item.id} item={item} source={source.resolveFolder()} />
    case RESOURCE_TYPES.files:
      return <FileViewer key={item.id} item={item} source={source.resolveFile()} />
    case RESOURCE_TYPES.canvases:
      return <CanvasViewer key={item.id} item={item} source={source.resolveCanvas()} />
    default:
      return throwUnhandledResourceItem(
        item,
        (unhandledItem) =>
          `Unhandled sidebar item type "${unhandledItem.type ?? 'unknown'}" for "${
            unhandledItem.id ?? 'unknown'
          }"`,
      )
  }
}
