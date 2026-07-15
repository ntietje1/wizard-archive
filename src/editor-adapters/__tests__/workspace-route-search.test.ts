import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../shared/test/domain-id'
import {
  parseWorkspaceRouteSearchParams,
  validateSearch,
} from '~/editor-adapters/workspace-route-search'

const resourceId = testDomainId('resource', 'workspace-route')

describe('validateSearch', () => {
  it('accepts a resource UUID with an optional heading', () => {
    expect(validateSearch({ item: resourceId })).toEqual({ item: resourceId })
    expect(validateSearch({ item: resourceId, heading: '  intro  ' })).toEqual({
      item: resourceId,
      heading: 'intro',
    })
  })

  it('accepts trash only as a separate route mode', () => {
    expect(validateSearch({ trash: true })).toEqual({ trash: true })
    expect(validateSearch({ item: resourceId, trash: true })).toEqual({})
  })

  it('rejects slugs, malformed UUIDs, and headings without a resource', () => {
    expect(validateSearch({ item: 'my-note' })).toEqual({})
    expect(validateSearch({ item: resourceId.toUpperCase() })).toEqual({})
    expect(validateSearch({ heading: 'intro' })).toEqual({})
  })

  it('drops oversized headings', () => {
    expect(validateSearch({ item: resourceId, heading: 'h'.repeat(513) })).toEqual({
      item: resourceId,
    })
  })
})

describe('parseWorkspaceRouteSearchParams', () => {
  it('parses UUID resource routes', () => {
    const searchParams = new URLSearchParams({ item: resourceId, heading: 'Intro' })
    expect(parseWorkspaceRouteSearchParams(searchParams)).toEqual({
      item: resourceId,
      heading: 'Intro',
    })
  })

  it('rejects pre-cutover slug routes', () => {
    expect(parseWorkspaceRouteSearchParams(new URLSearchParams({ item: 'session-notes' }))).toEqual(
      {},
    )
  })
})
