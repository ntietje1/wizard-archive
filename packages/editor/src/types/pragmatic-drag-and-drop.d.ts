type PragmaticCleanup = () => void

type PragmaticInput = {
  clientX: number
  clientY: number
  ctrlKey?: boolean
  shiftKey?: boolean
}

type PragmaticElementSource = {
  data: Record<string, unknown>
}

type PragmaticDropTarget = {
  data: Record<string, unknown>
}

type PragmaticElementLocation = {
  current: {
    input: PragmaticInput
    dropTargets: Array<PragmaticDropTarget>
  }
}

type PragmaticElementArgs = {
  source: PragmaticElementSource
  location: PragmaticElementLocation
}

type PragmaticExternalSource = {
  items: ReadonlyArray<DataTransferItem>
}

type PragmaticExternalArgs = {
  source: PragmaticExternalSource
  location: PragmaticElementLocation
}

type PragmaticExternalDropTargetFeedbackArgs = {
  source: PragmaticExternalSource
  input: PragmaticInput
  element: Element
}

declare module '@atlaskit/pragmatic-drag-and-drop/element/adapter' {
  export function draggable(args: {
    element: HTMLElement
    getInitialData?: () => Record<string, unknown>
    onGenerateDragPreview?: (args: { nativeSetDragImage: DataTransfer['setDragImage'] }) => void
    onDragStart?: (args: PragmaticElementArgs) => void
    onDrop?: (args: PragmaticElementArgs) => void
  }): PragmaticCleanup

  export function dropTargetForElements(args: {
    element: HTMLElement
    getData?: () => Record<string, unknown>
    canDrop?: (args: PragmaticElementArgs) => boolean
    getDropEffect?: (args: PragmaticElementArgs) => DataTransfer['dropEffect']
    onDragEnter?: (args: PragmaticElementArgs) => void
    onDragLeave?: (args: PragmaticElementArgs) => void
    onDrop?: (args: PragmaticElementArgs) => void
  }): PragmaticCleanup

  export function monitorForElements(args: {
    onDragStart?: (args: PragmaticElementArgs) => void
    onDrag?: (args: PragmaticElementArgs) => void
    onDropTargetChange?: (args: PragmaticElementArgs) => void
    onDrop?: (args: PragmaticElementArgs) => void
  }): PragmaticCleanup
}

declare module '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview' {
  export function disableNativeDragPreview(args: {
    nativeSetDragImage: DataTransfer['setDragImage']
  }): void
}

declare module '@atlaskit/pragmatic-drag-and-drop/external/adapter' {
  export function monitorForExternal(args: {
    canMonitor?: (args: { source: PragmaticExternalSource }) => boolean
    onDragStart?: (args: PragmaticExternalArgs) => void
    onDropTargetChange?: (args: PragmaticExternalArgs) => void
    onDrop?: (args: PragmaticExternalArgs) => void
  }): PragmaticCleanup

  export function dropTargetForExternal(args: {
    element: HTMLElement
    getData?: (args: PragmaticExternalDropTargetFeedbackArgs) => Record<string, unknown>
    canDrop?: (args: PragmaticExternalDropTargetFeedbackArgs) => boolean
    onDragEnter?: (args: PragmaticExternalArgs) => void
    onDragLeave?: (args: PragmaticExternalArgs) => void
    onDrop?: (args: PragmaticExternalArgs) => void
  }): PragmaticCleanup
}

declare module '@atlaskit/pragmatic-drag-and-drop/external/file' {
  export function containsFiles(args: { source: unknown }): boolean
}
