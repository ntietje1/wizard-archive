import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SidebarItemId } from '../../../../../../../shared/common/ids'
import type { ResourceTitle } from '../../../../resources/resource-contract'
import { handleError } from '../../../../errors/handle-error'
import { useNameValidation } from '../../../../filesystem/use-name-validation'
import { NameValidationFeedback } from '@wizard-archive/ui/components/name-validation-feedback'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useSidebarNameValidator } from '../../hooks/use-sidebar-name-validator'

interface EditableNameProps {
  initialName: ResourceTitle
  isRenaming: boolean
  onFinishRename: (name: string) => Promise<void>
  onCancelRename: () => void
  displayClassName?: string
  parentId: SidebarItemId | null
  excludeId?: SidebarItemId
}

export function EditableName({
  initialName,
  isRenaming,
  onFinishRename,
  onCancelRename,
  displayClassName,
  parentId,
  excludeId,
}: EditableNameProps) {
  const [name, setName] = useState<string>(initialName)
  const validateName = useSidebarNameValidator()
  const prevKeyRef = useRef({ isRenaming, initialName })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipSubmitOnBlurRef = useRef(false)

  // Keep active rename drafts local when the backing item refreshes, but reset
  // the input whenever renaming starts or ends.
  if (prevKeyRef.current.isRenaming !== isRenaming) {
    if (!prevKeyRef.current.isRenaming && isRenaming) {
      skipSubmitOnBlurRef.current = false
      setName(initialName)
    } else if (!isRenaming) {
      setName(initialName)
    }
    prevKeyRef.current = { isRenaming, initialName }
  } else if (!isRenaming && prevKeyRef.current.initialName !== initialName) {
    prevKeyRef.current = { isRenaming, initialName }
    setName(initialName)
  } else if (prevKeyRef.current.initialName !== initialName) {
    prevKeyRef.current = { isRenaming, initialName }
  }

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
    isActive: isRenaming,
    parentId,
    excludeId,
    validateName,
  })

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      // Wait for the row to finish swapping display text for the input before selecting text.
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

    const submitRenameOnBlur = async () => {
      if (isSubmitting) return
      if (skipSubmitOnBlurRef.current) {
        skipSubmitOnBlurRef.current = false
        return
      }
      if (!isNameChanged) {
        setName(initialName)
        onCancelRename()
        return
      }

      setIsSubmitting(true)
      try {
        const error = checkNameUnique(trimmedName)
        if (error) {
          toast.error(error)
          setName(initialName)
          onCancelRename()
          return
        }
        await onFinishRename(trimmedName)
      } catch (error) {
        handleError(error, 'Failed to rename')
        setName(initialName)
        onCancelRename()
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleCancel = () => {
      skipSubmitOnBlurRef.current = true
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
          onBlur={submitRenameOnBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.nativeEvent.isComposing) return
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
          aria-label="Item name"
          aria-invalid={hasError}
          className={cn(
            'border-none bg-transparent w-full px-1 focus:outline-none focus:ring-1',
            hasError && 'focus:ring-destructive ring-1 ring-destructive',
            isSubmitting && 'opacity-50',
          )}
        />
        <NameValidationFeedback errorMessage={validationError} />
      </div>
    )
  }

  return <span className={cn('truncate ml-1', displayClassName)}>{initialName}</span>
}
