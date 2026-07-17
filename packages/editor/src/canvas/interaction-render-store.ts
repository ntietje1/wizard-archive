import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'

type ScheduleCanvasFrame = (render: () => void) => () => void

export function createCanvasInteractionRenderStore(
  controller: CanvasInteractionController,
  scheduleFrame: ScheduleCanvasFrame = scheduleBrowserFrame,
) {
  let rendered = controller.get()
  let latest = rendered
  let cancelFrame: (() => void) | null = null
  const listeners = new Set<() => void>()

  const publish = (snapshot: CanvasInteractionSnapshot) => {
    rendered = snapshot
    for (const listener of listeners) listener()
  }
  const cancelScheduledFrame = () => {
    cancelFrame?.()
    cancelFrame = null
  }
  const unsubscribe = controller.subscribe(() => {
    latest = controller.get()
    if (canvasRenderUpdateIsUrgent(rendered, latest)) {
      cancelScheduledFrame()
      publish(latest)
      return
    }
    if (cancelFrame) return
    publish(latest)
    cancelFrame = scheduleFrame(() => {
      cancelFrame = null
      if (latest !== rendered) publish(latest)
    })
  })

  return {
    dispose: () => {
      unsubscribe()
      cancelScheduledFrame()
      listeners.clear()
    },
    get: () => rendered,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function canvasRenderUpdateIsUrgent(
  previous: CanvasInteractionSnapshot,
  next: CanvasInteractionSnapshot,
): boolean {
  return (
    previous.interaction.type !== next.interaction.type ||
    previous.tool !== next.tool ||
    previous.toolSettings !== next.toolSettings ||
    previous.selection !== next.selection
  )
}

function scheduleBrowserFrame(render: () => void): () => void {
  if (typeof requestAnimationFrame !== 'undefined') {
    const frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }
  const timer = setTimeout(render, 16)
  return () => clearTimeout(timer)
}
