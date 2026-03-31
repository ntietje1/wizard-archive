import { Eye } from 'lucide-react'

export function PreviewBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-1.5 px-3 h-7 border-b border-primary/20 bg-primary/10 text-primary text-xs font-medium"
    >
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Preview Deployment</span>
    </div>
  )
}
