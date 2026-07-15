import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../shared/test/domain-id'
import {
  parseWorkspaceRouteSearchParams,
  validateSearch,
} from '~/editor-adapters/workspace-route-search'

const resourceId = testDomainId('resource', 'workspace-route')

describe('validateSearch', () => {
  it('accepts a resource UUID with an optional heading', () => {
    expect(validateSearch({ resource: resourceId })).toEqual({ resource: resourceId })
    expect(validateSearch({ resource: resourceId, heading: '  intro  ' })).toEqual({
      resource: resourceId,
      heading: 'intro',
    })
  })

  it('accepts trash only as a separate route mode', () => {
    expect(validateSearch({ trash: true })).toEqual({ trash: true })
    expect(validateSearch({ resource: resourceId, trash: true })).toEqual({})
  })

  it('rejects slugs, malformed UUIDs, and headings without a resource', () => {
    expect(validateSearch({ resource: 'my-note' })).toEqual({})
    expect(validateSearch({ resource: resourceId.toUpperCase() })).toEqual({})
    expect(validateSearch({ heading: 'intro' })).toEqual({})
  })

  it('drops oversized headings', () => {
    expect(validateSearch({ resource: resourceId, heading: 'h'.repeat(513) })).toEqual({
      resource: resourceId,
    })
  })
})

describe('parseWorkspaceRouteSearchParams', () => {
  it('parses UUID resource routes', () => {
    const searchParams = new URLSearchParams({ resource: resourceId, heading: 'Intro' })
    expect(parseWorkspaceRouteSearchParams(searchParams)).toEqual({
      resource: resourceId,
      heading: 'Intro',
    })
  })

  it('rejects pre-cutover slug routes', () => {
    expect(
      parseWorkspaceRouteSearchParams(new URLSearchParams({ resource: 'session-notes' })),
    ).toEqual({})
  })
})
