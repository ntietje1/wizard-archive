import { useEffect, useRef, useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { useNameValidation } from '~/hooks/useNameValidation'
import { NameValidationFeedback } from '~/components/validation/name-validation-feedback'
import { cn } from '~/lib/shadcn/utils'

interface EditableNameProps {
  initialName: string
  defaultName: string
  isRenaming: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
  excludeId?: SidebarItemId
}

export function EditableName({
  initialName,
  defaultName,
  isRenaming,
  onFinishRename,
  onCancelRename,
  campaignId,
  parentId,
  excludeId,
}: EditableNameProps) {
  const [name, setName] = useState(
    initialName === defaultName ? '' : initialName,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(initialName === defaultName ? '' : initialName)
  }, [isRenaming, initialName, defaultName])

  const displayInitialName = initialName === defaultName ? '' : initialName
  const { isNotUnique, isLoading, shouldValidate } = useNameValidation({
    name,
    initialName: displayInitialName,
    isActive: isRenaming,
    campaignId,
    parentId,
    excludeId,
  })

  // ensures input is focused and selected when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        })
      })
    }
  }, [isRenaming])

  if (isRenaming) {
    const trimmedName = name.trim()

    const handleSubmit = async () => {
      // Prevent submission while loading validation or already submitting
      if (isLoading || isSubmitting) {
        return
      }
      // If name is taken, block submission
      if (isNotUnique) {
        return
      }
      // If name unchanged, just cancel
      if (trimmedName === displayInitialName.trim()) {
        const resetValue = initialName === defaultName ? '' : initialName
        setName(resetValue)
        onCancelRename()
        return
      }
      // Submit the new name
      setIsSubmitting(true)
      try {
        await onFinishRename(trimmedName)
      } catch {
        // Error already handled by parent via toast, reset to original
        const resetValue = initialName === defaultName ? '' : initialName
        setName(resetValue)
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleCancel = () => {
      const resetValue = initialName === defaultName ? '' : initialName
      setName(resetValue)
      onCancelRename()
    }

    const hasError = isNotUnique

    return (
      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              await handleSubmit()
            } else if (e.key === 'Escape') {
              handleCancel()
            }
            // Prevent space from triggering button click
            if (e.key === ' ') {
              e.stopPropagation()
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder={defaultName}
          disabled={isSubmitting}
          aria-invalid={hasError}
          className={cn(
            'border-none bg-transparent w-full px-1 focus:outline-none focus:ring-1',
            hasError && 'focus:ring-destructive ring-1 ring-destructive',
            isSubmitting && 'opacity-50',
          )}
        />
        <NameValidationFeedback
          isLoading={isLoading}
          isNotUnique={isNotUnique}
          shouldValidate={shouldValidate}
        />
      </div>
    )
  }

  return <span className="truncate ml-1">{initialName || defaultName}</span>
}
