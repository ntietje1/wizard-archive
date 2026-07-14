import { describe, expect, it } from 'vite-plus/test'
import { createEditorRoutePath } from '../editor-route'

describe('createEditorRoutePath', () => {
  it('builds the live editor path with encoded route params', () => {
    expect(
      createEditorRoutePath({
        campaignId: 'campaign/id',
      }),
    ).toBe('/campaigns/campaign%2Fid/editor')
  })
})
