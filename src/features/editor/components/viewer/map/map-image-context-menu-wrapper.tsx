import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useMapView } from '~/features/editor/hooks/useMapView'
import type { GameMapWithContent } from 'convex/gameMaps/types'
import type { ContextMenuHostRef } from '~/features/context-menu/components/context-menu-host'

export function MapImageContextMenuWrapper({
  contextMenuRef,
  map,
}: {
  contextMenuRef: React.RefObject<ContextMenuHostRef | null>
  map: GameMapWithContent
}) {
  const { setActivePinId } = useMapView()

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="map-view"
      item={map}
      className="absolute inset-0 pointer-events-none"
      onClose={() => {
        setActivePinId(null)
      }}
    />
  )
}
