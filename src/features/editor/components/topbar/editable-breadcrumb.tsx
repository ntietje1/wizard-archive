import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'convex/sidebarItems/types/types'
import type { SidebarItemName } from 'convex/sidebarItems/validation/name'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { cn } from '~/features/shadcn/lib/utils'
import { useNameValidation } from '~/shared/hooks/useNameValidation'
import { useEditSidebarItem } from '~/features/sidebar/hooks/useEditSidebarItem'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { NameValidationFeedback } from '~/features/sidebar/components/name-validation-feedback'
import { buildEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { handleError } from '~/shared/utils/logger'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'

interface EditableNameProps {
  initialName: SidebarItemName | ''
  defaultName?: string
  onRename?: (newName: string) => Promise<void>
  onChange?: (name: string) => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  excludeId?: Id<'sidebarItems'>
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
  const [name, setName] = useState<string>(initialName)
  const prevInitialNameRef = useRef(initialName)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (prevInitialNameRef.current !== initialName && !isEditing) {
    prevInitialNameRef.current = initialName
    setName(initialName)
  }

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
    isActive: isEditing,
    campaignId,
    parentId,
    excludeId,
  })

  const handleBlur = async () => {
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
      const error = checkNameUnique(trimmedName)
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
      handleError(error, 'Failed to rename item')
      setName(initialName)
      onChange?.(initialName)
    }
    setIsSubmitting(false)
  }

  const handleFocus = () => {
    if (!isEditing && !disabled) {
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    setName(initialName)
    onChange?.(initialName)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  const innerContent = (
    <>
      <span className="invisible px-1 block whitespace-pre" aria-hidden="true">
        {name || defaultName}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={name}
        placeholder={defaultName}
        aria-label="Item name"
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
      <NameValidationFeedback errorMessage={validationError} anchorRef={inputRef} />
    </>
  )

  if (!showNotSharedTooltip) {
    return <div className="truncate min-w-0 flex-shrink-0 relative">{innerContent}</div>
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="truncate min-w-0 flex-shrink-0 relative" />}>
        {innerContent}
      </TooltipTrigger>
      <TooltipContent side="bottom">This item is not visible to the current player</TooltipContent>
    </Tooltip>
  )
}

interface BreadcrumbAncestorProps {
  ancestor: AnySidebarItem
  linkProps: EditorLinkProps
  onClick: () => void
}

function BreadcrumbAncestor({ ancestor, linkProps, onClick }: BreadcrumbAncestorProps) {
  return (
    <div key={ancestor._id} className="flex items-center min-w-6 flex-shrink">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        className="rounded-sm truncate text-muted-foreground min-w-0 px-0.5 mx-0.5 cursor-pointer hover:text-foreground hover:bg-muted"
        title={ancestor.name}
        onClick={onClick}
      >
        {ancestor.name}
      </Link>
      <span className="text-muted-foreground flex-shrink-0">/</span>
    </div>
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
  const { editItem } = useEditSidebarItem()
  const { setLastSelectedItem } = useLastEditorItem()
  const { dmUsername, campaignSlug } = useCampaign()
  const routeParams = { dmUsername, campaignSlug }

  const handleRename = async (newName: string) => {
    await editItem({ item, name: newName })
  }

  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink pr-1">
        {item.ancestors.map((ancestor) => (
          <BreadcrumbAncestor
            key={ancestor._id}
            ancestor={ancestor}
            linkProps={buildEditorLinkProps(ancestor, routeParams)}
            onClick={() => setLastSelectedItem(ancestor.slug)}
          />
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
