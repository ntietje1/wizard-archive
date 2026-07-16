import type { z } from 'zod'
import { z as zod } from 'zod'
import { canvasTextWithinWorkload } from '../workload'
import { generateUuidV7, isUuidV7 } from '../../resources/domain-id'
import type { UuidV7 } from '../../resources/domain-id'
import {
  createCommonRichTextBlockContentSchemas,
  createRichTextBlockSchema,
  enforceUniqueRichTextBlockIdentities,
  richTextTextSchema,
} from '../../rich-text/blocknote/common-model'
import type { CommonRichTextBlock, RichTextText } from '../../rich-text/blocknote/common-model'

type CanvasTextBlock = CommonRichTextBlock<RichTextText, true>
export type CanvasTextDocument = Array<CanvasTextBlock>

const blockIdSchema = zod.custom<UuidV7>(
  (value) => typeof value === 'string' && isUuidV7(value),
  'Expected a lowercase UUIDv7 canvas text block id',
)
const blockSchema = createRichTextBlockSchema<CanvasTextBlock>(
  createCommonRichTextBlockContentSchemas(richTextTextSchema, true),
  blockIdSchema,
)
const documentSchema: z.ZodType<CanvasTextDocument> = zod
  .array(blockSchema)
  .superRefine(enforceUniqueRichTextBlockIdentities)

export function parseCanvasTextDocument(value: unknown): CanvasTextDocument | null {
  if (!canvasTextWithinWorkload(value)) return null
  const result = documentSchema.safeParse(value)
  return result.success ? minimizeCanvasTextDocument(result.data) : null
}

function minimizeCanvasTextDocument(document: CanvasTextDocument): CanvasTextDocument {
  const minimizeBlock = (block: CanvasTextBlock): CanvasTextBlock => ({
    ...block,
    ...(block.content
      ? {
          content: block.content.map((content) =>
            content.styles && Object.keys(content.styles).length === 0
              ? { type: content.type, text: content.text }
              : content,
          ),
        }
      : {}),
    ...(block.children ? { children: block.children.map(minimizeBlock) } : {}),
  })
  return document.map(minimizeBlock)
}

export function createCanvasTextDocument(text: string): CanvasTextDocument {
  return [{ id: generateUuidV7(), type: 'paragraph', content: [{ type: 'text', text }] }]
}

export function duplicateCanvasTextDocument(document: CanvasTextDocument): CanvasTextDocument {
  const duplicateBlock = (block: CanvasTextBlock): CanvasTextBlock => ({
    ...structuredClone(block),
    id: generateUuidV7(),
    ...(block.children ? { children: block.children.map(duplicateBlock) } : {}),
  })
  return document.map(duplicateBlock)
}
