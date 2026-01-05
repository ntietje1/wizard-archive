import type { Tag } from 'convex/tags/types'
import type { EditorViewerProps } from '../sidebar-item-editor'
import { isTag } from '~/lib/sidebar-item-utils'

export function TagEditor({ item: tag }: EditorViewerProps<Tag>) {
  if (!isTag(tag)) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Invalid item type for tag editor.
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Tag Editor</p>
        <p className="text-sm">Coming soon</p>
      </div>
    </div>
  )
}
