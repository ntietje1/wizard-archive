import type { ResourceId } from './domain-id'
import type { ResourceKind, ResourceTitle } from './resource-contract'

declare const portableRelativePathBrand: unique symbol

export const PORTABLE_PATH_VERSION = 'portable-path-v1' as const
export const MAX_SEGMENT_UTF8_BYTES = 240
export const MAX_RELATIVE_PATH_UTF8_BYTES = 1024
export const INITIAL_UUID_SUFFIX_LENGTH = 8

export type PortableRelativePath = string & { readonly [portableRelativePathBrand]: true }

export type PortablePathPlacement =
  | { readonly parent: 'packageRoot' }
  | { readonly parent: 'resource'; readonly parentId: ResourceId }
  | { readonly parent: 'trashRoot' }

export type PortablePathResource = Readonly<{
  resourceId: ResourceId
  title: ResourceTitle
  kind: ResourceKind
  extension: string | null
  placement: PortablePathPlacement
}>

export type PortablePathEntry = Readonly<{
  resourceId: ResourceId
  path: PortableRelativePath
}>

export type PortablePathWarning = Readonly<{
  resourceId: ResourceId
  code: 'sanitized' | 'truncated' | 'collision_suffixed' | 'reserved_name_prefixed'
}>

export type PortablePathFailure = Readonly<{
  resourceId: ResourceId
  code: 'invalid_input' | 'invalid_placement' | 'relative_path_too_long'
}>

export type PortablePathProjection = Readonly<{
  version: typeof PORTABLE_PATH_VERSION
  entries: ReadonlyArray<PortablePathEntry>
  warnings: ReadonlyArray<PortablePathWarning>
  failures: ReadonlyArray<PortablePathFailure>
}>

export type PortablePathProjector = (
  resources: ReadonlyArray<PortablePathResource>,
) => PortablePathProjection
