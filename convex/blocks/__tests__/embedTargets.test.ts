import { describe, expect, it } from 'vitest'
import {
  deriveExternalEmbedName,
  embedTargetSchema,
  inferExternalEmbedMediaKind,
  normalizeEmbedTarget,
} from '../../../shared/embeds/embedTargets'

describe('embed targets', () => {
  it('accepts empty, resource, and external URL targets', () => {
    expect(embedTargetSchema.safeParse({ kind: 'empty' }).success).toBe(true)
    expect(embedTargetSchema.safeParse({ kind: 'resource', resourceId: 'item-id' }).success).toBe(
      true,
    )
    expect(
      embedTargetSchema.safeParse({
        kind: 'externalUrl',
        url: 'https://example.com/map.pdf',
        name: 'map.pdf',
      }).success,
    ).toBe(true)
  })

  it('rejects insecure or malformed external URLs', () => {
    expect(embedTargetSchema.safeParse({ kind: 'externalUrl', url: 'http://x.test' }).success).toBe(
      false,
    )
    expect(embedTargetSchema.safeParse({ kind: 'externalUrl', url: 'notaurl' }).success).toBe(false)
  })

  it('infers media type from extension only', () => {
    expect(inferExternalEmbedMediaKind('https://x.test/a.png')).toBe('image')
    expect(inferExternalEmbedMediaKind('https://x.test/a.webm?download=1')).toBe('video')
    expect(inferExternalEmbedMediaKind('https://x.test/a.mp3')).toBe('audio')
    expect(inferExternalEmbedMediaKind('https://x.test/a.pdf')).toBe('pdf')
    expect(inferExternalEmbedMediaKind('https://x.test/a')).toBe('unknown')
  })

  it('normalizes missing targets to empty', () => {
    expect(normalizeEmbedTarget(undefined)).toEqual({ kind: 'empty' })
    expect(normalizeEmbedTarget({ kind: 'empty' })).toEqual({ kind: 'empty' })
  })

  it('normalizes legacy sidebar item targets to resource targets', () => {
    expect(normalizeEmbedTarget({ kind: 'sidebarItem', sidebarItemId: 'item-id' })).toEqual({
      kind: 'resource',
      resourceId: 'item-id',
    })
  })

  it('derives a stable display name from an external URL', () => {
    expect(deriveExternalEmbedName('https://example.com/assets/Map%201.pdf?download=1')).toBe(
      'Map 1.pdf',
    )
    expect(deriveExternalEmbedName('https://example.com/')).toBe('example.com')
  })
})
