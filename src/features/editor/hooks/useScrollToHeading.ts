import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type {
  CustomBlock,
  CustomBlockNoteEditor,
} from 'convex/notes/editorSpecs'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import {
  extractHeadingsFromContent,
  resolveHeadingPath,
} from '~/features/editor/utils/heading-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

/**
 * Scrolls to a heading when URL contains ?heading= parameter.
 */
export function useScrollToHeading(
  content: Array<CustomBlock> | undefined,
  isContentLoaded: boolean,
  editor?: CustomBlockNoteEditor,
): { isScrollingToHeading: boolean } {
  const { editorSearch } = useCurrentItem()
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const lastScrolledRef = useRef<string | null>(null)

  const hasHeadingParam = Boolean(editorSearch.heading)

  useEffect(() => {
    const { heading, ...restSearch } = editorSearch
    if (!heading || !isContentLoaded || !content) {
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

    // Wait for DOM to render before scrolling
    requestAnimationFrame(() => {
      // Ensure editor and view are ready before setting cursor position
      if (editor?._tiptapEditor?.view) {
        try {
          editor.focus()
          editor.setTextCursorPosition(target.blockId, 'start')
        } catch {
          // Block might not exist yet or position out of range
        }
      }

      document
        .querySelector(`[data-id="${target.blockId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      navigate({
        to: EDITOR_ROUTE,
        params: { dmUsername, campaignSlug },
        search: restSearch,
        replace: true,
      })
    })
  }, [
    editorSearch,
    content,
    isContentLoaded,
    navigate,
    editor,
    dmUsername,
    campaignSlug,
  ])

  return { isScrollingToHeading: hasHeadingParam }
}
