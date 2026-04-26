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
    'beginGesture' | 'cancelGesture' | 'commitGesture' | 'getSnapshot' | 'setGesturePreview'
  >
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}

interface CanvasSelectionGestureSession<TState> {
  begin: (state: TState, mode: CanvasSelectionCommitMode) => void
  update: (state: TState) => void
  refresh: (state: TState) => void
  commit: (state?: TState) => boolean
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
  hasRenderedPreview: () => boolean
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
  let latestPreviewSelection: CanvasSelectionSnapshot | null = null

  const cancelPreviewFrame = () => {
    if (!previewRafId) {
      return
    }

    cancelAnimationFrame(previewRafId)
    previewRafId = 0
  }

  const reset = ({ cancelGesture }: { cancelGesture: boolean }) => {
    cancelPreviewFrame()

    const currentState = trackingState
    trackingState = null
    latestPreviewSelection = null

    adapter.clear()
    if (cancelGesture && currentState?.gestureStarted) {
      getSelection().cancelGesture()
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
    getSelection().beginGesture(adapter.kind, trackingState.mode)
    return true
  }

  const publishPreview = () => {
    previewRafId = 0
    if (!trackingState || !ensureGestureStarted()) {
      return null
    }

    const nextSelection = adapter.preview(trackingState.latestState)
    if (nextSelection === null) {
      latestPreviewSelection = null
      getSelection().setGesturePreview(null)
      return null
    }

    const effectiveSelection = applyCanvasSelectionCommitMode({
      currentSelection: trackingState.startSelection,
      nextSelection,
      mode: trackingState.mode,
    })
    latestPreviewSelection = effectiveSelection
    getSelection().setGesturePreview(effectiveSelection)

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
        reset({ cancelGesture: true })
      }
      trackingState = {
        startState: state,
        latestState: state,
        gestureStarted: adapter.startGestureOnBegin ?? false,
        mode,
        startSelection: getSelection().getSnapshot(),
      }

      adapter.sync?.(state)
      if (trackingState.gestureStarted) {
        getSelection().beginGesture(adapter.kind, mode)
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
        return false
      }

      if (state !== undefined) {
        setLatestState(state)
      }

      cancelPreviewFrame()
      const nextSelection = latestPreviewSelection
      if (nextSelection !== null) {
        interaction.suppressNextSurfaceClick()
        getSelection().commitGesture()
        adapter.clear()
        trackingState = null
        latestPreviewSelection = null
        return true
      }

      reset({ cancelGesture: true })
      return false
    },
    cancel: () => {
      if (!trackingState) {
        return
      }

      reset({ cancelGesture: true })
    },
    dispose: () => {
      reset({ cancelGesture: true })
    },
    isTracking: () => trackingState !== null,
    hasRenderedPreview: () => latestPreviewSelection !== null,
  }
}
