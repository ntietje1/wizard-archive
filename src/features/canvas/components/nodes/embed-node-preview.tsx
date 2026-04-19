import type { ReactElement } from 'react'

interface EmbedPreviewProps {
  url?: string
  title?: string
  type?: 'web' | 'image' | 'file'
  metadata?: Record<string, unknown>
  isLoading?: boolean
  error?: string | null
}

export function EmbedPreview({ title }: EmbedPreviewProps = {}): ReactElement {
  return (
    <div className="h-full w-full rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
      {/* TODO: Replace this placeholder with typed embed rendering for url/title/type metadata, loading/error states, and accessible preview labels. */}
      {title ?? 'Embedded item'}
    </div>
  )
}
