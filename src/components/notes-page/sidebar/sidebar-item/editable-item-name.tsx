import { useEffect, useRef, useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { useNameValidation } from '~/hooks/useNameValidation'

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
  const [hasError, setHasError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(initialName === defaultName ? '' : initialName)
    setHasError(false)
  }, [isRenaming, initialName, defaultName])

  const displayInitialName = initialName === defaultName ? '' : initialName
  const { isNotUnique, isLoading } = useNameValidation({
    name,
    initialName: displayInitialName,
    isActive: isRenaming,
    campaignId,
    parentId,
    excludeId,
  })

  // Update error state based on validation
  useEffect(() => {
    setHasError(isNotUnique)
  }, [isNotUnique])

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
      if (isLoading) {
        return
      }
      if (isNotUnique || trimmedName === displayInitialName.trim()) {
        // If invalid, reset instead of submitting
        const resetValue = initialName === defaultName ? '' : initialName
        setName(resetValue)
        setHasError(false)
        onCancelRename()
        return
      } else {
        await onFinishRename(trimmedName).catch(() => setHasError(true))
      }
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setHasError(false)
        }}
        onBlur={handleSubmit}
        onKeyDown={async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            await handleSubmit()
          } else if (e.key === 'Escape') {
            const resetValue = initialName === defaultName ? '' : initialName
            setName(resetValue)
            setHasError(false)
            onCancelRename()
          }
          // Prevent space from triggering button click
          if (e.key === ' ') {
            e.stopPropagation()
          }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={defaultName}
        aria-invalid={hasError || isNotUnique}
        className={`border-none bg-transparent w-full px-1 focus:outline-none focus:ring-1 ${
          hasError || isNotUnique ? 'focus:ring-destructive' : ''
        }`}
      />
    )
  }

  return <span className="truncate ml-1">{initialName || defaultName}</span>
}
