import type { NoteSessionSource, NoteSessionState } from '../../resources/content-session-contract'
import type { ResourceId } from '../../resources/domain-id'
import type { EditorRuntime } from '../../resources/editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../../resources/resource-index-contract'
import type { WorkspaceSearchResult } from '../../resources/resource-search-policy'
import type { CanonicalTarget } from '../../resources/authored-destination-contract'
import { serializeAuthoredDestination } from '../../resources/authored-destination'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../document/headless-yjs'
import { noteDocumentOutline } from '../document/outline'

const RESOURCE_SUGGESTION_LIMIT = 10
const HEADING_NOTE_LIMIT = 10
const HEADING_SUGGESTION_LIMIT = 10

type ResourceLinkAutocompleteQuery =
  | Readonly<{ mode: 'resource'; resourceQuery: string }>
  | Readonly<{ mode: 'heading'; resourceQuery: string; headingQuery: string }>

export type ResourceLinkSuggestion = Readonly<{
  key: string
  label: string
  resource: AuthorizedResourceSummary
  subtext: string
  target: CanonicalTarget
  title: string
}>

function parseResourceLinkAutocompleteQuery(
  controllerQuery: string,
): ResourceLinkAutocompleteQuery | null {
  if (!controllerQuery.startsWith('[')) return null
  const query = controllerQuery.slice(1)
  const headingSeparator = query.indexOf('#')
  if (headingSeparator < 0) return { mode: 'resource', resourceQuery: query.trim() }
  const headingQuerySeparator = query.lastIndexOf('#')
  return {
    mode: 'heading',
    resourceQuery: query.slice(0, headingSeparator).trim(),
    headingQuery: query.slice(headingQuerySeparator + 1).trim(),
  }
}

export async function resourceLinkSuggestions(
  runtime: EditorRuntime,
  sourceResourceId: ResourceId,
  controllerQuery: string,
): Promise<ReadonlyArray<ResourceLinkSuggestion>> {
  const query = parseResourceLinkAutocompleteQuery(controllerQuery)
  if (!query || runtime.search.status !== 'available') return []
  const search = runtime.search.value
  const results = query.resourceQuery
    ? (await search.search(query.resourceQuery)).results
    : await emptyQueryResults(runtime, search.recent(), sourceResourceId, query.mode)
  const resources = await loadKnownResources(runtime, results)
  return query.mode === 'resource'
    ? resources.slice(0, RESOURCE_SUGGESTION_LIMIT).map(resourceSuggestion)
    : headingSuggestions(runtime.content.notes, resources, query.headingQuery)
}

export function resourceLinkInlineContent(suggestion: ResourceLinkSuggestion) {
  return {
    type: 'resourceLink' as const,
    props: {
      destination: serializeAuthoredDestination({
        kind: 'internal',
        target: suggestion.target,
      }),
      label: suggestion.label,
    },
  }
}

async function emptyQueryResults(
  runtime: EditorRuntime,
  recent: ReadonlyArray<ResourceId>,
  sourceResourceId: ResourceId,
  mode: ResourceLinkAutocompleteQuery['mode'],
): Promise<ReadonlyArray<WorkspaceSearchResult>> {
  if (mode === 'heading') {
    return [{ resourceId: sourceResourceId, match: { type: 'title' } }]
  }
  await runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
  const root = runtime.resources.index.getSnapshot().list({ parentId: null, lifecycle: 'active' })
  const rootIds = root.state === 'known' ? root.items.map(({ id }) => id) : []
  const ids = Array.from(new Set([...recent, ...rootIds]))
  return ids.map((resourceId) => ({ resourceId, match: { type: 'title' } }))
}

async function loadKnownResources(
  runtime: EditorRuntime,
  results: ReadonlyArray<WorkspaceSearchResult>,
) {
  const limited = results.slice(0, RESOURCE_SUGGESTION_LIMIT)
  await Promise.all(
    limited.map((result) => runtime.resources.loader.ensureResource(result.resourceId)),
  )
  const snapshot = runtime.resources.index.getSnapshot()
  return limited.flatMap((result) => {
    const knowledge = snapshot.lookup(result.resourceId)
    return knowledge.state === 'known' && knowledge.value.lifecycle === 'active'
      ? [{ resource: knowledge.value, result }]
      : []
  })
}

function resourceSuggestion({
  resource,
  result,
}: {
  resource: AuthorizedResourceSummary
  result: WorkspaceSearchResult
}): ResourceLinkSuggestion {
  return {
    key: resource.id,
    label: resource.title,
    resource,
    subtext: result.match.type === 'body' ? result.match.text : resourceContext(resource),
    target: { kind: 'resource', resourceId: resource.id },
    title: resource.title,
  }
}

async function headingSuggestions(
  source: NoteSessionSource,
  resources: ReadonlyArray<{
    resource: AuthorizedResourceSummary
    result: WorkspaceSearchResult
  }>,
  headingQuery: string,
): Promise<ReadonlyArray<ResourceLinkSuggestion>> {
  const candidates = resources
    .filter(({ resource }) => resource.kind === 'note')
    .slice(0, HEADING_NOTE_LIMIT)
  const loaded = await Promise.all(
    candidates.map(async ({ resource }) => ({
      resource,
      headings: await loadNoteHeadings(source, resource.id),
    })),
  )
  const normalizedQuery = headingQuery.toLocaleLowerCase()
  return loaded
    .flatMap(({ resource, headings }) =>
      headingPaths(headings)
        .filter(({ heading }) => heading.text.toLocaleLowerCase().includes(normalizedQuery))
        .map(({ heading, path }) => ({
          key: `${resource.id}:${heading.blockId}`,
          label: `${resource.title} › ${path.join(' › ')}`,
          resource,
          subtext: resourceContext(resource),
          target: {
            kind: 'noteBlock' as const,
            resourceId: resource.id,
            blockId: heading.blockId,
            presentation: 'heading' as const,
          },
          title: heading.text,
        })),
    )
    .slice(0, HEADING_SUGGESTION_LIMIT)
}

function headingPaths(headings: ReturnType<typeof noteDocumentOutline>) {
  const parents: Array<{ level: number; text: string }> = []
  return headings.map((heading) => {
    while (parents.length > 0 && parents.at(-1)!.level >= heading.level) parents.pop()
    const path = [...parents.map(({ text }) => text), heading.text]
    parents.push({ level: heading.level, text: heading.text })
    return { heading, path }
  })
}

function loadNoteHeadings(source: NoteSessionSource, resourceId: ResourceId) {
  const current = source.get(resourceId)
  if (current.status !== 'loading') return Promise.resolve(headingsFromState(current))
  return new Promise<ReturnType<typeof noteDocumentOutline>>((resolve) => {
    let unsubscribe: () => void = () => undefined
    const settle = () => {
      const state = source.get(resourceId)
      if (state.status === 'loading') return
      unsubscribe()
      resolve(headingsFromState(state))
    }
    unsubscribe = source.subscribe(resourceId, settle)
    settle()
  })
}

function headingsFromState(state: NoteSessionState) {
  const document =
    state.status === 'ready'
      ? state.session.document
      : state.status === 'initializing'
        ? state.local
        : null
  if (!document) return []
  try {
    return noteDocumentOutline(noteYDocToBlocks(document, NOTE_YJS_FRAGMENT))
  } catch {
    return []
  }
}

function resourceContext(resource: AuthorizedResourceSummary) {
  return `${resourceKindLabel(resource.kind)} · ${resource.id.slice(-8)}`
}

function resourceKindLabel(kind: AuthorizedResourceSummary['kind']) {
  return kind[0]!.toLocaleUpperCase() + kind.slice(1)
}
