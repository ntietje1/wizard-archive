import { describe, expect, it } from 'vite-plus/test'
import { createEditorSchema } from '../editor-specs'

describe('note editor schema', () => {
  it('includes the custom note inline and embed block specs', () => {
    const schema = createEditorSchema()

    expect(schema.inlineContentSchema.value).toBeDefined()
    expect(schema.blockSchema.embed).toBeDefined()
    expect(schema.styleSchema.textColor).toBeDefined()
  })
})
