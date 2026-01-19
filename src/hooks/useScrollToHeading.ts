import { useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { CustomBlock, CustomBlockNoteEditor } from '~/lib/editor-schema'
import { extractHeadingsFromContent, resolveHeadingPath } from '~/lib/heading-utils'
import { useCampaign } from '~/hooks/useCampaign'

const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const

/**
 * Scrolls to a heading when URL contains ?heading= parameter.
 */
export function useScrollToHeading(
  content: Array<CustomBlock> | undefined,
  isContentLoaded: boolean,
  editor?: CustomBlockNoteEditor,
): { isScrollingToHeading: boolean } {
  const search = useSearch({ from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor' })
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()
  const lastScrolledRef = useRef<string | null>(null)

  const hasHeadingParam = Boolean(search.heading)

  useEffect(() => {
    const { heading, ...restSearch } = search
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
      editor?.focus()
      editor?.setTextCursorPosition(target.blockId, 'start')

      document.querySelector(`[data-id="${target.blockId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      navigate({
        to: EDITOR_ROUTE,
        params: { dmUsername, campaignSlug },
        search: restSearch,
        replace: true,
      })
    })
  }, [search, content, isContentLoaded, navigate, editor, dmUsername, campaignSlug])

  return { isScrollingToHeading: hasHeadingParam }
}
