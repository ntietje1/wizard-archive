import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '~/lib/shadcn/utils'

interface NameValidationFeedbackProps {
  isNotUnique: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  className?: string
}

export function NameValidationFeedback({
  isNotUnique,
  anchorRef,
  className,
}: NameValidationFeedbackProps) {
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  useEffect(() => {
    if (!anchorRef.current || !isNotUnique) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      if (!anchorRef.current) return

      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4, // mt-1 = 4px
        left: rect.left,
      })
    }

    updatePosition()

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [anchorRef, isNotUnique])

  if (!position || !isNotUnique) {
    return null
  }

  const content = isNotUnique ? (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1',
        'text-xs text-white bg-destructive rounded-md shadow-md',
        'animate-in fade-in-0 zoom-in-105 duration-100',
        className,
      )}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 50,
      }}
    >
      <span>Name already exists here</span>
    </div>
  ) : null

  return content ? createPortal(content, document.body) : null
}
