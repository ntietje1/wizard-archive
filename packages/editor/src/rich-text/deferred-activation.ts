import { useEffect, useLayoutEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

export interface RichEmbedActivationPayload {
  point: { x: number; y: number }
}

export type RichEmbedActivationTarget =
  | { kind: 'end' }
  | { kind: 'point'; payload: RichEmbedActivationPayload }

export type PendingRichEmbedActivationRef = MutableRefObject<RichEmbedActivationTarget | null>

interface UseDeferredRichEmbedActivationOptions {
  pendingActivationRef: PendingRichEmbedActivationRef
  editable: boolean
  isReady: () => boolean
  onActivate: (target: RichEmbedActivationTarget) => void
}

const MAX_MOUNT_RETRIES = 10

/**
 * Callers must set pendingActivationRef.current before enabling edit mode; later ref-only
 * mutations do not restart activation because this hook observes editability and ref identity.
 */
export function useDeferredRichEmbedActivation({
  pendingActivationRef,
  editable,
  isReady,
  onActivate,
}: UseDeferredRichEmbedActivationOptions) {
  const isReadyRef = useRef(isReady)
  const onActivateRef = useRef(onActivate)

  useLayoutEffect(() => {
    isReadyRef.current = isReady
    onActivateRef.current = onActivate
  }, [isReady, onActivate])

  useEffect(() => {
    if (editable) {
      return
    }

    pendingActivationRef.current = null
  }, [editable, pendingActivationRef])

  useEffect(() => {
    if (!editable) {
      return
    }

    // Callers set pendingActivationRef before enabling edit mode; later ref-only writes do not restart this effect.
    if (!pendingActivationRef.current) {
      return
    }

    let cancelled = false
    let frameId: number | null = null
    let retries = 0

    const run = () => {
      if (cancelled) {
        return
      }

      const target = pendingActivationRef.current
      if (!target) {
        return
      }

      if (!isReadyRef.current()) {
        retries += 1
        if (retries > MAX_MOUNT_RETRIES) {
          console.warn(
            'useDeferredRichEmbedActivation: rich embed did not become ready within retry limit',
          )
          pendingActivationRef.current = null
          return
        }

        frameId = requestAnimationFrame(run)
        return
      }

      onActivateRef.current(target)
      pendingActivationRef.current = null
    }

    frameId = requestAnimationFrame(run)

    return () => {
      cancelled = true

      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [editable, pendingActivationRef])
}
