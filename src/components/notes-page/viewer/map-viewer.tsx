import type { EditorViewerProps } from '~/lib/editor-registry'

// interface PinPosition {
//   x: number
//   y: number
// }

export function MapViewer({ item }: EditorViewerProps) {
  return <div>Map Viewer {item.name}</div>
  // // Type narrow to GameMap
  // const map = isGameMap(item) ? item : null
  // const [imageUrl, setImageUrl] = useState<string | null>(null)
  // const imageRef = useRef<globalThis.HTMLImageElement>(null)
  // const transformWrapperRef = useRef<ReactZoomPanPinchRef>(null)

  // const [selectedPinId, setSelectedPinId] = useState<Id<'mapPins'> | null>(null)
  // const [pinContextMenuPosition, setPinContextMenuPosition] =
  //   useState<PinPosition | null>(null)
  // const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  // const [activeTab, setActiveTab] = useState<'pinned' | 'notPinned'>('pinned')
  // const [searchQuery, setSearchQuery] = useState('')
  // const [pendingPinItem, setPendingPinItem] = useState<{
  //   itemType:
  //     | typeof SIDEBAR_ITEM_TYPES.notes
  //     | typeof SIDEBAR_ITEM_TYPES.gameMaps
  //   itemId: Id<'notes'> | Id<'gameMaps'>
  // } | null>(null)

  // const optimisticPositions = useRef<Map<Id<'mapPins'>, PinPosition>>(new Map())

  // const { campaignWithMembership } = useCampaign()
  // const campaign = campaignWithMembership?.data?.campaign
  // const convex = useConvex()

  // const mapId = map?._id

  // const pinsQuery = useQuery(
  //   convexQuery(api.gameMaps.queries.getMapPins, mapId ? { mapId } : 'skip'),
  // )
  // const pinableItemsQuery = useQuery(
  //   convexQuery(
  //     api.gameMaps.queries.getPinableItems,
  //     campaign?._id ? { campaignId: campaign._id } : 'skip',
  //   ),
  // )

  // const pins = pinsQuery.data || []
  // const allItems = pinableItemsQuery.data || []

  // const pinnedItemIds = useMemo(
  //   () => new Set(pins.map((p: MapPinWithItem) => p.item._id)),
  //   [pins],
  // )

  // const pinnedItems = useMemo(
  //   () => allItems.filter((item) => pinnedItemIds.has(item._id)),
  //   [allItems, pinnedItemIds],
  // )

  // const nonPinnedItems = useMemo(
  //   () => allItems.filter((item) => !pinnedItemIds.has(item._id)),
  //   [allItems, pinnedItemIds],
  // )

  // const filteredPinnedItems = useMemo(
  //   () =>
  //     pinnedItems.filter((item) => {
  //       const name =
  //         item.name ||
  //         (item.type === SIDEBAR_ITEM_TYPES.notes
  //           ? UNTITLED_NOTE_TITLE
  //           : UNTITLED_MAP_NAME)
  //       return name.toLowerCase().includes(searchQuery.toLowerCase())
  //     }),
  //   [pinnedItems, searchQuery],
  // )

  // const filteredNonPinnedItems = useMemo(
  //   () =>
  //     nonPinnedItems.filter((item) => {
  //       const name =
  //         item.name ||
  //         (item.type === SIDEBAR_ITEM_TYPES.notes
  //           ? UNTITLED_NOTE_TITLE
  //           : UNTITLED_MAP_NAME)
  //       return name.toLowerCase().includes(searchQuery.toLowerCase())
  //     }),
  //   [nonPinnedItems, searchQuery],
  // )

  // const createItemPinMutation = useMutation({
  //   mutationFn: useConvexMutation(api.gameMaps.mutations.createItemPin),
  // })

  // useEffect(() => {
  //   if (!map?.imageStorageId) {
  //     setImageUrl(null)
  //     return
  //   }

  //   convex
  //     .query(api.storage.queries.getDownloadUrl, {
  //       storageId: map.imageStorageId,
  //     })
  //     .then((url) => {
  //       setImageUrl(url || null)
  //     })
  //     .catch(() => {
  //       setImageUrl(null)
  //     })
  // }, [map?.imageStorageId, convex])

  // useEffect(() => {
  //   const handleKeyDown = (e: globalThis.KeyboardEvent) => {
  //     if (e.key === 'Escape' && pendingPinItem) {
  //       setPendingPinItem(null)
  //       toast.info('Pin placement cancelled')
  //     }
  //   }

  //   document.addEventListener('keydown', handleKeyDown)
  //   return () => document.removeEventListener('keydown', handleKeyDown)
  // }, [pendingPinItem])

  // const getPercentageFromClick = useCallback(
  //   (e: React.MouseEvent): PinPosition => {
  //     if (!imageRef.current) return { x: 0, y: 0 }

  //     const rect = imageRef.current.getBoundingClientRect()
  //     const x = ((e.clientX - rect.left) / rect.width) * 100
  //     const y = ((e.clientY - rect.top) / rect.height) * 100

  //     return {
  //       x: Math.max(0, Math.min(100, x)),
  //       y: Math.max(0, Math.min(100, y)),
  //     }
  //   },
  //   [],
  // )

  // const handlePlacePin = useCallback(
  //   async (position: PinPosition) => {
  //     if (!pendingPinItem || !mapId) return

  //     const item = allItems.find((i) => i._id === pendingPinItem.itemId)
  //     if (!item) return

  //     // Get iconName and color from item's category/tag
  //     let iconName = 'TagIcon'
  //     let color: string | undefined = undefined

  //     if (item.type === SIDEBAR_ITEM_TYPES.notes) {
  //       const note = item as Note
  //       iconName = note.category?.iconName || 'TagIcon'
  //       color = note.category?.defaultColor
  //     } else if (item.type === SIDEBAR_ITEM_TYPES.gameMaps) {
  //       const gameMap = item as GameMap
  //       iconName = gameMap.category?.iconName || 'MapPin'
  //       color = gameMap.category?.defaultColor
  //     }

  //     try {
  //       await createItemPinMutation.mutateAsync({
  //         mapId,
  //         x: position.x,
  //         y: position.y,
  //         iconName,
  //         color,
  //         item:
  //           pendingPinItem.itemType === SIDEBAR_ITEM_TYPES.notes
  //             ? {
  //                 itemType: SIDEBAR_ITEM_TYPES.notes,
  //                 noteId: pendingPinItem.itemId as Id<'notes'>,
  //               }
  //             : {
  //                 itemType: SIDEBAR_ITEM_TYPES.gameMaps,
  //                 mapId: pendingPinItem.itemId as Id<'gameMaps'>,
  //               },
  //       })
  //       toast.success('Pin placed on map')
  //       setPendingPinItem(null)
  //     } catch (error) {
  //       console.error('Failed to place pin:', error)
  //       toast.error('Failed to place pin')
  //     }
  //   },
  //   [pendingPinItem, mapId, createItemPinMutation, allItems],
  // )

  // const handleMapClick = useCallback(
  //   (e: React.MouseEvent) => {
  //     if (!pendingPinItem) return

  //     e.preventDefault()
  //     e.stopPropagation()
  //     const position = getPercentageFromClick(e)
  //     handlePlacePin(position)
  //   },
  //   [pendingPinItem, getPercentageFromClick, handlePlacePin],
  // )

  // const handleMapContextMenu = useCallback(
  //   (e: React.MouseEvent) => {
  //     e.preventDefault()
  //     e.stopPropagation()

  //     if (pendingPinItem) {
  //       const position = getPercentageFromClick(e)
  //       handlePlacePin(position)
  //     }
  //   },
  //   [pendingPinItem, getPercentageFromClick, handlePlacePin],
  // )

  // const handlePinnedLocationClick = useCallback(() => {
  //   // TODO: implement zoom/pan to pin here
  // }, [])

  // const handleNonPinnedItemClick = useCallback((item: Note | GameMap) => {
  //   setPendingPinItem({
  //     itemType: item.type,
  //     itemId: item._id,
  //   })
  // }, [])

  // const handleZoomIn = useCallback(() => {
  //   transformWrapperRef.current?.zoomIn()
  // }, [])

  // const handleZoomOut = useCallback(() => {
  //   transformWrapperRef.current?.zoomOut()
  // }, [])

  // const handleResetTransform = useCallback(() => {
  //   transformWrapperRef.current?.resetTransform()
  // }, [])

  // if (!map) {
  //   return null
  // }

  // return (
  //   <>
  //     <div className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col">
  //       <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
  //         <Button
  //           variant="outline"
  //           size="icon"
  //           onClick={handleZoomIn}
  //           className="bg-white shadow-md"
  //           title="Zoom In"
  //         >
  //           <Plus className="w-4 h-4" />
  //         </Button>
  //         <Button
  //           variant="outline"
  //           size="icon"
  //           onClick={handleZoomOut}
  //           className="bg-white shadow-md"
  //           title="Zoom Out"
  //         >
  //           <Minus className="w-4 h-4" />
  //         </Button>
  //         <Button
  //           variant="outline"
  //           size="icon"
  //           onClick={handleResetTransform}
  //           className="bg-white shadow-md"
  //           title="Reset View"
  //         >
  //           <RotateCcw className="w-4 h-4" />
  //         </Button>
  //       </div>

  //       <div className="flex-1 relative min-h-0">
  //         {imageUrl ? (
  //           <TransformWrapper
  //             ref={transformWrapperRef}
  //             initialScale={1}
  //             minScale={0.5}
  //             maxScale={4}
  //             wheel={{ step: 0.1 }}
  //             doubleClick={{ disabled: false }}
  //             panning={{ disabled: !!pendingPinItem }}
  //             limitToBounds={false}
  //             centerOnInit={false}
  //           >
  //             <TransformComponent
  //               wrapperClass="w-full h-full"
  //               contentClass="w-full h-full flex items-center justify-center"
  //             >
  //               <div
  //                 className="relative"
  //                 onClick={pendingPinItem ? handleMapClick : undefined}
  //                 onContextMenu={handleMapContextMenu}
  //               >
  //                 <img
  //                   ref={imageRef}
  //                   src={imageUrl}
  //                   alt={map.name || 'Map'}
  //                   className="select-none pointer-events-auto"
  //                   // onClick={handleMapClick}
  //                   onContextMenu={handleMapContextMenu}
  //                   draggable={false}
  //                   style={{
  //                     cursor: pendingPinItem ? 'crosshair' : 'default',
  //                     display: 'block',
  //                   }}
  //                 />

  //                 {pins.map((pin: MapPinWithItem) => {
  //                   const optimisticPos = optimisticPositions.current.get(
  //                     pin._id,
  //                   )
  //                   const pinPosition = optimisticPos || { x: pin.x, y: pin.y }

  //                   const Icon = getCategoryIcon(pin.iconName)
  //                   const color = pin.color || '#808080'

  //                   return (
  //                     <div
  //                       key={pin._id}
  //                       className="absolute pointer-events-auto"
  //                       style={{
  //                         left: `${pinPosition.x}%`,
  //                         top: `${pinPosition.y}%`,
  //                         transform: 'translate(-50%, -50%)',
  //                       }}
  //                     >
  //                       <div
  //                         className="rounded-full p-1.5 shadow-lg border-2 border-white"
  //                         style={{ backgroundColor: color }}
  //                       >
  //                         <Icon className="w-4 h-4 text-white" />
  //                       </div>
  //                     </div>
  //                   )
  //                 })}
  //               </div>
  //             </TransformComponent>
  //           </TransformWrapper>
  //         ) : (
  //           <div className="w-full h-full flex items-center justify-center text-muted-foreground">
  //             <p>No map image available</p>
  //           </div>
  //         )}
  //       </div>

  //       {pendingPinItem && (
  //         <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg">
  //           <p className="text-sm font-medium">
  //             Click on map to place pin for{' '}
  //             {(() => {
  //               const item = allItems.find(
  //                 (i) => i._id === pendingPinItem.itemId,
  //               )
  //               return (
  //                 item?.name ||
  //                 (item?.type === SIDEBAR_ITEM_TYPES.notes
  //                   ? UNTITLED_NOTE_TITLE
  //                   : UNTITLED_MAP_NAME) ||
  //                 'item'
  //               )
  //             })()}
  //           </p>
  //         </div>
  //       )}

  //       <ItemSidebar
  //         isOpen={isSidebarOpen}
  //         onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
  //         activeTab={activeTab}
  //         onTabChange={setActiveTab}
  //         searchQuery={searchQuery}
  //         onSearchChange={setSearchQuery}
  //         pinnedItems={filteredPinnedItems}
  //         nonPinnedItems={filteredNonPinnedItems}
  //         onPinnedItemClick={handlePinnedLocationClick}
  //         onNonPinnedItemClick={handleNonPinnedItemClick}
  //         pendingPinItem={pendingPinItem}
  //       />
  //     </div>

  //     {selectedPinId && pinContextMenuPosition && mapId && (
  //       <PinContextMenu
  //         pinId={selectedPinId}
  //         mapId={mapId}
  //         position={pinContextMenuPosition}
  //         onClose={() => {
  //           setSelectedPinId(null)
  //           setPinContextMenuPosition(null)
  //         }}
  //       />
  //     )}
  //   </>
  // )
}

// function PinContextMenu({
//   pinId,
//   mapId,
//   position,
//   onClose,
// }: {
//   pinId: Id<'mapPins'>
//   mapId: Id<'gameMaps'>
//   position: PinPosition
//   onClose: () => void
// }) {
//   const pinsQuery = useQuery(
//     convexQuery(api.gameMaps.queries.getMapPins, { mapId }),
//   )
//   const removePinMutation = useMutation({
//     mutationFn: useConvexMutation(api.gameMaps.mutations.removeItemPin),
//   })

//   const pin = pinsQuery.data?.find((p: MapPinWithItem) => p._id === pinId)

//   const handleRemovePin = useCallback(async () => {
//     if (!pin) return
//     try {
//       await removePinMutation.mutateAsync({
//         mapPinId: pinId,
//       })
//       onClose()
//     } catch (error) {
//       console.error('Failed to remove pin:', error)
//       toast.error('Failed to remove pin')
//     }
//   }, [pin, pinId, removePinMutation, onClose])

//   useEffect(() => {
//     const handleClickOutside = (e: globalThis.MouseEvent) => {
//       const menu = document.getElementById(`pin-context-menu-${pinId}`)
//       if (menu && !menu.contains(e.target as globalThis.Node)) {
//         onClose()
//       }
//     }
//     document.addEventListener('mousedown', handleClickOutside)
//     return () => document.removeEventListener('mousedown', handleClickOutside)
//   }, [pinId, onClose])

//   if (!pin) return null

//   return (
//     <div
//       id={`pin-context-menu-${pinId}`}
//       className="fixed bg-white border rounded-md shadow-lg p-1 z-[2000] min-w-[150px]"
//       style={{ left: `${position.x}px`, top: `${position.y}px` }}
//     >
//       <button
//         onClick={handleRemovePin}
//         className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-sm text-red-600"
//       >
//         Remove Pin
//       </button>
//     </div>
//   )
// }

// function ItemSidebar({
//   isOpen,
//   onToggle,
//   activeTab,
//   onTabChange,
//   searchQuery,
//   onSearchChange,
//   pinnedItems,
//   nonPinnedItems,
//   onPinnedItemClick,
//   onNonPinnedItemClick,
//   pendingPinItem,
// }: {
//   isOpen: boolean
//   onToggle: () => void
//   activeTab: 'pinned' | 'notPinned'
//   onTabChange: (tab: 'pinned' | 'notPinned') => void
//   searchQuery: string
//   onSearchChange: (query: string) => void
//   pinnedItems: (Note | GameMap)[]
//   nonPinnedItems: (Note | GameMap)[]
//   onPinnedItemClick: () => void
//   onNonPinnedItemClick: (item: Note | GameMap) => void
//   pendingPinItem: {
//     itemType:
//       | typeof SIDEBAR_ITEM_TYPES.notes
//       | typeof SIDEBAR_ITEM_TYPES.gameMaps
//     itemId: Id<'notes'> | Id<'gameMaps'>
//   } | null
// }) {
//   const getItemIcon = (item: Note | GameMap) => {
//     if (item.type === SIDEBAR_ITEM_TYPES.notes) {
//       const note = item as Note
//       return getCategoryIcon(note.category?.iconName)
//     } else {
//       const gameMap = item as GameMap
//       return getCategoryIcon(gameMap.category?.iconName)
//     }
//   }

//   const getItemColor = (item: Note | GameMap) => {
//     if (item.type === SIDEBAR_ITEM_TYPES.notes) {
//       const note = item as Note
//       return note.category?.defaultColor
//     } else {
//       const gameMap = item as GameMap
//       return gameMap.category?.defaultColor
//     }
//   }

//   const getItemName = (item: Note | GameMap) => {
//     return (
//       item.name ||
//       (item.type === SIDEBAR_ITEM_TYPES.notes
//         ? UNTITLED_NOTE_TITLE
//         : UNTITLED_MAP_NAME)
//     )
//   }

//   return (
//     <>
//       <Button
//         variant="outline"
//         size="icon"
//         className={cn(
//           'absolute top-20 right-4 z-[1000] bg-white shadow-md transition-transform',
//           isOpen && 'right-[320px]',
//         )}
//         onClick={onToggle}
//       >
//         {isOpen ? (
//           <ChevronRight className="w-4 h-4" />
//         ) : (
//           <ChevronLeft className="w-4 h-4" />
//         )}
//       </Button>

//       {isOpen && (
//         <Card className="absolute top-0 right-0 h-full w-80 z-[999] rounded-none border-l border-t-0 border-r-0 border-b-0 shadow-lg flex flex-col">
//           <CardContent className="flex-1 flex flex-col p-0 min-h-0">
//             <div className="flex border-b">
//               <button
//                 onClick={() => onTabChange('pinned')}
//                 className={cn(
//                   'flex-1 px-4 py-3 text-sm font-medium transition-colors',
//                   activeTab === 'pinned'
//                     ? 'bg-muted border-b-2 border-primary text-primary'
//                     : 'text-muted-foreground hover:text-foreground',
//                 )}
//               >
//                 Pinned ({pinnedItems.length})
//               </button>
//               <button
//                 onClick={() => onTabChange('notPinned')}
//                 className={cn(
//                   'flex-1 px-4 py-3 text-sm font-medium transition-colors',
//                   activeTab === 'notPinned'
//                     ? 'bg-muted border-b-2 border-primary text-primary'
//                     : 'text-muted-foreground hover:text-foreground',
//                 )}
//               >
//                 Not Pinned ({nonPinnedItems.length})
//               </button>
//             </div>

//             <div className="p-4 border-b">
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                 <Input
//                   type="text"
//                   placeholder="Search items..."
//                   value={searchQuery}
//                   onChange={(e) => onSearchChange(e.target.value)}
//                   className="pl-9"
//                 />
//               </div>
//             </div>

//             <ScrollArea className="flex-1">
//               <div className="p-2 space-y-1">
//                 {activeTab === 'pinned' &&
//                   pinnedItems.map((item) => {
//                     const Icon = getItemIcon(item)
//                     const color = getItemColor(item)
//                     return (
//                       <button
//                         key={item._id}
//                         onClick={onPinnedItemClick}
//                         className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2"
//                       >
//                         <Icon
//                           className="w-4 h-4 flex-shrink-0"
//                           style={{ color }}
//                         />
//                         <span className="truncate">{getItemName(item)}</span>
//                       </button>
//                     )
//                   })}
//                 {activeTab === 'notPinned' &&
//                   nonPinnedItems.map((item) => {
//                     const Icon = getItemIcon(item)
//                     const color = getItemColor(item)
//                     const isPending = pendingPinItem?.itemId === item._id
//                     return (
//                       <button
//                         key={item._id}
//                         onClick={() => onNonPinnedItemClick(item)}
//                         className={cn(
//                           'w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2',
//                           isPending && 'bg-blue-100 border border-blue-300',
//                         )}
//                       >
//                         <Icon
//                           className="w-4 h-4 flex-shrink-0"
//                           style={{ color }}
//                         />
//                         <span className="truncate">{getItemName(item)}</span>
//                       </button>
//                     )
//                   })}
//                 {activeTab === 'pinned' && pinnedItems.length === 0 && (
//                   <div className="px-3 py-8 text-center text-sm text-muted-foreground">
//                     {searchQuery
//                       ? 'No pinned items match your search'
//                       : 'No pinned items'}
//                   </div>
//                 )}
//                 {activeTab === 'notPinned' && nonPinnedItems.length === 0 && (
//                   <div className="px-3 py-8 text-center text-sm text-muted-foreground">
//                     {searchQuery
//                       ? 'No items match your search'
//                       : 'All items are pinned'}
//                   </div>
//                 )}
//               </div>
//             </ScrollArea>
//           </CardContent>
//         </Card>
//       )}
//     </>
//   )
// }
