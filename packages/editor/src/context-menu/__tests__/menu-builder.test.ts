import { describe, expect, it, vi } from 'vitest'
import { buildMenu } from '../menu-builder'
import type { ContextMenuContributor, ContextMenuGroupConfig } from '../types'

type TestContext = { surface: 'test-surface' }
type TestServices = Record<string, never>

const context: TestContext = { surface: 'test-surface' }
const services: TestServices = {}
const groupConfig: ContextMenuGroupConfig = {
  main: { label: null, priority: 0 },
}

function buildWithContributor(contributor: ContextMenuContributor<TestContext, TestServices>) {
  return buildMenu({
    context,
    services,
    contributors: [contributor],
    commands: {},
    groupConfig,
  })
}

describe('buildMenu', () => {
  it('rejects leaf items without an executable action', () => {
    expect(() =>
      buildWithContributor({
        id: 'invalid-items',
        surfaces: ['test-surface'],
        getItems: () => [
          {
            id: 'dead-leaf',
            label: 'Dead leaf',
            group: 'main',
            priority: 0,
          },
        ],
      }),
    ).toThrow('Missing context-menu action for leaf item "dead-leaf"')
  })

  it('rejects blank command ids before rendering a leaf item', () => {
    expect(() =>
      buildWithContributor({
        id: 'invalid-items',
        surfaces: ['test-surface'],
        getItems: () => [
          {
            id: 'blank-command',
            commandId: '',
            label: 'Blank command',
            group: 'main',
            priority: 0,
          },
        ],
      }),
    ).toThrow('Invalid context-menu command id for item "blank-command"')
  })

  it('keeps submenu parents valid without a direct action', () => {
    const selectChild = vi.fn()
    const menu = buildWithContributor({
      id: 'submenu-items',
      surfaces: ['test-surface'],
      getItems: () => [
        {
          id: 'parent',
          label: 'Parent',
          group: 'main',
          priority: 0,
          children: [
            {
              id: 'child',
              label: 'Child',
              group: 'main',
              priority: 0,
              onSelect: selectChild,
            },
          ],
        },
      ],
    })

    expect(menu.groups[0]?.items[0]?.children?.map((item) => item.label)).toEqual(['Child'])
  })
})
