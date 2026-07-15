import { isUuidV7 } from './domain-id'
import type { ResourceId } from './domain-id'
import {
  INITIAL_UUID_SUFFIX_LENGTH,
  MAX_RELATIVE_PATH_UTF8_BYTES,
  MAX_SEGMENT_UTF8_BYTES,
  PORTABLE_PATH_VERSION,
} from './portable-path-contract'
import type {
  PortablePathEntry,
  PortablePathFailure,
  PortablePathProjection,
  PortablePathResource,
  PortablePathWarning,
  PortableRelativePath,
} from './portable-path-contract'
import { hasUnpairedUtf16 } from './well-formed-unicode'

const RESERVED_PACKAGE_ROOT = '.wizardarchive'
const TRASH_ROOT = `${RESERVED_PACKAGE_ROOT}/trashed`
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const FORBIDDEN_OR_WHITESPACE_RUN = /(?:[\p{Cc}<>:"/\\|?*]|\s)+/gu
const FORBIDDEN_CHARACTER = /[\p{Cc}<>:"/\\|?*]/u
const VALID_FILE_EXTENSION = /^[a-z0-9][a-z0-9._-]*$/
const encoder = new TextEncoder()

type ProjectedResource = {
  readonly resource: PortablePathResource
  readonly baseName: string
  readonly extension: string
  segment: string
}

type WarningCode = PortablePathWarning['code']

export function projectPortablePaths(
  resources: ReadonlyArray<PortablePathResource>,
): PortablePathProjection {
  const failures: Array<PortablePathFailure> = []
  const warningCodes = new Map<ResourceId, Set<WarningCode>>()
  const resourcesById = new Map<ResourceId, PortablePathResource>()
  const invalidResourceIds = new Set<ResourceId>()

  for (const resource of resources) {
    if (!isUuidV7(resource.resourceId) || resourcesById.has(resource.resourceId)) {
      invalidResourceIds.add(resource.resourceId)
      failures.push({ resourceId: resource.resourceId, code: 'invalid_input' })
      continue
    }
    resourcesById.set(resource.resourceId, resource)
  }

  const projected: Array<ProjectedResource> = []
  for (const resource of resources) {
    if (invalidResourceIds.has(resource.resourceId)) continue
    const candidate = projectSegment(resource, warningCodes, failures)
    if (candidate) projected.push(candidate)
  }

  const projectedById = new Map(
    projected.map((resource) => [resource.resource.resourceId, resource]),
  )
  const siblingGroups = groupBy(projected, (resource) => placementKey(resource.resource))
  for (const siblings of siblingGroups.values()) {
    resolveSiblingCollisions(siblings, warningCodes)
  }

  const entries: Array<PortablePathEntry> = []
  const paths = new Map<ResourceId, PortableRelativePath | null>()
  const visiting = new Set<ResourceId>()

  const resolvePath = (resourceId: ResourceId): PortableRelativePath | null => {
    const cached = paths.get(resourceId)
    if (cached !== undefined) return cached
    const projectedResource = projectedById.get(resourceId)
    if (!projectedResource) return null
    if (visiting.has(resourceId)) {
      failOnce(failures, resourceId, 'invalid_placement')
      paths.set(resourceId, null)
      return null
    }

    visiting.add(resourceId)
    const { placement } = projectedResource.resource
    let parentPath: string | null
    switch (placement.parent) {
      case 'packageRoot':
        parentPath = ''
        break
      case 'trashRoot':
        parentPath = TRASH_ROOT
        break
      case 'resource':
        parentPath = resolvePath(placement.parentId)
        break
    }
    visiting.delete(resourceId)

    if (
      parentPath === null ||
      (placement.parent === 'resource' && placement.parentId === resourceId)
    ) {
      failOnce(failures, resourceId, 'invalid_placement')
      paths.set(resourceId, null)
      return null
    }

    const path = `${parentPath ? `${parentPath}/` : ''}${projectedResource.segment}`
    if (utf8Length(path) > MAX_RELATIVE_PATH_UTF8_BYTES) {
      failOnce(failures, resourceId, 'relative_path_too_long')
      paths.set(resourceId, null)
      return null
    }
    const portablePath = path as PortableRelativePath
    paths.set(resourceId, portablePath)
    return portablePath
  }

  for (const resource of [...projected].sort(byResourceId)) {
    const path = resolvePath(resource.resource.resourceId)
    if (path !== null) entries.push({ resourceId: resource.resource.resourceId, path })
  }

  return {
    version: PORTABLE_PATH_VERSION,
    entries,
    warnings: Array.from(warningCodes.entries())
      .flatMap(([resourceId, codes]) =>
        Array.from(codes, (code) => ({ resourceId, code }) satisfies PortablePathWarning),
      )
      .sort(compareWarning),
    failures: [...failures].sort(compareFailure),
  }
}

function projectSegment(
  resource: PortablePathResource,
  warningCodes: Map<ResourceId, Set<WarningCode>>,
  failures: Array<PortablePathFailure>,
): ProjectedResource | null {
  if (hasUnpairedUtf16(resource.title) || !isValidExtension(resource)) {
    failures.push({ resourceId: resource.resourceId, code: 'invalid_input' })
    return null
  }

  const naturalTitle = resource.title.normalize('NFC')
  if (
    resource.placement.parent === 'packageRoot' &&
    collisionKey(naturalTitle) === RESERVED_PACKAGE_ROOT
  ) {
    failures.push({ resourceId: resource.resourceId, code: 'invalid_placement' })
    return null
  }
  let baseName = naturalTitle
    .replace(FORBIDDEN_OR_WHITESPACE_RUN, (run) => (FORBIDDEN_CHARACTER.test(run) ? '-' : ' '))
    .replace(/^[ .]+|[ .]+$/gu, '')
  if (baseName !== naturalTitle) addWarning(warningCodes, resource.resourceId, 'sanitized')
  if (baseName.length === 0) {
    baseName = 'Untitled'
    addWarning(warningCodes, resource.resourceId, 'sanitized')
  }
  if (WINDOWS_DEVICE_NAME.test(baseName)) {
    baseName = `_${baseName}`
    addWarning(warningCodes, resource.resourceId, 'reserved_name_prefixed')
  }

  const extension = resource.extension === null ? '' : `.${resource.extension}`
  const availableBytes = MAX_SEGMENT_UTF8_BYTES - utf8Length(extension)
  const truncatedBase = truncateUtf8(baseName, availableBytes)
  if (truncatedBase !== baseName) addWarning(warningCodes, resource.resourceId, 'truncated')
  baseName = truncatedBase || 'Untitled'
  const segment = `${baseName}${extension}`
  if (
    resource.placement.parent === 'packageRoot' &&
    collisionKey(segment) === RESERVED_PACKAGE_ROOT
  ) {
    failures.push({ resourceId: resource.resourceId, code: 'invalid_placement' })
    return null
  }

  return { resource, baseName, extension, segment }
}

// Collision resolution deliberately converges in one loop while extending only colliding IDs.
// fallow-ignore-next-line complexity
function resolveSiblingCollisions(
  siblings: ReadonlyArray<ProjectedResource>,
  warningCodes: Map<ResourceId, Set<WarningCode>>,
): void {
  const collidingIds = new Set<ResourceId>()
  for (const group of groupBy(siblings, (resource) => collisionKey(resource.segment)).values()) {
    if (group.length > 1)
      for (const resource of group) collidingIds.add(resource.resource.resourceId)
  }
  if (collidingIds.size === 0) return

  const suffixLengths = new Map<ResourceId, number>()
  for (const resourceId of collidingIds) suffixLengths.set(resourceId, INITIAL_UUID_SUFFIX_LENGTH)

  while (true) {
    for (const resource of siblings) {
      const suffixLength = suffixLengths.get(resource.resource.resourceId)
      resource.segment = segmentWithSuffix(resource, suffixLength)
    }
    const collisions = Array.from(
      groupBy(siblings, (resource) => collisionKey(resource.segment)).values(),
    ).filter((group) => group.length > 1)
    if (collisions.length === 0) break

    let extended = false
    for (const group of collisions) {
      for (const resource of group) {
        const resourceId = resource.resource.resourceId
        const currentLength = suffixLengths.get(resourceId)
        if (currentLength === undefined) {
          suffixLengths.set(resourceId, INITIAL_UUID_SUFFIX_LENGTH)
          extended = true
        } else if (currentLength < 32) {
          suffixLengths.set(resourceId, currentLength + 1)
          extended = true
        }
      }
    }
    if (!extended) throw new TypeError('Portable path collision could not be resolved')
  }

  const siblingById = new Map(siblings.map((resource) => [resource.resource.resourceId, resource]))
  for (const resourceId of suffixLengths.keys()) {
    addWarning(warningCodes, resourceId, 'collision_suffixed')
    const resource = siblingById.get(resourceId)!
    const suffixLength = suffixLengths.get(resourceId)!
    const suffixBytes = utf8Length(`--${resourceId.replaceAll('-', '').slice(0, suffixLength)}`)
    const availableBytes = MAX_SEGMENT_UTF8_BYTES - utf8Length(resource.extension) - suffixBytes
    if (utf8Length(resource.baseName) > availableBytes) {
      addWarning(warningCodes, resourceId, 'truncated')
    }
  }
}

function segmentWithSuffix(resource: ProjectedResource, suffixLength: number | undefined): string {
  if (suffixLength === undefined) return `${resource.baseName}${resource.extension}`
  const suffix = `--${resource.resource.resourceId.replaceAll('-', '').slice(0, suffixLength)}`
  const availableBytes =
    MAX_SEGMENT_UTF8_BYTES - utf8Length(resource.extension) - utf8Length(suffix)
  return `${truncateUtf8(resource.baseName, availableBytes)}${suffix}${resource.extension}`
}

function isValidExtension(resource: PortablePathResource): boolean {
  if (
    resource.extension !== null &&
    utf8Length(`.${resource.extension}`) >= MAX_SEGMENT_UTF8_BYTES
  ) {
    return false
  }
  switch (resource.kind) {
    case 'folder':
      return resource.extension === null
    case 'note':
      return resource.extension === 'md'
    case 'map':
      return resource.extension === 'wizardmap'
    case 'canvas':
      return resource.extension === 'wizardcanvas'
    case 'file':
      return resource.extension === null || VALID_FILE_EXTENSION.test(resource.extension)
  }
}

function placementKey(resource: PortablePathResource): string {
  switch (resource.placement.parent) {
    case 'packageRoot':
      return 'packageRoot'
    case 'trashRoot':
      return 'trashRoot'
    case 'resource':
      return `resource:${resource.placement.parentId}`
  }
}

function collisionKey(segment: string): string {
  return segment
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ .]+$/gu, '')
}

function truncateUtf8(value: string, maximumBytes: number): string {
  let bytes = 0
  let result = ''
  for (const scalar of value) {
    const scalarBytes = utf8Length(scalar)
    if (bytes + scalarBytes > maximumBytes) break
    bytes += scalarBytes
    result += scalar
  }
  return result.replace(/[ .]+$/gu, '')
}

function utf8Length(value: string): number {
  return encoder.encode(value).byteLength
}

function groupBy<T>(values: ReadonlyArray<T>, keyOf: (value: T) => string): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>()
  for (const value of values) {
    const key = keyOf(value)
    const group = groups.get(key) ?? []
    group.push(value)
    groups.set(key, group)
  }
  return groups
}

function addWarning(
  warningCodes: Map<ResourceId, Set<WarningCode>>,
  resourceId: ResourceId,
  code: WarningCode,
): void {
  const codes = warningCodes.get(resourceId) ?? new Set<WarningCode>()
  codes.add(code)
  warningCodes.set(resourceId, codes)
}

function failOnce(
  failures: Array<PortablePathFailure>,
  resourceId: ResourceId,
  code: PortablePathFailure['code'],
): void {
  if (failures.some((failure) => failure.resourceId === resourceId && failure.code === code)) return
  failures.push({ resourceId, code })
}

function byResourceId(left: ProjectedResource, right: ProjectedResource): number {
  return left.resource.resourceId.localeCompare(right.resource.resourceId)
}

function compareWarning(left: PortablePathWarning, right: PortablePathWarning): number {
  return left.resourceId.localeCompare(right.resourceId) || left.code.localeCompare(right.code)
}

function compareFailure(left: PortablePathFailure, right: PortablePathFailure): number {
  return left.resourceId.localeCompare(right.resourceId) || left.code.localeCompare(right.code)
}
