import { useCallback, useEffect, useState } from 'react'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { cn } from '~/lib/shadcn/utils'

interface EditableNameProps {
  initialName: string
  defaultName: string
  onRename: (newName: string) => Promise<void>
}

export function EditableName({
  initialName,
  defaultName,
  onRename,
}: EditableNameProps) {
  const [name, setName] = useState(initialName)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  const handleNameSubmit = useCallback(async () => {
    if (name === initialName) {
      setIsEditing(false)
      return
    } else {
      await onRename(name)
        .catch((error) => {
          console.error(error)
          setName(initialName)
        })
        .finally(() => {
          setIsEditing(false)
        })
    }
  }, [name, initialName, onRename])

  const handleFocus = useCallback(() => {
    if (!isEditing) {
      setIsEditing(true)
    }
  }, [isEditing])

  return (
    <div className="truncate min-w-0 flex-shrink-0 relative">
      <span className="invisible px-1 block whitespace-pre">
        {name || defaultName}
      </span>
      <input
        type="text"
        value={name}
        placeholder={defaultName}
        readOnly={!isEditing}
        onChange={(e) => setName(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleNameSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleNameSubmit()
          } else if (e.key === 'Escape') {
            setName(initialName)
            setIsEditing(false)
          }
        }}
        className={cn(
          'absolute inset-0 min-w-0 flex-shrink-0 w-full cursor-text',
          isEditing ? 'underline' : 'hover:underline',
        )}
      />
      {!name && !isEditing && (
        <span className="absolute inset-0 pointer-events-none opacity-85 flex items-center">
          {defaultName}
        </span>
      )}
    </div>
  )
}

interface EditableBreadcrumbProps {
  initialName: string
  defaultName: string
  onRename: (newName: string) => Promise<void>
  ancestors: Array<AnySidebarItem>
  onNavigateToItem: (item: AnySidebarItem) => void
}

export function EditableBreadcrumb({
  initialName,
  defaultName,
  onRename,
  ancestors,
  onNavigateToItem,
}: EditableBreadcrumbProps) {
  return (
    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
      <div className="flex items-center min-w-0 overflow-hidden flex-shrink">
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
                className="hover:text-gray-900 transition-colors truncate text-gray-500 min-w-0 pr-1"
                title={ancestorName}
              >
                {ancestorName}
              </button>
              <span className="text-gray-400 flex-shrink-0 pr-1">/</span>
            </div>
          )
        })}
      </div>
      <EditableName
        initialName={initialName}
        defaultName={defaultName}
        onRename={onRename}
      />
    </div>
  )
}
