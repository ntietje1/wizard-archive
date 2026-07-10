import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function useFloatingMenuDismiss({
  enabled,
  ignoreTarget,
  menuRef,
  onDismiss,
}: {
  enabled: boolean
  ignoreTarget?: (target: EventTarget | null) => boolean
  menuRef: RefObject<HTMLElement | null>
  onDismiss: () => void
}) {
  const onDismissRef = useRef(onDismiss)
  const ignoreTargetRef = useRef(ignoreTarget)
  onDismissRef.current = onDismiss
  ignoreTargetRef.current = ignoreTarget

  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      if (ignoreTargetRef.current?.(event.target)) return
      onDismissRef.current()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, menuRef])
}
