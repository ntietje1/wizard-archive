import { useEffect, useRef, useState } from 'react'

interface EditableNameProps {
  initialName: string
  defaultName: string
  isRenaming: boolean
  onFinishRename: (name: string) => Promise<void>
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
        onBlur={async () => await onFinishRename(name)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter') {
            await onFinishRename(name)
          } else if (e.key === 'Escape') {
            setName(initialName)
            await onFinishRename(initialName)
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
