import { useRef } from 'react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'

export function ResourceRenameInput({
  actions,
  ariaLabel,
  className,
  onComplete,
  resource,
}: {
  actions: WorkspaceActions
  ariaLabel: string
  className: string
  onComplete: () => void
  resource: AuthorizedResourceSummary
}) {
  const cancelled = useRef(false)
  const commit = (title: string) => {
    if (cancelled.current || title === resource.title) {
      onComplete()
      return
    }
    void actions.update(resource.id, { title }).then((completed) => {
      if (completed) onComplete()
    })
  }

  return (
    <input
      autoFocus
      aria-label={ariaLabel}
      className={className}
      defaultValue={resource.title}
      onBlur={(event) => commit(event.currentTarget.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelled.current = true
          onComplete()
        } else if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
