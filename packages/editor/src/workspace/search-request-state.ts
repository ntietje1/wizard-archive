import { useContext, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useDebouncedValue } from '@wizard-archive/ui/hooks/use-debounced-value'
import type { SearchDialogRequestState } from '../search/dialog-controller'
import { WorkspaceRuntimeSearchRequestContext } from './search-request-context'

export function useWorkspaceRuntimeSearchRequestState(): SearchDialogRequestState {
  const request = useContext(WorkspaceRuntimeSearchRequestContext)
  const fallback = useLocalSearchDialogRequestState({ enabled: request === null, scopeRef: null })

  return request ?? fallback
}

export function useLocalSearchDialogRequestState({
  enabled,
  scopeRef,
}: {
  enabled: boolean
  scopeRef: RefObject<HTMLElement | null> | null
}): SearchDialogRequestState {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const debouncedQuery = useDebouncedValue(query, 200)

  const close = () => {
    setIsOpen(false)
    setQuery('')
  }
  const open = () => setIsOpen(true)
  const togglePreview = () => setShowPreview((current) => !current)

  useEffect(() => {
    if (!enabled) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      const scopeElement = scopeRef?.current
      const targetIsInsideScope =
        !scopeElement ||
        (document.activeElement !== null && scopeElement.contains(document.activeElement))
      if (!isOpen && !targetIsInsideScope) return

      event.preventDefault()
      if (isOpen) {
        close()
      } else {
        open()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isOpen, scopeRef])

  return {
    close,
    debouncedQuery,
    isOpen,
    open,
    query,
    setQuery,
    showPreview,
    togglePreview,
  }
}
