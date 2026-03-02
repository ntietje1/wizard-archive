import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import { cn } from '~/lib/shadcn/utils'
import { useNameValidation } from '~/hooks/useNameValidation'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useRenameItem } from '~/hooks/useRenameItem'
import { NameValidationFeedback } from '~/components/validation/name-validation-feedback'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'

interface EditableNameProps {
  initialName: string
  defaultName?: string
  onRename?: (newName: string) => Promise<void>
  onChange?: (name: string) => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'folders'> | null
  excludeId?: SidebarItemId
  disabled?: boolean
  showNotSharedTooltip?: boolean
}

export function EditableName({
  initialName,
  defaultName = '',
  onRename,
  onChange,
  campaignId,
  parentId,
  excludeId,
  disabled,
  showNotSharedTooltip,
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
        onChange?.(initialName)
        setIsEditing(false)
        return
      }
      await onRename?.(trimmedName)
      setIsEditing(false)
    } catch (error) {
      toast.error('Failed to rename. Please try again.')
      console.error(error)
      setName(initialName)
      onChange?.(initialName)
    } finally {
      setIsSubmitting(false)
    }
  }, [name, initialName, onRename, onChange, checkNameUnique, isSubmitting])

  const handleFocus = useCallback(() => {
    if (!isEditing && !disabled) {
      setIsEditing(true)
    }
  }, [isEditing, disabled])

  const handleCancel = useCallback(() => {
    setName(initialName)
    onChange?.(initialName)
    setIsEditing(false)
    inputRef.current?.blur()
  }, [initialName, onChange])

  const innerContent = (
    <>
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
        onChange={(e) => {
          setName(e.target.value)
          onChange?.(e.target.value)
        }}
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
          !isEditing && 'caret-transparent',
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
    </>
  )

  if (!showNotSharedTooltip) {
    return (
      <div className="truncate min-w-0 flex-shrink-0 relative">
        {innerContent}
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className="truncate min-w-0 flex-shrink-0 relative" />}
      >
        {innerContent}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        This item is not visible to the current player
      </TooltipContent>
    </Tooltip>
  )
}

interface EditableBreadcrumbProps {
  item: AnySidebarItemWithContent
  canRename: boolean
  showNotSharedTooltip?: boolean
}

export function EditableBreadcrumb({
  item,
  canRename,
  showNotSharedTooltip,
}: EditableBreadcrumbProps) {
  const { navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem()

  const handleRename = useCallback(
    async (newName: string) => {
      await rename(item, newName)
    },
    [rename, item],
  )

  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink pr-1">
        {item.ancestors.map((ancestor) => (
          <div
            key={ancestor._id}
            className="flex items-center min-w-6 flex-shrink"
          >
            <button
              onClick={() => navigateToItem(ancestor)}
              className="rounded-sm transition-colors truncate text-gray-500 min-w-0 px-0.5 mx-0.5 cursor-pointer hover:text-gray-900 hover:bg-muted"
              title={ancestor.name}
              type="button"
            >
              {ancestor.name}
            </button>
            <span className="text-gray-400 flex-shrink-0">/</span>
          </div>
        ))}
      </div>
      <EditableName
        initialName={item.name}
        onRename={handleRename}
        campaignId={item.campaignId}
        parentId={item.parentId}
        excludeId={item._id}
        disabled={!canRename}
        showNotSharedTooltip={showNotSharedTooltip}
      />
    </div>
  )
}
