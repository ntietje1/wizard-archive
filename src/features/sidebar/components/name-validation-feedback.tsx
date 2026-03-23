import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '~/features/shadcn/lib/utils'

interface NameValidationFeedbackProps {
  errorMessage?: string
  anchorRef: React.RefObject<HTMLElement | null>
  className?: string
}

export function NameValidationFeedback({
  errorMessage,
  anchorRef,
  className,
}: NameValidationFeedbackProps) {
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  const hasError = !!errorMessage

  useEffect(() => {
    if (!anchorRef.current || !hasError) {
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
  }, [anchorRef, hasError])

  if (!position || !hasError) {
    return null
  }

  const content = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1',
        'text-xs text-destructive-foreground bg-destructive rounded-md shadow-md',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-105 duration-100',
        className,
      )}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 50,
      }}
    >
      <span>{errorMessage}</span>
    </div>
  )

  return createPortal(content, document.body)
}
