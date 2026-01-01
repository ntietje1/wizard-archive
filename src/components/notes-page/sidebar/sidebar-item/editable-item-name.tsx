import { useCallback, useEffect, useState } from 'react'

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
  const [name, setName] = useState(
    initialName === defaultName ? '' : initialName,
  )

  useEffect(() => {
    setName(initialName === defaultName ? '' : initialName)
  }, [isRenaming, initialName, defaultName])

  // ensures input is focused and selected when renaming
  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.focus()
          node.select()
        })
      })
    }
  }, [])

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
        }}
        onBlur={async () => await onFinishRename(name || defaultName)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter') {
            await onFinishRename(name || defaultName)
          } else if (e.key === 'Escape') {
            const resetValue = initialName === defaultName ? '' : initialName
            setName(resetValue)
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
