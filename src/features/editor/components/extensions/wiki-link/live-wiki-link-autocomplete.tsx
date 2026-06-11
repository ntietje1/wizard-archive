import { useState } from 'react'
import { WikiLinkAutocomplete } from './wiki-link-autocomplete'
import { useLiveWikiLinkAutocompleteModelData } from './use-live-wiki-link-autocomplete-source'
import type { WikiLinkAutocompleteMenuState } from './wiki-link-autocomplete-source'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import type { RefObject } from 'react'

const CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU: WikiLinkAutocompleteMenuState = {
  show: false,
  query: '',
  pos: null,
}

export function LiveWikiLinkAutocomplete({
  editor,
  onForceOpenRef,
  sourceNoteId,
}: {
  editor: CustomBlockNoteEditor | undefined
  onForceOpenRef?: RefObject<(() => void) | null>
  sourceNoteId?: Id<'sidebarItems'>
}) {
  const [menu, setMenu] = useState<WikiLinkAutocompleteMenuState>(
    CLOSED_WIKI_LINK_AUTOCOMPLETE_MENU,
  )
  const modelData = useLiveWikiLinkAutocompleteModelData({ menu, sourceNoteId })

  return (
    <WikiLinkAutocomplete
      editor={editor}
      menu={menu}
      modelData={modelData}
      onForceOpenRef={onForceOpenRef}
      setMenu={setMenu}
      sourceNoteId={sourceNoteId}
    />
  )
}
