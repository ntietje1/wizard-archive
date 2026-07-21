import { SuggestionMenuController } from '@blocknote/react'
import type { ReactNode } from 'react'
import { resourceKindIcon } from '../../resources/workspace/resource-icon'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { NoteSuggestionMenu } from '../note-suggestion-menu'
import type { NoteSuggestionMenuItem } from '../note-suggestion-menu'
import { useNoteResourceRuntime } from '../use-note-resource-runtime'
import { resourceLinkInlineContent, resourceLinkSuggestions } from './resource-link-autocomplete'
import type { ResourceLinkSuggestion } from './resource-link-autocomplete'

type DisplayResourceLinkSuggestion = ResourceLinkSuggestion &
  NoteSuggestionMenuItem &
  Readonly<{ icon: ReactNode }>

export function NoteResourceLinkMenu({ editor }: { editor: NoteBlockNoteEditor }) {
  const surface = useNoteResourceRuntime()
  if (!surface.runtime || !surface.sourceResourceId) return null
  const runtime = surface.runtime
  const sourceResourceId = surface.sourceResourceId
  const getItems = (query: string): Promise<Array<DisplayResourceLinkSuggestion>> =>
    resourceLinkSuggestions(runtime, sourceResourceId, query)
      .then((suggestions) => suggestions.map(displaySuggestion))
      .catch(() => [])

  return (
    <SuggestionMenuController<typeof getItems>
      triggerCharacter="[["
      minQueryLength={0}
      getItems={getItems}
      suggestionMenuComponent={NoteSuggestionMenu}
      onItemClick={(suggestion) => insertResourceLink(editor, suggestion)}
    />
  )
}

function insertResourceLink(editor: NoteBlockNoteEditor, suggestion: ResourceLinkSuggestion) {
  editor.insertInlineContent([resourceLinkInlineContent(suggestion)], { updateSelection: true })
}

function displaySuggestion(suggestion: ResourceLinkSuggestion): DisplayResourceLinkSuggestion {
  const Icon = resourceKindIcon(suggestion.resource.kind)
  return { ...suggestion, icon: <Icon /> }
}
