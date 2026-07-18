import type { ResourceKnowledge } from '@wizard-archive/editor/resources/index-contract'
import { createLivePresentationSubscriptions } from './live-presentation-subscriptions'

const UNKNOWN_PRESENTATION = { state: 'unknown' } as const

type PresentationPage<T> = Readonly<{
  presentation: T | null
  cursor: string | null
}>

type LoadedPage<T> = {
  cursor: string | null
  nextCursor: string | null
  presentation: T | null | undefined
  dispose: () => void
}

export function createLivePaginatedPresentationStore<TId, TPage, TPresentation>(
  watch:
    | ((
        id: TId,
        cursor: string | null,
        apply: (page: PresentationPage<TPage>) => void,
      ) => () => void)
    | null,
  merge: (pages: ReadonlyArray<TPage>, complete: boolean) => TPresentation,
) {
  const presentations = new Map<TId, ResourceKnowledge<TPresentation>>()
  const pages = new Map<TId, Array<LoadedPage<TPage>>>()

  const publish = (id: TId) => {
    const loaded = pages.get(id) ?? []
    if (loaded.length === 0 || loaded[0]!.presentation === undefined) return
    const values = loaded.flatMap((page) => (page.presentation ? [page.presentation] : []))
    presentations.set(
      id,
      loaded[0]!.presentation === null
        ? { state: 'missing' }
        : {
            state: 'known',
            value: merge(values, loaded.at(-1)?.nextCursor === null),
          },
    )
    subscriptions.publish(id)
  }

  const start = (id: TId, cursor: string | null) => {
    if (!watch || !subscriptions.has(id)) return
    const loaded = pages.get(id) ?? []
    if (loaded.some((page) => page.cursor === cursor)) return
    const page: LoadedPage<TPage> = {
      cursor,
      nextCursor: cursor,
      presentation: undefined,
      dispose: () => undefined,
    }
    loaded.push(page)
    pages.set(id, loaded)
    page.dispose = watch(id, cursor, (value) => {
      const index = loaded.indexOf(page)
      if (index < 0) return
      if (page.nextCursor !== value.cursor) {
        for (const stale of loaded.splice(index + 1)) stale.dispose()
      }
      page.nextCursor = value.cursor
      page.presentation = value.presentation
      publish(id)
    })
  }

  const release = (id: TId) => {
    for (const page of pages.get(id) ?? []) page.dispose()
    pages.delete(id)
    presentations.delete(id)
  }
  const subscriptions = createLivePresentationSubscriptions((id) => start(id, null), release)

  return {
    get: (id: TId): ResourceKnowledge<TPresentation> =>
      presentations.get(id) ?? UNKNOWN_PRESENTATION,
    load: (id: TId) => start(id, null),
    loadMore: (id: TId) => {
      const last = pages.get(id)?.at(-1)
      if (last?.presentation && last.nextCursor !== null) start(id, last.nextCursor)
    },
    subscribe: subscriptions.subscribe,
    dispose: () => {
      for (const id of pages.keys()) release(id)
      subscriptions.clear()
    },
  }
}
