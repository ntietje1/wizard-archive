import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import { X, MoreVertical } from '~/lib/icons'
import { useCallback, useState, useEffect, useRef } from 'react'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import type { ContextMenuItem } from '~/components/context-menu/base/context-menu'

interface EditableTopbarProps {
  name: string
  defaultName?: string
  onRename: (newName: string) => Promise<void>
  onClose?: () => void
  isLoading?: boolean
  isEmpty?: boolean
  menuItems?: ContextMenuItem[]
  deleteDialog?: React.ReactNode
}

export function EditableTopbar({
  name,
  defaultName,
  onRename,
  onClose,
  isLoading = false,
  isEmpty = false,
  menuItems = [],
  deleteDialog,
}: EditableTopbarProps) {
  const [title, setTitle] = useState(name)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(name)
  }, [name])

  const handleTitleSubmit = useCallback(async () => {
    const previousTitle = name

    if (title === previousTitle) {
      setIsEditing(false)
      return
    }

    try {
      await onRename(title)
    } catch (error) {
      console.error(error)
      setTitle(previousTitle)
    } finally {
      setIsEditing(false)
    }
  }, [name, title, onRename])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select()
    }
  }, [isEditing])

  if (isLoading) {
    return <TopbarLoading />
  }

  if (isEmpty) {
    return <TopbarEmpty />
  }

  const handleMenuItemClick = (item: ContextMenuItem) => {
    if (item.type === 'action') {
      item.onClick()
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full">
        <div className="flex items-center justify-between w-full">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={title}
              placeholder={defaultName}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTitleSubmit()
                } else if (e.key === 'Escape') {
                  setTitle(name)
                  setIsEditing(false)
                }
              }}
              className="bg-transparent border-b border-transparent outline-none focus:ring-0 px-2 w-full"
              autoFocus
            />
          ) : (
            <div className="truncate">
              <button
                onClick={() => setIsEditing(true)}
                className="text-left border-b border-transparent hover:border-gray-300 px-2 max-w-full truncate"
              >
                {title || (
                  <span className="opacity-85">{defaultName || 'Untitled'}</span>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuItems.map((item, index) =>
                    item.type === 'divider' ? (
                      <DropdownMenuSeparator key={`divider-${index}`} />
                    ) : item.type === 'action' ? (
                      <DropdownMenuItem
                        key={`action-${item.label}-${index}`}
                        onClick={() => handleMenuItemClick(item)}
                        className={item.className}
                      >
                        {item.icon && (
                          <span className="h-4 w-4 mr-2">{item.icon}</span>
                        )}
                        {item.label}
                      </DropdownMenuItem>
                    ) : null,
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {deleteDialog}
    </>
  )
}

function TopbarLoading() {
  return (
    <div className="border-b p-2 h-12">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}

function TopbarEmpty() {
  return (
    <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full">
      <div className="flex items-center justify-between w-full h-12" />
    </div>
  )
}

