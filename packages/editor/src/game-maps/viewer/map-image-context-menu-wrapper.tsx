import { useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { useMapView } from './use-map-view'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import type { ContextMenuHostRef } from '../../context-menu/components/host'

export function MapImageContextMenuWrapper({
  contextMenuRef,
  map,
  selectedMap,
}: {
  contextMenuRef: Ref<ContextMenuHostRef>
  map: MapItemWithContent
  selectedMap: MapItemWithContent
}) {
  const { setActivePinId } = useMapView()
  const innerContextMenuRef = useRef<ContextMenuHostRef>(null)
  const dialogOpenRef = useRef(false)

  useImperativeHandle(
    contextMenuRef,
    () => ({
      open: (position) => {
        setActivePinId(null)
        innerContextMenuRef.current?.open(position)
      },
      close: () => {
        innerContextMenuRef.current?.close()
      },
    }),
    [setActivePinId],
  )

  return (
    <WorkspaceContextMenu
      ref={innerContextMenuRef}
      viewContext="map-view"
      item={map}
      contextOverrides={{
        primaryItem: selectedMap,
        selectedItems: [selectedMap],
      }}
      className="absolute inset-0 pointer-events-none"
      onDialogOpen={() => {
        dialogOpenRef.current = true
      }}
      onDialogClose={() => {
        dialogOpenRef.current = false
        setActivePinId(null)
      }}
      onClose={() => {
        if (dialogOpenRef.current) return
        setActivePinId(null)
      }}
    />
  )
}
