import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import { cn } from '~/lib/shadcn/utils'
import { useNameValidation } from '~/hooks/useNameValidation'
import { NameValidationFeedback } from '~/components/validation/name-validation-feedback'

interface EditableNameProps {
  initialName: string
  defaultName: string
  onRename: (newName: string) => Promise<void>
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'>
  excludeId?: SidebarItemId
  disabled?: boolean
}

export function EditableName({
  initialName,
  defaultName,
  onRename,
  campaignId,
  parentId,
  excludeId,
  disabled,
}: EditableNameProps) {
  const [name, setName] = useState(initialName)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
    isActive: isEditing,
    campaignId,
    parentId,
    excludeId,
  })

  const handleBlur = useCallback(async () => {
    if (isSubmitting) return
    const trimmedName = name.trim()
    const isNameChanged = trimmedName !== initialName.trim()

    if (!isNameChanged) {
      setName(initialName)
      setIsEditing(false)
      return
    }

    // Validate the name before submitting
    setIsSubmitting(true)
    try {
      const error = await checkNameUnique(trimmedName)
      if (error) {
        toast.error(error)
        setName(initialName)
        setIsEditing(false)
        return
      }
      await onRename(trimmedName)
      setIsEditing(false)
    } catch (error) {
      toast.error('Failed to rename. Please try again.')
      console.error(error)
      setName(initialName)
    } finally {
      setIsSubmitting(false)
    }
  }, [name, initialName, onRename, checkNameUnique, isSubmitting])

  const handleFocus = useCallback(() => {
    if (!isEditing && !disabled) {
      setIsEditing(true)
    }
  }, [isEditing, disabled])

  const handleCancel = useCallback(() => {
    setName(initialName)
    setIsEditing(false)
  }, [initialName])

  return (
    <div className="truncate min-w-0 flex-shrink-0 relative">
      <span className="invisible px-1 block whitespace-pre">
        {name || defaultName}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={name}
        placeholder={defaultName}
        readOnly={!isEditing || disabled}
        disabled={isSubmitting || disabled}
        onChange={(e) => setName(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-invalid={hasError}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            handleCancel()
          }
        }}
        className={cn(
          'absolute inset-0 min-w-0 flex-shrink-0 w-full',
          disabled ? 'cursor-default' : 'cursor-text',
          isEditing ? 'underline' : !disabled && 'hover:underline',
          isSubmitting && 'opacity-50',
        )}
      />
      {!name && !isEditing && (
        <span className="absolute inset-0 pointer-events-none opacity-85 flex items-center cursor-text">
          {defaultName}
        </span>
      )}
      <NameValidationFeedback
        errorMessage={validationError}
        anchorRef={inputRef}
      />
    </div>
  )
}

interface EditableBreadcrumbProps {
  initialName: string
  defaultName: string
  onRename: (newName: string) => Promise<void>
  ancestors: Array<AnySidebarItem>
  onNavigateToItem: (item: AnySidebarItem) => void
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'>
  excludeId?: SidebarItemId
  disabled?: boolean
}

export function EditableBreadcrumb({
  initialName,
  defaultName,
  onRename,
  ancestors,
  onNavigateToItem,
  campaignId,
  parentId,
  excludeId,
  disabled,
}: EditableBreadcrumbProps) {
  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink pr-1">
        {ancestors.map((ancestor) => {
          const ancestorName =
            ancestor.name && ancestor.name.length > 0
              ? ancestor.name
              : defaultItemName(ancestor)

          return (
            <div
              key={ancestor._id}
              className="flex items-center min-w-6 flex-shrink"
            >
              <button
                onClick={() => onNavigateToItem(ancestor)}
                disabled={disabled}
                className={cn(
                  'rounded-sm transition-colors truncate text-gray-500 min-w-0 px-0.5 mx-0.5',
                  disabled
                    ? 'cursor-default'
                    : 'cursor-pointer hover:text-gray-900 hover:bg-muted',
                )}
                title={ancestorName}
                type="button"
              >
                {ancestorName}
              </button>
              <span
                className={cn(
                  'text-gray-400 flex-shrink-0',
                  disabled && 'cursor-default',
                )}
              >
                /
              </span>
            </div>
          )
        })}
      </div>
      <EditableName
        initialName={initialName}
        defaultName={defaultName}
        onRename={onRename}
        campaignId={campaignId}
        parentId={parentId}
        excludeId={excludeId}
        disabled={disabled}
      />
    </div>
  )
}
