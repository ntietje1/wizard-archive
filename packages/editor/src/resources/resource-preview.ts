import type { ResourcePreview, ResourcePreviewOutlineEntry } from './editor-runtime-contract'
import type { ResourceKind } from './resource-record'

export const RESOURCE_PREVIEW_EXCERPT_CODE_POINT_LIMIT = 512
export const RESOURCE_PREVIEW_OUTLINE_LIMIT = 64
export const RESOURCE_PREVIEW_OUTLINE_TEXT_CODE_POINT_LIMIT = 160

export function createResourcePreview(
  kind: ResourceKind,
  excerpt: string,
  outline: ReadonlyArray<ResourcePreviewOutlineEntry>,
): ResourcePreview {
  return {
    kind,
    excerpt: truncateCodePoints(excerpt, RESOURCE_PREVIEW_EXCERPT_CODE_POINT_LIMIT),
    outline:
      kind === 'note'
        ? outline.slice(0, RESOURCE_PREVIEW_OUTLINE_LIMIT).map((heading) => ({
            ...heading,
            text: truncateCodePoints(heading.text, RESOURCE_PREVIEW_OUTLINE_TEXT_CODE_POINT_LIMIT),
          }))
        : [],
  }
}

function truncateCodePoints(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('')
}
