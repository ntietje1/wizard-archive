import { vi } from 'vitest'
import type { CanvasContextMenuCommands } from '../canvas-context-menu-types'

export function createCommands(
  overrides: Partial<CanvasContextMenuCommands> = {},
): CanvasContextMenuCommands {
  return {
    copy: {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    cut: {
      id: 'cut',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    paste: {
      id: 'paste',
      canRun: vi.fn(() => false),
      run: vi.fn(() => null),
    },
    duplicate: {
      id: 'duplicate',
      canRun: vi.fn(() => true),
      run: vi.fn(() => null),
    },
    delete: {
      id: 'delete',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    reorder: {
      id: 'reorder',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    arrange: {
      id: 'arrange',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    ...overrides,
  }
}
