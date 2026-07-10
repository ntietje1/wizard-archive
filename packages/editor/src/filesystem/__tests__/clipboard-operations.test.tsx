import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { setFileSystemClipboard } from '../clipboard'
import { useFileSystemClipboardOperations } from '../clipboard-operations'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createReadWriteTestCache } from './cache-test-utils'

const workspaceId = 'workspace_1'

describe('useFileSystemClipboardOperations', () => {
  afterEach(() => {
    setFileSystemClipboard(null)
  })

  it('does not advertise same-parent cut paste as available', () => {
    const folder = createFolder()
    const note = createNote({ parentId: folder.id })
    const cacheAdapter = createReadWriteTestCache({ sidebar: [folder, note], trash: [] })
    const executeCommand = vi.fn()
    const { result } = renderHook(() =>
      useFileSystemClipboardOperations({
        workspaceId,
        activeItemSurface: { parentId: folder.id },
        cacheAdapter,
        executeCommand,
      }),
    )

    act(() => result.current.cut([note.id]))

    expect(result.current.canPaste()).toBe(false)
  })

  it('copies selected items without clearing the clipboard after paste', async () => {
    const source = createNote()
    const targetFolder = createFolder()
    const cacheAdapter = createReadWriteTestCache({ sidebar: [source, targetFolder], trash: [] })
    const executeCommand = vi.fn()
    const { result } = renderHook(() =>
      useFileSystemClipboardOperations({
        workspaceId,
        activeItemSurface: { parentId: null },
        cacheAdapter,
        executeCommand,
      }),
    )

    act(() => result.current.copy([source.id]))

    expect(result.current.canPaste(targetFolder.id)).toBe(true)
    await act(async () => result.current.paste(targetFolder.id))

    expect(executeCommand).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'copy',
        itemIds: [source.id],
        targetParentId: targetFolder.id,
      },
      { onSuccess: undefined },
    )
    expect(result.current.canPaste(targetFolder.id)).toBe(true)
  })

  it('moves cut items to a different parent and clears the clipboard on success', async () => {
    const sourceFolder = createFolder({ name: 'Source' })
    const targetFolder = createFolder({ name: 'Target' })
    const note = createNote({ parentId: sourceFolder.id })
    const cacheAdapter = createReadWriteTestCache({
      sidebar: [sourceFolder, targetFolder, note],
      trash: [],
    })
    const executeCommand = vi.fn((_command, options) => options?.onSuccess?.())
    const { result } = renderHook(() =>
      useFileSystemClipboardOperations({
        workspaceId,
        activeItemSurface: { parentId: sourceFolder.id },
        cacheAdapter,
        executeCommand,
      }),
    )

    act(() => result.current.cut([note.id]))

    expect(result.current.canPaste(targetFolder.id)).toBe(true)
    await act(async () => result.current.paste(targetFolder.id))

    expect(executeCommand).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'move',
        itemIds: [note.id],
        targetParentId: targetFolder.id,
      },
      { onSuccess: expect.any(Function) },
    )
    expect(result.current.canPaste(targetFolder.id)).toBe(false)
  })

  it('uses the current clipboard when paste follows cut before a hook rerender', async () => {
    const source = createNote()
    const targetFolder = createFolder()
    const cacheAdapter = createReadWriteTestCache({ sidebar: [source, targetFolder], trash: [] })
    const executeCommand = vi.fn()
    const { result } = renderHook(() =>
      useFileSystemClipboardOperations({
        workspaceId,
        activeItemSurface: { parentId: null },
        cacheAdapter,
        executeCommand,
      }),
    )
    const operations = result.current

    act(() => operations.cut([source.id]))
    let firstPasteResult: Awaited<ReturnType<typeof operations.paste>> | undefined
    let secondPasteResult: Awaited<ReturnType<typeof result.current.paste>> | undefined
    await act(async () => {
      firstPasteResult = await operations.paste(null)
    })
    await act(async () => {
      secondPasteResult = await result.current.paste(targetFolder.id)
    })

    expect(executeCommand).not.toHaveBeenCalled()
    expect(firstPasteResult).toEqual({ status: 'unavailable', reason: 'paste_unavailable' })
    expect(secondPasteResult).toEqual({ status: 'unavailable', reason: 'paste_unavailable' })
  })

  it('does not create a command for an empty clipboard selection', async () => {
    const cacheAdapter = createReadWriteTestCache({ sidebar: [], trash: [] })
    const executeCommand = vi.fn()
    const { result } = renderHook(() =>
      useFileSystemClipboardOperations({
        workspaceId,
        activeItemSurface: { parentId: null },
        cacheAdapter,
        executeCommand,
      }),
    )

    act(() => result.current.copy([]))
    let pasteResult: Awaited<ReturnType<typeof result.current.paste>> | undefined
    await act(async () => {
      pasteResult = await result.current.paste(null)
    })

    expect(result.current.canPaste()).toBe(false)
    expect(executeCommand).not.toHaveBeenCalled()
    expect(pasteResult).toEqual({ status: 'unavailable', reason: 'paste_unavailable' })
  })
})
