import { useEffect, useRef, useState } from 'react'
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react'
import { toast } from 'sonner'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { MapPinId, SidebarItemId } from '../../../../../shared/common/ids'
import type { MapItemWithContent, MapPinWithItem } from '../../game-maps/item-contract'
import type { MapSession } from '../../game-maps/session-contract'
import type { AnyItem } from '../../workspace/items'
import { isCompletedResourceOperation, reportMapActionError } from './map-action-errors'
import { createMapPinsAtPosition } from './map-pin-creation'
import { getImagePinPosition } from './map-pin-placement'
import type { PinPosition, ScreenPosition } from './map-pin-placement'

type MapPinSession = MapSession['pins']

type PinElementContainerRef = {
  current: HTMLElement | null
}

type ImageElementRef = {
  current: HTMLImageElement | null
}

type MapPinInteractionSource = {
  canViewItem: (item: AnyItem | null | undefined) => boolean
  createMapPins: MapPinSession['create']
  openItem: (
    itemId: SidebarItemId,
    options?: { heading?: string; replace?: boolean },
  ) => MaybePromise<void>
  updateMapPin: MapPinSession['update']
}

type PendingPinItems = {
  itemIds: Array<SidebarItemId>
  layerId: string | null
  mapId: SidebarItemId
}
type PendingPinMove = { mapId: SidebarItemId; pinId: MapPinId }
type DraggingPin = { pin: MapPinWithItem; pointerId: number }
type PinContextMenuState = {
  layerId: string | null
  pinId: MapPinId
  position: ScreenPosition
}

type StateSetter<T> = Dispatch<SetStateAction<T>>

function setPinElementPosition(pinEl: HTMLElement, position: PinPosition) {
  Object.assign(pinEl.style, {
    left: `${position.x}%`,
    top: `${position.y}%`,
  })
}

function restoreDraggedPinElement(
  draggingPin: DraggingPin,
  pinsContainer: HTMLElement | null,
  draggedPinPositionRef: { current: PinPosition | null },
) {
  const pinEl = pinsContainer?.querySelector(
    `[data-pin-id="${draggingPin.pin.id}"]`,
  ) as HTMLElement | null
  if (pinEl) {
    setPinElementPosition(pinEl, draggingPin.pin)
  }
  draggedPinPositionRef.current = null
}

function resetPinActions({
  draggedPinPositionRef,
  draggingPin,
  pinsContainerRef,
  setDraggingPin,
  setPendingPinItems,
  setPendingPinMove,
}: {
  draggedPinPositionRef: { current: PinPosition | null }
  draggingPin: DraggingPin | null
  pinsContainerRef: PinElementContainerRef
  setDraggingPin: StateSetter<DraggingPin | null>
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
}) {
  if (draggingPin) {
    restoreDraggedPinElement(draggingPin, pinsContainerRef.current, draggedPinPositionRef)
  }
  setPendingPinItems(null)
  setPendingPinMove(null)
  setDraggingPin(null)
}

export function useMapPinInteractions({
  activeLayerId,
  canEditMap,
  imageError,
  imageRef,
  map,
  pinsContainerRef,
  source,
}: {
  activeLayerId?: string | null
  canEditMap: boolean
  imageError: boolean
  imageRef: ImageElementRef
  map: MapItemWithContent
  pinsContainerRef: PinElementContainerRef
  source: MapPinInteractionSource
}) {
  const [pinContextMenuState, setPinContextMenu] = useState<PinContextMenuState | null>(null)
  const pinContextMenu =
    pinContextMenuState?.layerId === (activeLayerId ?? null) ? pinContextMenuState : null
  const [pendingPinItems, setPendingPinItems] = useState<PendingPinItems | null>(null)
  const [pendingPinMove, setPendingPinMove] = useState<PendingPinMove | null>(null)
  const [draggingPin, setDraggingPin] = useState<DraggingPin | null>(null)
  const draggedPinPositionRef = useRef<PinPosition | null>(null)
  const justFinishedDraggingRef = useRef<MapPinId | null>(null)

  usePinActionCancellation({
    canEditMap,
    draggedPinPositionRef,
    draggingPin,
    mapId: map.id,
    pendingPinItems,
    pendingPinMove,
    pinsContainerRef,
    setDraggingPin,
    setPendingPinItems,
    setPendingPinMove,
  })

  useDraggedPinSession({
    canEditMap,
    draggedPinPositionRef,
    draggingPin,
    imageRef,
    justFinishedDraggingRef,
    pinsContainerRef,
    setDraggingPin,
    source,
  })

  const { requestPinMove, requestPinPlacement } = usePinPlacementRequests({
    canEditMap,
    imageError,
    layerId: activeLayerId ?? null,
    mapId: map.id,
    setPendingPinItems,
    setPendingPinMove,
  })

  const { handleMapClick, handleMapKeyboardAction, handleMapPinActionContextMenu } =
    useMapPinActionEventHandlers({
      canEditMap,
      imageRef,
      map,
      pendingPinItems,
      pendingPinMove,
      setPendingPinItems,
      setPendingPinMove,
      source,
    })

  const { handlePinClick, handlePinContextMenu, handlePinDragStart } = useRenderedPinHandlers({
    activeLayerId: activeLayerId ?? null,
    canEditMap,
    draggedPinPositionRef,
    justFinishedDraggingRef,
    pendingPinMove,
    setPendingPinItems,
    setDraggingPin,
    setPendingPinMove,
    setPinContextMenu,
    source,
  })

  const mapCursor = draggingPin
    ? 'grabbing'
    : pendingPinItems || pendingPinMove
      ? 'crosshair'
      : 'default'
  const shouldDisablePanning = !!pendingPinItems || !!pendingPinMove || !!draggingPin

  return {
    draggingPin,
    handleMapClick,
    handleMapKeyboardAction,
    handleMapPinActionContextMenu,
    handlePinClick,
    handlePinContextMenu,
    handlePinDragStart,
    mapCursor,
    pendingPinItems,
    pendingPinMove,
    pinContextMenu,
    requestPinMove,
    requestPinPlacement,
    shouldDisablePanning,
    closePinContextMenu: () => setPinContextMenu(null),
  }
}

function usePinActionCancellation({
  canEditMap,
  draggedPinPositionRef,
  draggingPin,
  mapId,
  pendingPinItems,
  pendingPinMove,
  pinsContainerRef,
  setDraggingPin,
  setPendingPinItems,
  setPendingPinMove,
}: {
  canEditMap: boolean
  draggedPinPositionRef: { current: PinPosition | null }
  draggingPin: DraggingPin | null
  mapId: SidebarItemId
  pendingPinItems: PendingPinItems | null
  pendingPinMove: PendingPinMove | null
  pinsContainerRef: PinElementContainerRef
  setDraggingPin: StateSetter<DraggingPin | null>
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
}) {
  useEffect(() => {
    const hasStalePlacement = pendingPinItems && pendingPinItems.mapId !== mapId
    const hasStaleMove = pendingPinMove && pendingPinMove.mapId !== mapId
    const hasStaleDrag = draggingPin && draggingPin.pin.mapId !== mapId
    if (!hasStalePlacement && !hasStaleMove && !hasStaleDrag) return

    if (hasStaleDrag) {
      restoreDraggedPinElement(draggingPin, pinsContainerRef.current, draggedPinPositionRef)
    }
    if (hasStalePlacement) setPendingPinItems(null)
    if (hasStaleMove) setPendingPinMove(null)
    if (hasStaleDrag) setDraggingPin(null)
  }, [
    draggedPinPositionRef,
    draggingPin,
    mapId,
    pendingPinItems,
    pendingPinMove,
    pinsContainerRef,
    setDraggingPin,
    setPendingPinItems,
    setPendingPinMove,
  ])

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingPinItems) {
          toast.info('Pin placement cancelled')
        }
        if (pendingPinMove) {
          toast.info('Pin move cancelled')
        }
        resetPinActions({
          draggedPinPositionRef,
          draggingPin,
          pinsContainerRef,
          setDraggingPin,
          setPendingPinItems,
          setPendingPinMove,
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    draggedPinPositionRef,
    draggingPin,
    pendingPinItems,
    pendingPinMove,
    pinsContainerRef,
    setDraggingPin,
    setPendingPinItems,
    setPendingPinMove,
  ])

  useEffect(() => {
    if (canEditMap) return
    if (pendingPinItems || pendingPinMove || draggingPin) {
      resetPinActions({
        draggedPinPositionRef,
        draggingPin,
        pinsContainerRef,
        setDraggingPin,
        setPendingPinItems,
        setPendingPinMove,
      })
    }
  }, [
    canEditMap,
    draggedPinPositionRef,
    draggingPin,
    pendingPinItems,
    pendingPinMove,
    pinsContainerRef,
    setDraggingPin,
    setPendingPinItems,
    setPendingPinMove,
  ])
}

function useDraggedPinSession({
  canEditMap,
  draggedPinPositionRef,
  draggingPin,
  imageRef,
  justFinishedDraggingRef,
  pinsContainerRef,
  setDraggingPin,
  source,
}: {
  canEditMap: boolean
  draggedPinPositionRef: { current: PinPosition | null }
  draggingPin: DraggingPin | null
  imageRef: ImageElementRef
  justFinishedDraggingRef: { current: MapPinId | null }
  pinsContainerRef: PinElementContainerRef
  setDraggingPin: StateSetter<DraggingPin | null>
  source: Pick<MapPinInteractionSource, 'updateMapPin'>
}) {
  useEffect(() => {
    if (!canEditMap || !draggingPin) return

    const pinEl = pinsContainerRef.current?.querySelector(
      `[data-pin-id="${draggingPin.pin.id}"]`,
    ) as HTMLElement | null

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== draggingPin.pointerId) return
      const newPos = getImagePinPosition(imageRef.current, e)
      if (!newPos) return

      draggedPinPositionRef.current = newPos
      if (pinEl) {
        setPinElementPosition(pinEl, newPos)
      }
    }

    const handlePointerUp = async (e: PointerEvent) => {
      if (e.pointerId !== draggingPin.pointerId) return
      const pinId = draggingPin.pin.id
      const draggedPinPosition = draggedPinPositionRef.current
      if (draggedPinPosition) {
        justFinishedDraggingRef.current = pinId
        setTimeout(() => {
          if (justFinishedDraggingRef.current === pinId) {
            justFinishedDraggingRef.current = null
          }
        }, 100)

        try {
          const result = await source.updateMapPin({
            mapId: draggingPin.pin.mapId,
            mapPinId: pinId,
            x: draggedPinPosition.x,
            y: draggedPinPosition.y,
          })
          if (!isCompletedResourceOperation(result)) {
            restoreDraggedPinElement(draggingPin, pinsContainerRef.current, draggedPinPositionRef)
            reportMapActionError(result, 'Failed to move pin')
          } else {
            toast.success('Pin moved')
          }
        } catch (error) {
          restoreDraggedPinElement(draggingPin, pinsContainerRef.current, draggedPinPositionRef)
          reportMapActionError(error, 'Failed to move pin')
        }
      }
      setDraggingPin(null)
      draggedPinPositionRef.current = null
    }

    const handlePointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== draggingPin.pointerId) return
      restoreDraggedPinElement(draggingPin, pinsContainerRef.current, draggedPinPositionRef)
      setDraggingPin(null)
    }

    const pointerHandlers = [
      ['pointermove', handlePointerMove],
      ['pointerup', handlePointerUp],
      ['pointercancel', handlePointerCancel],
    ] as const
    for (const [eventName, handler] of pointerHandlers) {
      window.addEventListener(eventName, handler)
    }

    return () => {
      for (const [eventName, handler] of pointerHandlers) {
        window.removeEventListener(eventName, handler)
      }
    }
  }, [
    canEditMap,
    draggedPinPositionRef,
    draggingPin,
    imageRef,
    justFinishedDraggingRef,
    pinsContainerRef,
    setDraggingPin,
    source,
  ])
}

function usePinPlacementRequests({
  canEditMap,
  imageError,
  layerId,
  mapId,
  setPendingPinItems,
  setPendingPinMove,
}: {
  canEditMap: boolean
  imageError: boolean
  layerId: string | null
  mapId: SidebarItemId
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
}) {
  const requestPinPlacement = (input: { itemIds: Array<SidebarItemId> }) => {
    if (!canEditMap) return
    if (imageError) {
      toast.error('Cannot place pin: map image failed to load')
      return
    }
    if (input.itemIds.length === 0) return
    setPendingPinMove(null)
    setPendingPinItems({ itemIds: [...input.itemIds], layerId, mapId })
    toast.info(
      input.itemIds.length === 1
        ? 'Click on the map to place the pin'
        : 'Click on the map to place pins',
    )
  }

  const requestPinMove = (input: { pinId: MapPinId }) => {
    if (!canEditMap) return
    if (imageError) {
      toast.error('Cannot move pin: map image failed to load')
      return
    }
    setPendingPinItems(null)
    setPendingPinMove({ ...input, mapId })
  }

  return { requestPinMove, requestPinPlacement }
}

function useMapPinPositionActions({
  canEditMap,
  map,
  pendingPinItems,
  pendingPinMove,
  setPendingPinItems,
  setPendingPinMove,
  source,
}: {
  canEditMap: boolean
  map: MapItemWithContent
  pendingPinItems: PendingPinItems | null
  pendingPinMove: PendingPinMove | null
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
  source: Pick<MapPinInteractionSource, 'createMapPins' | 'updateMapPin'>
}) {
  const handlePlacePin = async (position: PinPosition) => {
    if (!pendingPinItems || !map.id) return
    if (!canEditMap) return
    if (pendingPinItems.mapId !== map.id) {
      setPendingPinItems(null)
      return
    }

    const itemIds = pendingPinItems.itemIds
    setPendingPinItems(null)
    await createMapPinsAtPosition({
      createMapPins: source.createMapPins,
      itemIds,
      layerId: pendingPinItems.layerId,
      mapId: map.id,
      position,
    })
  }

  const handleMovePin = async (position: PinPosition) => {
    if (!pendingPinMove) return
    if (!canEditMap) return
    if (pendingPinMove.mapId !== map.id) {
      setPendingPinMove(null)
      return
    }

    const pinMove = pendingPinMove
    setPendingPinMove(null)
    try {
      const result = await source.updateMapPin({
        mapId: map.id,
        mapPinId: pinMove.pinId,
        x: position.x,
        y: position.y,
      })
      if (!isCompletedResourceOperation(result)) {
        reportMapActionError(result, 'Failed to move pin')
        return
      }
      toast.success('Pin moved')
    } catch (error) {
      reportMapActionError(error, 'Failed to move pin')
    }
  }

  return { handleMovePin, handlePlacePin }
}

function useMapPinActionEventHandlers({
  canEditMap,
  imageRef,
  map,
  pendingPinItems,
  pendingPinMove,
  setPendingPinItems,
  setPendingPinMove,
  source,
}: {
  canEditMap: boolean
  imageRef: ImageElementRef
  map: MapItemWithContent
  pendingPinItems: PendingPinItems | null
  pendingPinMove: PendingPinMove | null
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
  source: Pick<MapPinInteractionSource, 'createMapPins' | 'updateMapPin'>
}) {
  const { handleMovePin, handlePlacePin } = useMapPinPositionActions({
    canEditMap,
    map,
    pendingPinItems,
    pendingPinMove,
    setPendingPinItems,
    setPendingPinMove,
    source,
  })

  const handleMapClick = (e: ReactMouseEvent) => {
    if (!pendingPinItems && !pendingPinMove) return

    e.preventDefault()
    e.stopPropagation()
    const position = getImagePinPosition(imageRef.current, e)
    if (!position) {
      toast.error(
        pendingPinItems
          ? 'No image loaded - cannot place pin'
          : 'No image loaded - cannot move pin',
      )
      return
    }

    if (pendingPinItems) {
      void handlePlacePin(position)
    } else if (pendingPinMove) {
      void handleMovePin(position)
    }
  }

  const handleMapKeyboardAction = () => {
    if (pendingPinItems) {
      void handlePlacePin({ x: 50, y: 50 })
    } else if (pendingPinMove) {
      void handleMovePin({ x: 50, y: 50 })
    }
  }

  const handleMapPinActionContextMenu = (e: ReactMouseEvent) => {
    if (!pendingPinItems && !pendingPinMove) return false

    e.preventDefault()
    e.stopPropagation()

    if (!canEditMap) return true
    const position = getImagePinPosition(imageRef.current, e)
    if (!position) {
      toast.error(
        pendingPinItems
          ? 'No image loaded - cannot place pin'
          : 'No image loaded - cannot move pin',
      )
      return true
    }
    if (pendingPinItems) {
      void handlePlacePin(position)
    } else {
      void handleMovePin(position)
    }
    return true
  }

  return { handleMapClick, handleMapKeyboardAction, handleMapPinActionContextMenu }
}

function useRenderedPinHandlers({
  activeLayerId,
  canEditMap,
  draggedPinPositionRef,
  justFinishedDraggingRef,
  pendingPinMove,
  setPendingPinItems,
  setDraggingPin,
  setPendingPinMove,
  setPinContextMenu,
  source,
}: {
  activeLayerId: string | null
  canEditMap: boolean
  draggedPinPositionRef: { current: PinPosition | null }
  justFinishedDraggingRef: { current: MapPinId | null }
  pendingPinMove: PendingPinMove | null
  setPendingPinItems: StateSetter<PendingPinItems | null>
  setDraggingPin: StateSetter<DraggingPin | null>
  setPendingPinMove: StateSetter<PendingPinMove | null>
  setPinContextMenu: StateSetter<PinContextMenuState | null>
  source: Pick<MapPinInteractionSource, 'canViewItem' | 'openItem'>
}) {
  const handlePinClick = (e: ReactMouseEvent | ReactKeyboardEvent, pin: MapPinWithItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (justFinishedDraggingRef.current === pin.id) {
      return
    }
    const canView = source.canViewItem(pin.item)
    if (!pin.item || !canView) {
      toast.error('You do not have permission to view this item')
      return
    }
    void openPinnedItem(pin)
  }

  const openPinnedItem = async (pin: MapPinWithItem) => {
    if (!pin.item) return
    try {
      await source.openItem(pin.item.id)
    } catch (error) {
      reportMapActionError(error, 'Failed to open pinned item')
    }
  }

  const handlePinContextMenu = (e: ReactMouseEvent | ReactKeyboardEvent, pin: MapPinWithItem) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    const position = getPinMenuPosition(e)

    setPinContextMenu({
      layerId: activeLayerId,
      pinId: pin.id,
      position,
    })
  }

  const handlePinDragStart = (event: ReactPointerEvent, pin: MapPinWithItem) => {
    if (!canEditMap) return
    if (pendingPinMove?.pinId === pin.id) {
      setPendingPinMove(null)
    }
    setPendingPinItems(null)
    setDraggingPin({ pin, pointerId: event.pointerId })
    draggedPinPositionRef.current = null
  }

  return { handlePinClick, handlePinContextMenu, handlePinDragStart }
}

function getPinMenuPosition(e: ReactMouseEvent | ReactKeyboardEvent): ScreenPosition {
  if ('clientX' in e && 'clientY' in e && (e.clientX !== 0 || e.clientY !== 0)) {
    return { x: e.clientX, y: e.clientY }
  }

  const rect = e.currentTarget.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}
