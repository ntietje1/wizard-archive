import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { Button } from '~/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { MoreVertical, X } from '~/lib/icons'
import { Skeleton } from '~/components/shadcn/ui/skeleton'

interface EditableTopbarProps {
  name?: string
  defaultName?: string
  onRename?: (newName: string) => Promise<void>
  onNavigateToItem?: (item: AnySidebarItem) => void
  onClose?: () => void
  isLoading?: boolean
  isEmpty?: boolean
  ancestors?: Array<AnySidebarItem>
  onOpenMenu?: (e: React.MouseEvent) => void
}

export function EditableTopbar({
  name,
  defaultName,
  onRename,
  onNavigateToItem,
  onClose,
  isLoading = false,
  isEmpty = false,
  ancestors = [],
  onOpenMenu,
}: EditableTopbarProps) {
  const [title, setTitle] = useState(name ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const newName = name ?? ''
    setTitle(newName)
  }, [name])

  const handleTitleSubmit = useCallback(async () => {
    if (!onRename) {
      return
    }

    const previousTitle = name ?? ''

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

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full gap-4">
        <div className="flex items-center min-w-0 flex-1">
          {ancestors.map((ancestor) => (
            <div key={ancestor._id} className="flex items-center">
              <button
                onClick={() => onNavigateToItem?.(ancestor)}
                className="hover:text-gray-900 transition-colors truncate max-w-[200px] px-1 text-gray-500"
                title={ancestor.name}
              >
                {ancestor.name}
              </button>
              <span className="text-gray-400 px-1">/</span>
            </div>
          ))}
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
                  setTitle(name ?? '')
                  setIsEditing(false)
                }
              }}
              className="bg-transparent border-b border-transparent outline-none focus:ring-0 px-1 flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <div className="truncate flex-1 min-w-0">
              {!onRename ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-left px-1 inline-block cursor-not-allowed opacity-75">
                      {title || (
                        <span className="opacity-85">
                          {defaultName || 'Untitled'}
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>System category names cannot be changed</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-left border-b border-transparent hover:border-gray-300 px-1 max-w-full truncate"
                >
                  {title || (
                    <span className="opacity-85">
                      {defaultName || 'Untitled'}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onOpenMenu(e)
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
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
