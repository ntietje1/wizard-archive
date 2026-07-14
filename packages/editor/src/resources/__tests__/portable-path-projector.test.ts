import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { ResourceId } from '../domain-id'
import {
  MAX_RELATIVE_PATH_UTF8_BYTES,
  MAX_SEGMENT_UTF8_BYTES,
  PORTABLE_PATH_VERSION,
} from '../portable-path-contract'
import type { PortablePathResource } from '../portable-path-contract'
import { projectPortablePaths } from '../portable-path-projector'
import { canonicalizeResourceTitle } from '../resource-record'

const ROOT_ID = asResourceId('01890f47-f6c8-7a5b-8c9d-0123456789ab')
const CHILD_ID = asResourceId('01890f48-f6c8-7a5b-8c9d-0123456789ab')
const TRASH_ID = asResourceId('01890f49-f6c8-7a5b-8c9d-0123456789ab')

describe('portable-path-v1 projector', () => {
  it('projects explicit package, nested, and reserved trash placement', () => {
    const projection = projectPortablePaths([
      resource(ROOT_ID, 'Campaign', 'folder', null, { parent: 'packageRoot' }),
      resource(CHILD_ID, 'Session / Notes', 'note', 'md', {
        parent: 'resource',
        parentId: ROOT_ID,
      }),
      resource(TRASH_ID, 'Old Map', 'map', 'wizardmap', { parent: 'trashRoot' }),
    ])

    expect(projection.version).toBe(PORTABLE_PATH_VERSION)
    expect(entryPath(projection, ROOT_ID)).toBe('Campaign')
    expect(entryPath(projection, CHILD_ID)).toBe('Campaign/Session-Notes.md')
    expect(entryPath(projection, TRASH_ID)).toBe('.wizardarchive/trashed/Old Map.wizardmap')
    expect(projection.warnings).toContainEqual({ resourceId: CHILD_ID, code: 'sanitized' })
    expect(projection.failures).toEqual([])
  })

  it('handles empty names, Windows devices, and scalar-safe segment truncation', () => {
    const emptyId = asResourceId('01890f50-f6c8-7a5b-8c9d-0123456789ab')
    const deviceId = asResourceId('01890f51-f6c8-7a5b-8c9d-0123456789ab')
    const longId = asResourceId('01890f52-f6c8-7a5b-8c9d-0123456789ab')
    const projection = projectPortablePaths([
      resource(emptyId, '...', 'folder', null, { parent: 'packageRoot' }),
      resource(deviceId, 'CON', 'file', 'txt', { parent: 'packageRoot' }),
      resource(longId, '😀'.repeat(200), 'file', 'bin', { parent: 'packageRoot' }),
    ])

    expect(entryPath(projection, emptyId)).toBe('Untitled')
    expect(entryPath(projection, deviceId)).toBe('_CON.txt')
    expect(new TextEncoder().encode(entryPath(projection, longId)).byteLength).toBeLessThanOrEqual(
      MAX_SEGMENT_UTF8_BYTES,
    )
    expect(entryPath(projection, longId).endsWith('.bin')).toBe(true)
    expect(projection.warnings).toContainEqual({ resourceId: longId, code: 'truncated' })
  })

  it('suffixes every NFKC/case collision and extends shared UUID prefixes', () => {
    const leftId = asResourceId('01890f47-f6c8-7a5b-8c9d-1123456789ab')
    const rightId = asResourceId('01890f47-f6c8-7a5b-8c9d-2123456789ab')
    const projection = projectPortablePaths([
      resource(leftId, 'Ａ', 'note', 'md', { parent: 'packageRoot' }),
      resource(rightId, 'a', 'note', 'md', { parent: 'packageRoot' }),
    ])
    const leftPath = entryPath(projection, leftId)
    const rightPath = entryPath(projection, rightId)

    expect(leftPath).not.toBe(rightPath)
    expect(leftPath).toMatch(/--01890f47f6c87a5b8c9d[12]\.md$/)
    expect(rightPath).toMatch(/--01890f47f6c87a5b8c9d[12]\.md$/)
    expect(projection.warnings.filter(({ code }) => code === 'collision_suffixed')).toHaveLength(2)
  })

  it('is order independent and keeps collisions scoped to explicit siblings', () => {
    const nestedId = asResourceId('01890f53-f6c8-7a5b-8c9d-0123456789ab')
    const input = [
      resource(ROOT_ID, 'Root', 'folder', null, { parent: 'packageRoot' }),
      resource(CHILD_ID, 'Same', 'note', 'md', { parent: 'packageRoot' }),
      resource(nestedId, 'Same', 'note', 'md', { parent: 'resource', parentId: ROOT_ID }),
    ] as const

    expect(projectPortablePaths(input)).toEqual(projectPortablePaths([...input].reverse()))
    expect(entryPath(projectPortablePaths(input), CHILD_ID)).toBe('Same.md')
    expect(entryPath(projectPortablePaths(input), nestedId)).toBe('Root/Same.md')
  })

  it('rejects invalid extensions, reserved placement, hierarchy gaps, and cycles', () => {
    const invalidExtensionId = asResourceId('01890f54-f6c8-7a5b-8c9d-0123456789ab')
    const reservedId = asResourceId('01890f55-f6c8-7a5b-8c9d-0123456789ab')
    const missingParentId = asResourceId('01890f56-f6c8-7a5b-8c9d-0123456789ab')
    const cycleA = asResourceId('01890f57-f6c8-7a5b-8c9d-0123456789ab')
    const cycleB = asResourceId('01890f58-f6c8-7a5b-8c9d-0123456789ab')
    const projection = projectPortablePaths([
      resource(invalidExtensionId, 'Note', 'note', 'txt', { parent: 'packageRoot' }),
      resource(reservedId, '.wizardarchive', 'folder', null, { parent: 'packageRoot' }),
      resource(ROOT_ID, 'Orphan', 'folder', null, {
        parent: 'resource',
        parentId: missingParentId,
      }),
      resource(cycleA, 'A', 'folder', null, { parent: 'resource', parentId: cycleB }),
      resource(cycleB, 'B', 'folder', null, { parent: 'resource', parentId: cycleA }),
    ])

    expect(projection.entries).toEqual([])
    expect(projection.failures).toEqual(
      expect.arrayContaining([
        { resourceId: invalidExtensionId, code: 'invalid_input' },
        { resourceId: reservedId, code: 'invalid_placement' },
        { resourceId: ROOT_ID, code: 'invalid_placement' },
        { resourceId: cycleA, code: 'invalid_placement' },
        { resourceId: cycleB, code: 'invalid_placement' },
      ]),
    )
  })

  it('rejects malformed Unicode and paths beyond the total UTF-8 limit', () => {
    const malformedId = asResourceId('01890f59-f6c8-7a5b-8c9d-0123456789ab')
    const chain = Array.from({ length: 5 }, (_, index) => {
      const id = asResourceId(`01890f6${index}-f6c8-7a5b-8c9d-0123456789ab`)
      const parentId =
        index === 0 ? null : asResourceId(`01890f6${index - 1}-f6c8-7a5b-8c9d-0123456789ab`)
      return resource(
        id,
        'x'.repeat(255),
        'folder',
        null,
        parentId === null ? { parent: 'packageRoot' } : { parent: 'resource', parentId },
      )
    })
    const malformed = {
      ...resource(malformedId, 'valid', 'folder', null, { parent: 'packageRoot' }),
      title: '\ud800',
    } as unknown as PortablePathResource
    const projection = projectPortablePaths([malformed, ...chain])

    expect(projection.failures).toContainEqual({ resourceId: malformedId, code: 'invalid_input' })
    const deepestId = chain.at(-1)!.resourceId
    expect(projection.failures).toContainEqual({
      resourceId: deepestId,
      code: 'relative_path_too_long',
    })
    expect(
      new TextEncoder().encode(entryPath(projection, chain.at(-2)!.resourceId)).byteLength,
    ).toBeLessThanOrEqual(MAX_RELATIVE_PATH_UTF8_BYTES)
  })
})

function asResourceId(value: string): ResourceId {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function resource(
  id: ResourceId,
  title: string,
  kind: PortablePathResource['kind'],
  extension: string | null,
  placement: PortablePathResource['placement'],
): PortablePathResource {
  return { resourceId: id, title: canonicalizeResourceTitle(title), kind, extension, placement }
}

function entryPath(projection: ReturnType<typeof projectPortablePaths>, id: ResourceId): string {
  const entry = projection.entries.find((candidate) => candidate.resourceId === id)
  if (!entry) throw new Error(`Missing projected path for ${id}`)
  return entry.path
}
