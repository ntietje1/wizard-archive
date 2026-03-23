import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useNameValidation } from '~/features/shared/hooks/useNameValidation'
import { NameValidationFeedback } from '~/features/sidebar/components/name-validation-feedback'
import { cn } from '~/features/shadcn/lib/utils'

interface EditableNameProps {
  initialName: string
  isRenaming: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'folders'> | null
  excludeId?: SidebarItemId
}

export function EditableName({
  initialName,
  isRenaming,
  onFinishRename,
  onCancelRename,
  campaignId,
  parentId,
  excludeId,
}: EditableNameProps) {
  const [name, setName] = useState(initialName)
  const [prevKey, setPrevKey] = useState({ isRenaming, initialName })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (
    prevKey.isRenaming !== isRenaming ||
    prevKey.initialName !== initialName
  ) {
    setPrevKey({ isRenaming, initialName })
    setName(initialName)
  }

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
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
    const isNameChanged = trimmedName !== initialName.trim()

    const handleBlur = async () => {
      if (isSubmitting) return
      if (!isNameChanged) {
        setName(initialName)
        onCancelRename()
        return
      }

      // Validate the name before submitting
      setIsSubmitting(true)
      try {
        const error = await checkNameUnique(trimmedName)
        if (error) {
          toast.error(error)
          setName(initialName)
          onCancelRename()
          return
        }
        await onFinishRename(trimmedName)
      } catch {
        toast.error('Failed to rename. Please try again.')
        setName(initialName)
        onCancelRename()
      }
      setIsSubmitting(false)
    }

    const handleCancel = () => {
      setName(initialName)
      onCancelRename()
    }

    return (
      <div className="relative flex-1 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              handleCancel()
            }
            if (e.key === ' ') {
              e.stopPropagation()
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter a name"
          disabled={isSubmitting}
          aria-invalid={hasError}
          className={cn(
            'border-none bg-transparent w-full px-1 focus:outline-none focus:ring-1',
            hasError && 'focus:ring-destructive ring-1 ring-destructive',
            isSubmitting && 'opacity-50',
          )}
        />
        <NameValidationFeedback
          errorMessage={validationError}
          anchorRef={inputRef}
        />
      </div>
    )
  }

  return <span className="truncate ml-1">{initialName}</span>
}
