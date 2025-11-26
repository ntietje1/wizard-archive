import type { Id } from '../_generated/dataModel'
import type { Doc } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'

export type Page = Doc<'pages'>

export type PageWithContent = Page & {
  content: CustomBlock[]
}

export type CreatePageResult = {
  pageId: Id<'pages'>
  slug: string
}

export const PAGE_TYPE = {
  TEXT: 'text',
  MAP: 'map',
  CANVAS: 'canvas',
} as const

export type PageType = (typeof PAGE_TYPE)[keyof typeof PAGE_TYPE]
