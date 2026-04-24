import {
  clearCanvasPendingSelectionPreview,
  setCanvasPendingSelectionPreview,
} from './use-canvas-pending-selection-preview'
import { applyCanvasSelectionCommitMode } from '../../utils/canvas-selection-utils'
import type {
  CanvasInteractionTools,
  CanvasSelectionCommitMode,
  CanvasSelectionController,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'

interface CanvasSelectionGestureSessionAdapter<TState> {
  kind: CanvasSelectionGestureKind
  startGestureOnBegin?: boolean
  isActivated?: (startState: TState, currentState: TState) => boolean
  sync?: (state: TState) => void
  preview: (state: TState) => CanvasSelectionSnapshot | null
  clear: () => void
}

interface CreateCanvasSelectionGestureSessionOptions<TState> {
  adapter: CanvasSelectionGestureSessionAdapter<TState>
  getSelection: () => Pick<
    CanvasSelectionController,
    | 'beginGesture'
    | 'commitGestureSelection'
    | 'endGesture'
    | 'getSelectedNodeIds'
    | 'getSelectedEdgeIds'
  >
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}

export interface CanvasSelectionGestureSession<TState> {
  begin: (state: TState, mode: CanvasSelectionCommitMode) => void
  update: (state: TState) => void
  refresh: (state: TState) => void
  commit: (state?: TState) => void
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
}

export function createCanvasSelectionGestureSession<TState>({
  adapter,
  getSelection,
  interaction,
  requestAnimationFrame,
  cancelAnimationFrame,
}: CreateCanvasSelectionGestureSessionOptions<TState>): CanvasSelectionGestureSession<TState> {
  let trackingState: {
    startState: TState
    latestState: TState
    gestureStarted: boolean
    mode: CanvasSelectionCommitMode
    startSelection: CanvasSelectionSnapshot
  } | null = null
  let previewRafId = 0

  const cancelPreviewFrame = () => {
    if (!previewRafId) {
      return
    }

    cancelAnimationFrame(previewRafId)
    previewRafId = 0
  }

  const reset = () => {
    cancelPreviewFrame()
    clearCanvasPendingSelectionPreview()

    const currentState = trackingState
    trackingState = null

    adapter.clear()
    if (currentState?.gestureStarted) {
      getSelection().endGesture()
    }
  }

  const ensureGestureStarted = () => {
    if (!trackingState) {
      return false
    }

    if (trackingState.gestureStarted) {
      return true
    }

    if (
      adapter.isActivated &&
      !adapter.isActivated(trackingState.startState, trackingState.latestState)
    ) {
      return false
    }

    trackingState.gestureStarted = true
    getSelection().beginGesture(adapter.kind)
    return true
  }

  const publishPreview = () => {
    previewRafId = 0
    if (!trackingState || !ensureGestureStarted()) {
      return null
    }

    const nextSelection = adapter.preview(trackingState.latestState)
    if (nextSelection === null) {
      clearCanvasPendingSelectionPreview()
      return null
    }

    setCanvasPendingSelectionPreview(
      applyCanvasSelectionCommitMode({
        currentSelection: trackingState.startSelection,
        nextSelection,
        mode: trackingState.mode,
      }),
    )

    return nextSelection
  }

  const schedulePreview = () => {
    if (previewRafId) {
      return
    }

    previewRafId = requestAnimationFrame(() => {
      publishPreview()
    })
  }

  const setLatestState = (state: TState) => {
    if (!trackingState) {
      return
    }

    trackingState.latestState = state
    adapter.sync?.(state)
  }

  return {
    begin: (state, mode) => {
      if (trackingState !== null || previewRafId !== 0) {
        reset()
      }
      trackingState = {
        startState: state,
        latestState: state,
        gestureStarted: adapter.startGestureOnBegin ?? false,
        mode,
        startSelection: {
          nodeIds: getSelection().getSelectedNodeIds(),
          edgeIds: getSelection().getSelectedEdgeIds(),
        },
      }

      adapter.sync?.(state)
      if (trackingState.gestureStarted) {
        getSelection().beginGesture(adapter.kind)
      }
    },
    update: (state) => {
      if (!trackingState) {
        return
      }

      setLatestState(state)
      if (!ensureGestureStarted()) {
        return
      }

      schedulePreview()
    },
    refresh: (state) => {
      if (!trackingState) {
        return
      }

      setLatestState(state)
      if (!ensureGestureStarted()) {
        return
      }

      schedulePreview()
    },
    commit: (state) => {
      if (!trackingState) {
        return
      }

      if (state !== undefined) {
        setLatestState(state)
      }

      cancelPreviewFrame()
      const nextSelection = publishPreview()
      if (nextSelection !== null) {
        interaction.suppressNextSurfaceClick()
        getSelection().commitGestureSelection(nextSelection, trackingState.mode)
      }

      reset()
    },
    cancel: () => {
      if (!trackingState) {
        return
      }

      reset()
    },
    dispose: () => {
      reset()
    },
    isTracking: () => trackingState !== null,
  }
}
