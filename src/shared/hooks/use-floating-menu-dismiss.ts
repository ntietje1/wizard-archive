import { useEffect } from 'react'
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
  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      if (ignoreTarget?.(event.target)) return
      onDismiss()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, ignoreTarget, menuRef, onDismiss])
}
