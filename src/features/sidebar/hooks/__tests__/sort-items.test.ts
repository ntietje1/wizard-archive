import { describe, expect, it } from 'vitest'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { sortItemsByOptions } from '~/features/sidebar/hooks/useSidebarItems'
import { createNote } from '~/test/factories/sidebar-item-factory'

const noteA = createNote({
  name: 'Alpha',
  _creationTime: 1000,
  updatedTime: 3000,
})
const noteB = createNote({
  name: 'Beta',
  _creationTime: 2000,
  updatedTime: 1000,
})
const noteC = createNote({
  name: 'Charlie',
  _creationTime: 3000,
  updatedTime: 2000,
})
const items = [noteB, noteC, noteA]

describe('sortItemsByOptions', () => {
  it('returns undefined for undefined items', () => {
    expect(
      sortItemsByOptions({
        order: SORT_ORDERS.Alphabetical,
        direction: SORT_DIRECTIONS.Ascending,
      }),
    ).toBeUndefined()
  })

  it('sorts alphabetically ascending', () => {
    const result = sortItemsByOptions(
      { order: SORT_ORDERS.Alphabetical, direction: SORT_DIRECTIONS.Ascending },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Charlie'])
  })

  it('sorts alphabetically descending', () => {
    const result = sortItemsByOptions(
      {
        order: SORT_ORDERS.Alphabetical,
        direction: SORT_DIRECTIONS.Descending,
      },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Charlie', 'Beta', 'Alpha'])
  })

  it('sorts by date created ascending', () => {
    const result = sortItemsByOptions(
      { order: SORT_ORDERS.DateCreated, direction: SORT_DIRECTIONS.Ascending },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Charlie'])
  })

  it('sorts by date created descending', () => {
    const result = sortItemsByOptions(
      { order: SORT_ORDERS.DateCreated, direction: SORT_DIRECTIONS.Descending },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Charlie', 'Beta', 'Alpha'])
  })

  it('sorts by date modified ascending', () => {
    const result = sortItemsByOptions(
      { order: SORT_ORDERS.DateModified, direction: SORT_DIRECTIONS.Ascending },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Beta', 'Charlie', 'Alpha'])
  })

  it('sorts by date modified descending', () => {
    const result = sortItemsByOptions(
      {
        order: SORT_ORDERS.DateModified,
        direction: SORT_DIRECTIONS.Descending,
      },
      items,
    )!
    expect(result.map((i) => i.name)).toEqual(['Alpha', 'Charlie', 'Beta'])
  })

  it('does not mutate the original array', () => {
    const original = [...items]
    sortItemsByOptions(
      { order: SORT_ORDERS.Alphabetical, direction: SORT_DIRECTIONS.Ascending },
      items,
    )
    expect(items).toEqual(original)
  })

  it('DateModified falls back to _creationTime when updatedTime is null', () => {
    const noUpdate = createNote({
      name: 'NoUpdate',
      _creationTime: 5000,
      updatedTime: null,
    })
    const withUpdate = createNote({
      name: 'WithUpdate',
      _creationTime: 1000,
      updatedTime: 3000,
    })
    const result = sortItemsByOptions(
      {
        order: SORT_ORDERS.DateModified,
        direction: SORT_DIRECTIONS.Descending,
      },
      [withUpdate, noUpdate],
    )!
    expect(result[0].name).toBe('NoUpdate')
    expect(result[1].name).toBe('WithUpdate')
  })

  it('returns empty array for empty input', () => {
    const result = sortItemsByOptions(
      { order: SORT_ORDERS.Alphabetical, direction: SORT_DIRECTIONS.Ascending },
      [],
    )!
    expect(result).toEqual([])
  })
})
