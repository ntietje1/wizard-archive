import { Eye } from 'lucide-react'
import { prNumber } from '~/shared/utils/preview'

export function PreviewBanner() {
  const prUrl = prNumber
    ? `https://github.com/ntietje1/dnd-notes-tool/pull/${prNumber}`
    : undefined

  return (
    <div
      role="status"
      className="flex items-center gap-1.5 px-3 h-7 border-b border-primary/20 bg-primary/10 text-primary text-xs font-medium"
    >
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {prUrl ? (
        <span>
          Preview Deployment —{' '}
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary/80"
          >
            PR #{prNumber}
          </a>
        </span>
      ) : (
        <span>Preview Deployment</span>
      )}
    </div>
  )
}
