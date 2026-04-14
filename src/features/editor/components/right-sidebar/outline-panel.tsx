import { useState } from 'react'
import { api } from 'convex/_generated/api'
import { ChevronRight, List } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { BlockNoteId, HeadingLevel } from 'convex/blocks/types'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

interface HeadingNode {
  blockNoteId: BlockNoteId
  text: string
  level: HeadingLevel
  children: Array<HeadingNode>
}

function buildHeadingTree(
  headings: Array<{ blockNoteId: BlockNoteId; text: string; level: number }>,
): Array<HeadingNode> {
  const root: Array<HeadingNode> = []
  const stack: Array<HeadingNode> = []

  for (const heading of headings) {
    const node: HeadingNode = {
      blockNoteId: heading.blockNoteId,
      text: heading.text,
      level: heading.level as HeadingLevel,
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

    stack.push(node)
  }

  return root
}

function scrollToHeading(
  blockNoteId: BlockNoteId,
  editor: ReturnType<typeof useNoteEditorStore.getState>['editor'],
) {
  const escapedId = CSS.escape(blockNoteId)
  const blockEl = document.querySelector(`[data-id="${escapedId}"]`)
  if (!blockEl) return

  blockEl.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!editor?._tiptapEditor?.view) return
  editor.focus()
  editor.setTextCursorPosition(blockNoteId, 'end')
}

function HeadingItem({
  node,
  depth,
  onNavigate,
}: {
  node: HeadingNode
  depth: number
  onNavigate: (blockNoteId: BlockNoteId) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 w-full py-1 px-2 rounded-md',
          'hover:bg-accent hover:text-accent-foreground transition-colors duration-100',
          'text-muted-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${node.text}` : `Expand ${node.text}`}
            className="flex items-center justify-center w-4 h-4 shrink-0 rounded hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-100', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}
        <button
          type="button"
          className="truncate text-left text-sm rounded focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => onNavigate(node.blockNoteId)}
        >
          {node.text}
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <HeadingItem
              key={child.blockNoteId}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OutlinePanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const headingsQuery = useCampaignQuery(api.blocks.queries.getHeadingsByNote, { noteId: itemId })
  const editor = useNoteEditorStore((s) => s.editor)

  const onNavigate = (blockNoteId: BlockNoteId) => scrollToHeading(blockNoteId, editor)

  if (headingsQuery.isPending) {
    return (
      <div className="flex flex-col h-full">
        <p className="text-sm text-muted-foreground p-4 text-center">Loading outline...</p>
      </div>
    )
  }

  const headings = headingsQuery.data ?? []

  if (headings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <List className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No headings</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add headings to your note to see an outline
        </p>
      </div>
    )
  }

  const tree = buildHeadingTree(headings)

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {tree.map((node) => (
            <HeadingItem key={node.blockNoteId} node={node} depth={0} onNavigate={onNavigate} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
