import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import type { ValidationResult } from 'shared/sidebar-items/name'
import type { EditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { cn } from '~/features/shadcn/lib/utils'
import { useNameValidation } from '~/shared/hooks/useNameValidation'
import { NameValidationFeedback } from '~/features/sidebar/components/name-validation-feedback'
import { handleError } from '~/shared/utils/logger'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'

interface EditableNameProps {
  initialName: string
  defaultName?: string
  onRename?: (newName: string) => Promise<void>
  onChange?: (name: string) => void
  campaignId?: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  excludeId?: Id<'sidebarItems'>
  disabled?: boolean
  showNotSharedTooltip?: boolean
  validateName?: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
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
  validateName,
}: EditableNameProps) {
  const [draftName, setDraftName] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const name = isEditing ? draftName : initialName

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
    isActive: isEditing,
    campaignId,
    parentId,
    excludeId,
    validateName,
  })

  const finishRename = async () => {
    if (isSubmitting) return
    const trimmedName = name.trim()
    const isNameChanged = trimmedName !== initialName.trim()

    if (!isNameChanged) {
      setDraftName('')
      setIsEditing(false)
      return
    }

    // Validate the name before submitting
    setIsSubmitting(true)
    try {
      const error = checkNameUnique(trimmedName)
      if (error) {
        toast.error(error)
        setDraftName('')
        onChange?.(initialName)
        setIsEditing(false)
        return
      }
      await onRename?.(trimmedName)
      setIsEditing(false)
    } catch (error) {
      handleError(error, 'Failed to rename item')
      setDraftName('')
      onChange?.(initialName)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const startRenaming = () => {
    if (!isEditing && !disabled) {
      setDraftName(initialName)
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    setDraftName('')
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
          setDraftName(e.target.value)
          onChange?.(e.target.value)
        }}
        onFocus={startRenaming}
        onBlur={finishRename}
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
  linkProps?: EditorLinkProps | null
  onOpen?: (item: AnySidebarItem) => void
}

function BreadcrumbAncestor({ ancestor, linkProps, onOpen }: BreadcrumbAncestorProps) {
  const className =
    'rounded-sm truncate text-muted-foreground min-w-0 px-0.5 mx-0.5 hover:text-foreground hover:bg-muted'
  const content = (() => {
    if (linkProps) {
      return (
        <Link
          {...linkProps}
          activeOptions={{ includeSearch: false }}
          className={cn(className, 'cursor-pointer')}
          title={ancestor.name}
          onClick={() => onOpen?.(ancestor)}
        >
          {ancestor.name}
        </Link>
      )
    }

    if (onOpen) {
      return (
        <button
          type="button"
          className={cn(className, 'cursor-pointer')}
          title={ancestor.name}
          onClick={() => onOpen(ancestor)}
        >
          {ancestor.name}
        </button>
      )
    }

    return (
      <span className={className} title={ancestor.name}>
        {ancestor.name}
      </span>
    )
  })()

  return (
    <div key={ancestor._id} className="flex items-center min-w-6 flex-shrink">
      {content}
      <span className="text-muted-foreground flex-shrink-0">/</span>
    </div>
  )
}

interface EditableBreadcrumbProps {
  item: AnySidebarItemWithContent
  canRename: boolean
  showNotSharedTooltip?: boolean
  onRename?: (item: AnySidebarItemWithContent, name: string) => Promise<void> | void
  onOpenAncestor?: (item: AnySidebarItem) => Promise<void> | void
  getAncestorLinkProps?: (item: AnySidebarItem) => EditorLinkProps | null
  validateName?: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}

interface SidebarItemBreadcrumbProps {
  item: AnySidebarItem
  ancestors: Array<AnySidebarItem>
  canRename: boolean
  showNotSharedTooltip?: boolean
  onRename?: (item: AnySidebarItem, name: string) => Promise<void> | void
  onOpenAncestor?: (item: AnySidebarItem) => Promise<void> | void
  getAncestorLinkProps?: (item: AnySidebarItem) => EditorLinkProps | null
  validateName?: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}

export function SidebarItemBreadcrumb({
  item,
  ancestors,
  canRename,
  showNotSharedTooltip,
  onRename,
  onOpenAncestor,
  getAncestorLinkProps,
  validateName,
}: SidebarItemBreadcrumbProps) {
  const handleRename = async (newName: string) => {
    await onRename?.(item, newName)
  }

  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink pr-1">
        {ancestors.map((ancestor) => (
          <BreadcrumbAncestor
            key={ancestor._id}
            ancestor={ancestor}
            linkProps={getAncestorLinkProps?.(ancestor)}
            onOpen={onOpenAncestor}
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
        validateName={validateName}
      />
    </div>
  )
}

export function EditableBreadcrumb(props: EditableBreadcrumbProps) {
  return (
    <SidebarItemBreadcrumb
      item={props.item}
      ancestors={props.item.ancestors}
      canRename={props.canRename}
      showNotSharedTooltip={props.showNotSharedTooltip}
      onRename={props.onRename ? (_item, name) => props.onRename?.(props.item, name) : undefined}
      onOpenAncestor={props.onOpenAncestor}
      getAncestorLinkProps={props.getAncestorLinkProps}
      validateName={props.validateName}
    />
  )
}
