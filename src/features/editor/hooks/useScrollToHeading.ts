import { useEffect, useRef } from 'react'
import { useMatch, useNavigate } from '@tanstack/react-router'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import {
  extractHeadingsFromContent,
  resolveHeadingPath,
} from '~/features/editor/utils/heading-utils'
import { useNoteEditorStore } from '~/features/editor/stores/note-editor-store'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

export function useScrollToHeading(content: Array<CustomBlock> | undefined) {
  const editorMatch = useMatch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
    shouldThrow: false,
  })
  const heading = editorMatch?.search?.heading
  const searchItem = editorMatch?.search?.item
  const searchTrash = editorMatch?.search?.trash

  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const editor = useNoteEditorStore((s) => s.editor)
  const lastScrolledRef = useRef<string | null>(null)

  const hasHeadingParam = Boolean(heading)

  useEffect(() => {
    if (!heading || !content) {
      if (!heading) lastScrolledRef.current = null
      return
    }
    if (lastScrolledRef.current === heading) return

    const headingPath = heading.split('#').filter(Boolean)
    if (headingPath.length === 0) return

    const headings = extractHeadingsFromContent(content)
    const target = resolveHeadingPath(headings, headingPath)
    if (!target) return

    lastScrolledRef.current = heading

    const restSearch = { item: searchItem, trash: searchTrash }

    requestAnimationFrame(() => {
      const escapedId = CSS.escape(target.blockNoteId)
      document.querySelector(`[data-id="${escapedId}"]`)?.scrollIntoView({ block: 'start' })

      void navigate({
        to: EDITOR_ROUTE,
        params: { dmUsername, campaignSlug },
        search: restSearch,
        replace: true,
      })

      requestAnimationFrame(() => {
        if (!editor?._tiptapEditor?.view) return
        try {
          editor.focus()
          editor.setTextCursorPosition(target.blockNoteId, 'end')
        } catch {
          // Block might not exist yet or position out of range
        }
      })
    })
  }, [heading, searchItem, searchTrash, content, navigate, editor, dmUsername, campaignSlug])

  return { hasHeadingParam }
}
