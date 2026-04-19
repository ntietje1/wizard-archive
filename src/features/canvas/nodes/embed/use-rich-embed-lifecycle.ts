import { useEffect, useRef } from 'react'
import { logger } from '~/shared/utils/logger'

export interface RichEmbedActivationPayload {
  point: { x: number; y: number }
}

export interface RichEmbedLifecycleController {
  pendingActivationRef: React.MutableRefObject<RichEmbedActivationPayload | null>
}

interface UseRichEmbedActivationOptions {
  canEdit: boolean
  embedId: string
  setEditingEmbedId: (id: string | null) => void
}

interface UseRichEmbedLifecycleOptions {
  lifecycle: RichEmbedLifecycleController
  editable: boolean
  isReady: () => boolean
  onActivate: (payload: RichEmbedActivationPayload | null) => void
}

const MAX_MOUNT_RETRIES = 10

export function useRichEmbedActivation({
  canEdit,
  embedId,
  setEditingEmbedId,
}: UseRichEmbedActivationOptions) {
  const pendingActivationRef = useRef<RichEmbedActivationPayload | null>(null)
  const activateEditFrameRef = useRef<number | null>(null)

  const lifecycle: RichEmbedLifecycleController = { pendingActivationRef }

  useEffect(() => {
    return () => {
      pendingActivationRef.current = null
      if (activateEditFrameRef.current !== null) {
        cancelAnimationFrame(activateEditFrameRef.current)
      }
    }
  }, [])

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canEdit) return

    pendingActivationRef.current = { point: { x: e.clientX, y: e.clientY } }
    if (activateEditFrameRef.current !== null) {
      cancelAnimationFrame(activateEditFrameRef.current)
    }
    activateEditFrameRef.current = requestAnimationFrame(() => {
      activateEditFrameRef.current = null
      setEditingEmbedId(embedId)
    })
  }

  return { lifecycle, handleDoubleClick }
}

export function useRichEmbedLifecycle({
  lifecycle,
  editable,
  isReady,
  onActivate,
}: UseRichEmbedLifecycleOptions) {
  const isReadyRef = useRef(isReady)
  isReadyRef.current = isReady
  const onActivateRef = useRef(onActivate)
  onActivateRef.current = onActivate
  const rafIdRef = useRef<number | null>(null)
  const retriesRef = useRef(0)
  const cancelledRef = useRef(false)
  const runLifecycleRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!editable) {
      lifecycle.pendingActivationRef.current = null
    }
  }, [editable, lifecycle])

  runLifecycleRef.current = () => {
    if (cancelledRef.current) return

    if (!isReadyRef.current()) {
      retriesRef.current += 1
      if (retriesRef.current > MAX_MOUNT_RETRIES) {
        logger.warn('useRichEmbedLifecycle: rich embed did not become ready within retry limit')
        return
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        runLifecycleRef.current()
      })
      return
    }

    onActivateRef.current(lifecycle.pendingActivationRef.current)
    lifecycle.pendingActivationRef.current = null
  }

  useEffect(() => {
    if (!editable) return

    cancelledRef.current = false
    retriesRef.current = 0
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        runLifecycleRef.current()
      })
    }

    return () => {
      cancelledRef.current = true
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [editable, lifecycle])

  useEffect(() => {
    if (!editable) return
    if (!lifecycle.pendingActivationRef.current) return
    if (rafIdRef.current !== null) return
    if (retriesRef.current <= MAX_MOUNT_RETRIES) return

    retriesRef.current = 0
    cancelledRef.current = false
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      runLifecycleRef.current()
    })
  })
}
