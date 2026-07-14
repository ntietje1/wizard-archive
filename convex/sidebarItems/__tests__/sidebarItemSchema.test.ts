import { describe, expect, it } from 'vitest'
import { createNote } from '../../_test/factories.helper'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'

describe('sidebar item schema', () => {
  const t = createTestContext()

  it('rejects unsupported stored icon names', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      t.run(async (dbCtx) => {
        await dbCtx.db.patch('sidebarItems', noteRowId, {
          iconName: 'NotAStoredIcon' as never,
        })
      }),
    ).rejects.toThrow()
  })

  it('accepts supported stored icon names', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteRowId, {
        iconName: 'Folder',
      })
    })

    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.iconName).toBe('Folder')
  })
})
