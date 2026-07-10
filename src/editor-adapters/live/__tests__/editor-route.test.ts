import { describe, expect, it } from 'vite-plus/test'
import { createEditorRoutePath } from '../editor-route'

describe('createEditorRoutePath', () => {
  it('builds the live editor path with encoded route params', () => {
    expect(
      createEditorRoutePath({
        dmUsername: 'dm name',
        campaignSlug: 'storm/king',
      }),
    ).toBe('/campaigns/dm%20name/storm%2Fking/editor')
  })
})
