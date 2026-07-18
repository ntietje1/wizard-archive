import { describe, expect, it } from 'vite-plus/test'
import { testDomainId } from '../../../shared/test/domain-id'
import {
  parseWorkspaceRouteSearchParams,
  validateSearch,
  workspaceRouteSearchForTarget,
  workspaceRouteTarget,
} from '~/editor-adapters/workspace-route-search'

const resourceId = testDomainId('resource', 'workspace-route')
const blockId = testDomainId('noteBlock', 'workspace-route-block')
const pinId = testDomainId('mapPin', 'workspace-route-pin')
const nodeId = testDomainId('canvasNode', 'workspace-route-node')

describe('validateSearch', () => {
  it('accepts a resource UUID and finite canonical subresource targets', () => {
    expect(validateSearch({ resource: resourceId })).toEqual({ resource: resourceId })
    expect(
      validateSearch({
        resource: resourceId,
        target: 'noteBlock',
        targetId: blockId,
        presentation: 'heading',
      }),
    ).toEqual({
      resource: resourceId,
      target: 'noteBlock',
      targetId: blockId,
      presentation: 'heading',
    })
    expect(validateSearch({ resource: resourceId, target: 'mapPin', targetId: pinId })).toEqual({
      resource: resourceId,
      target: 'mapPin',
      targetId: pinId,
    })
    expect(
      validateSearch({ resource: resourceId, target: 'canvasNode', targetId: nodeId }),
    ).toEqual({
      resource: resourceId,
      target: 'canvasNode',
      targetId: nodeId,
    })
  })

  it('accepts trash only as a separate route mode', () => {
    expect(validateSearch({ trash: true })).toEqual({ trash: true })
    expect(validateSearch({ resource: resourceId, trash: true })).toEqual({})
  })

  it('rejects slugs and malformed UUIDs and drops invalid focus fields', () => {
    expect(validateSearch({ resource: 'my-note' })).toEqual({})
    expect(validateSearch({ resource: resourceId.toUpperCase() })).toEqual({})
    expect(validateSearch({ target: 'noteBlock', targetId: blockId })).toEqual({})
    expect(
      validateSearch({ resource: resourceId, target: 'noteBlock', targetId: blockId }),
    ).toEqual({
      resource: resourceId,
    })
    expect(
      validateSearch({ resource: resourceId, target: 'mapPin', targetId: 'not-a-uuid' }),
    ).toEqual({
      resource: resourceId,
    })
  })
})

describe('parseWorkspaceRouteSearchParams', () => {
  it('parses stable UUID targets and round-trips canonical targets', () => {
    const searchParams = new URLSearchParams({
      resource: resourceId,
      target: 'noteBlock',
      targetId: blockId,
      presentation: 'heading',
    })
    expect(parseWorkspaceRouteSearchParams(searchParams)).toEqual({
      resource: resourceId,
      target: 'noteBlock',
      targetId: blockId,
      presentation: 'heading',
    })
    const target = {
      kind: 'canvasNode' as const,
      resourceId,
      nodeId,
    }
    expect(workspaceRouteTarget(workspaceRouteSearchForTarget(target))).toEqual(target)
  })

  it('rejects non-UUID resource routes', () => {
    expect(
      parseWorkspaceRouteSearchParams(new URLSearchParams({ resource: 'session-notes' })),
    ).toEqual({})
  })
})
