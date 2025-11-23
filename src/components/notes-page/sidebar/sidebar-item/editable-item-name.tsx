import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { toast } from 'sonner'
import type { AnySidebarItem } from 'convex/notes/types'
import { useEffect, useRef, useState } from 'react'

interface EditableItemNameProps<T extends AnySidebarItem> {
  item: T
  defaultName: string
  updateItem: (id: T['_id'], name: string) => Promise<T['_id']>
}

export function EditableItemName<T extends AnySidebarItem>({
  item,
  defaultName,
  updateItem,
}: EditableItemNameProps<T>) {
  const { renamingId, setRenamingId } = useFileSidebar()
  const isRenaming = renamingId === item._id

  const handleFinishRename = async (name: string) => {
    try {
      console.log('handleFinishRename', item._id, name)
      await updateItem(item._id, name)
    } catch (error) {
      console.error(error)
      toast.error('Failed to update item')
    } finally {
      setRenamingId(null)
    }
  }

  return (
    <EditableName
      initialName={item.name || ''}
      defaultName={defaultName}
      isRenaming={isRenaming}
      onFinishRename={handleFinishRename}
    />
  )
}

interface EditableNameProps {
  initialName: string
  defaultName: string
  isRenaming: boolean
  onFinishRename: (name: string) => void
}

export function EditableName({
  initialName,
  defaultName,
  isRenaming,
  onFinishRename,
}: EditableNameProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      setName(initialName)
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming, initialName])

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
        }}
        onBlur={() => onFinishRename(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onFinishRename(name)
          } else if (e.key === 'Escape') {
            setName(initialName)
            onFinishRename(initialName)
          }
          // Prevent space from triggering button click
          if (e.key === ' ') {
            e.stopPropagation()
          }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={defaultName}
        className="bg-transparent border-none w-full px-1 focus:outline-none focus:ring-1"
      />
    )
  }

  return <span className="truncate ml-1">{initialName || defaultName}</span>
}
