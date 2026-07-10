import type { KeyboardEvent, RefObject } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AnyItem, AnyItemWithContent, ValidationResult } from '../items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useNameValidation } from '../../filesystem/use-name-validation'
import { NameValidationFeedback } from '@wizard-archive/ui/components/name-validation-feedback'
import { handleError } from '../../errors/handle-error'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'

interface EditableNameProps {
  initialName: string
  defaultName?: string
  onRename?: (newName: string) => Promise<void>
  onChange?: (name: string) => void
  parentId: SidebarItemId | null
  excludeId?: SidebarItemId
  disabled?: boolean
  showNotSharedTooltip?: boolean
  validateName?: (
    name: string,
    parentId: SidebarItemId | null,
    excludeId?: SidebarItemId,
  ) => ValidationResult
}

interface EditableNameFieldProps {
  inputRef: RefObject<HTMLInputElement | null>
  name: string
  defaultName: string
  nameLabel: string
  isEditing: boolean
  isSubmitting: boolean
  disabled: boolean | undefined
  hasError: boolean
  feedbackId: string
  onNameChange: (name: string) => void
  onStartRenaming: () => void
  onFinishRename: () => void | Promise<void>
  onCancel: () => void
}

function getEditableNameLabel(initialName: string, defaultName: string) {
  const labelName = initialName || defaultName
  return labelName ? `Item name: ${labelName}` : 'Item name'
}

function EditableNameField({
  inputRef,
  name,
  defaultName,
  nameLabel,
  isEditing,
  isSubmitting,
  disabled,
  hasError,
  feedbackId,
  onNameChange,
  onStartRenaming,
  onFinishRename,
  onCancel,
}: EditableNameFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Escape') onCancel()
  }

  return (
    <>
      <span className="invisible px-1 block whitespace-pre" aria-hidden="true">
        {name || defaultName}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={name}
        placeholder={defaultName}
        aria-label={nameLabel}
        readOnly={!isEditing || disabled}
        disabled={isSubmitting || disabled}
        onChange={(event) => onNameChange(event.target.value)}
        onFocus={onStartRenaming}
        onBlur={onFinishRename}
        aria-invalid={hasError}
        aria-describedby={hasError ? feedbackId : undefined}
        onKeyDown={handleKeyDown}
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
    </>
  )
}

function EditableName({
  initialName,
  defaultName = '',
  onRename,
  onChange,
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
  const renameCancelledRef = useRef(false)
  const mountedRef = useRef(true)
  const feedbackId = useId()
  const name = isEditing ? draftName : initialName
  const nameLabel = getEditableNameLabel(initialName, defaultName)

  const { hasError, validationError, checkNameUnique } = useNameValidation({
    name,
    initialName,
    isActive: isEditing,
    parentId,
    excludeId,
    validateName,
  })

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishRename = async () => {
    if (isSubmitting) return
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false
      return
    }
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
      if (!mountedRef.current) return
      setIsEditing(false)
    } catch (error) {
      handleError(error, 'Failed to rename item')
      if (!mountedRef.current) return
      setDraftName('')
      onChange?.(initialName)
      setIsEditing(false)
    } finally {
      if (mountedRef.current) setIsSubmitting(false)
    }
  }

  const startRenaming = () => {
    if (!isEditing && !disabled) {
      renameCancelledRef.current = false
      setDraftName(initialName)
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    renameCancelledRef.current = true
    setDraftName('')
    onChange?.(initialName)
    setIsEditing(false)
    inputRef.current?.blur()
  }

  if (!showNotSharedTooltip) {
    return (
      <div className="relative min-w-0 flex-shrink-0">
        <div className="truncate min-w-0 flex-shrink-0 relative">
          <EditableNameField
            inputRef={inputRef}
            name={name}
            defaultName={defaultName}
            nameLabel={nameLabel}
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            disabled={disabled}
            hasError={hasError}
            feedbackId={feedbackId}
            onNameChange={(nextName) => {
              setDraftName(nextName)
              onChange?.(nextName)
            }}
            onStartRenaming={startRenaming}
            onFinishRename={finishRename}
            onCancel={handleCancel}
          />
        </div>
        <NameValidationFeedback id={feedbackId} errorMessage={validationError} />
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Why this item cannot be renamed"
            className="relative min-w-0 flex-shrink-0 truncate cursor-help text-left"
          />
        }
      >
        {name || defaultName}
      </TooltipTrigger>
      <TooltipContent side="bottom">This item is not visible to the current player</TooltipContent>
    </Tooltip>
  )
}

interface BreadcrumbAncestorProps {
  ancestor: AnyItem
  onOpen?: (item: AnyItem) => void
}

function BreadcrumbAncestor({ ancestor, onOpen }: BreadcrumbAncestorProps) {
  const className =
    'rounded-sm truncate text-muted-foreground min-w-0 px-0.5 mx-0.5 hover:text-foreground hover:bg-muted'
  const content = (() => {
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
    <div className="flex items-center min-w-6 flex-shrink">
      {content}
      <span className="text-muted-foreground flex-shrink-0">/</span>
    </div>
  )
}

interface EditableBreadcrumbProps {
  item: AnyItemWithContent
  canRename: boolean
  showNotSharedTooltip?: boolean
  onRename?: (item: AnyItemWithContent, name: string) => Promise<void> | void
  onOpenAncestor?: (item: AnyItem) => Promise<void> | void
  validateName?: (
    name: string,
    parentId: SidebarItemId | null,
    excludeId?: SidebarItemId,
  ) => ValidationResult
}

interface SidebarItemBreadcrumbProps<TItem extends AnyItem = AnyItem> {
  item: TItem
  ancestors: Array<AnyItem>
  canRename: boolean
  showNotSharedTooltip?: boolean
  onRename?: (item: TItem, name: string) => Promise<void> | void
  onOpenAncestor?: (item: AnyItem) => Promise<void> | void
  validateName?: (
    name: string,
    parentId: SidebarItemId | null,
    excludeId?: SidebarItemId,
  ) => ValidationResult
}

export function SidebarItemBreadcrumb<TItem extends AnyItem = AnyItem>({
  item,
  ancestors,
  canRename,
  showNotSharedTooltip,
  onRename,
  onOpenAncestor,
  validateName,
}: SidebarItemBreadcrumbProps<TItem>) {
  const handleRename = async (newName: string) => {
    await onRename?.(item, newName)
  }

  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink pr-1">
        {ancestors.map((ancestor) => (
          <BreadcrumbAncestor key={ancestor.id} ancestor={ancestor} onOpen={onOpenAncestor} />
        ))}
      </div>
      <EditableName
        initialName={item.name}
        onRename={handleRename}
        parentId={item.parentId}
        excludeId={item.id}
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
      onRename={props.onRename}
      onOpenAncestor={props.onOpenAncestor}
      validateName={props.validateName}
    />
  )
}
