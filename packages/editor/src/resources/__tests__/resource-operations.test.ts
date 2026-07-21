import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { ResourceRecord } from '../resource-record'
import { createWorkspaceActions } from '../workspace/resource-operations'

describe('resource application workflows', () => {
  it('creates an empty file through the same resource command path as other kinds', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    const report = vi.fn()

    const result = await createWorkspaceActions(core.runtime, report).create('file', null, '')

    expect(result).toMatchObject({ status: 'completed' })
    if (result.status !== 'completed') throw new TypeError('Expected completed transfer')
    expect(core.runtime.resources.index.getSnapshot().lookup(result.resourceId)).toMatchObject({
      state: 'known',
      value: { kind: 'file', title: 'Untitled file' },
    })
    expect(report).not.toHaveBeenCalled()
    core.dispose()
  })

  it('imports nested browser directories through one transfer and opens the created folder', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const open = vi.fn()
    const core = createInMemoryEditorRuntime({
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: { ...navigation(generateDomainId(DOMAIN_ID_KIND.resource)), open },
    })
    const report = vi.fn()
    const rootId = generateDomainId(DOMAIN_ID_KIND.resource)
    const execute = vi.fn((...args: Parameters<NonNullableTransfer['execute']>) => {
      const [intent, , , options] = args
      options?.onProgress?.({
        completedEntries: 0,
        totalEntries: 4,
        uploadedBytes: 0,
        totalBytes: 0,
        currentPath: 'Campaign',
      })
      return Promise.resolve({
        jobId: intent.jobId,
        status: 'settled' as const,
        entries: [
          completedTransfer('Campaign', 'campaign', rootId, 'folder'),
          completedTransfer(
            'Campaign/Readme.md',
            'readme',
            generateDomainId(DOMAIN_ID_KIND.resource),
            'note',
          ),
          completedTransfer(
            'Campaign/Maps',
            'maps',
            generateDomainId(DOMAIN_ID_KIND.resource),
            'folder',
          ),
          completedTransfer(
            'Campaign/Maps/Map.bin',
            'map',
            generateDomainId(DOMAIN_ID_KIND.resource),
            'file',
          ),
        ],
      })
    })
    const runtime = withTransfers(core.runtime, execute)
    const directory = browserDirectory('Campaign', [
      [
        browserFileEntry('Readme.md', '# Campaign'),
        browserDirectory('Maps', [[browserFileEntry('Map.bin', 'map')], []]),
      ],
      [],
    ])

    await createWorkspaceActions(runtime, report).importExternal(
      null,
      browserDataTransfer(directory),
    )

    expect(execute).toHaveBeenCalledOnce()
    expect(open).toHaveBeenLastCalledWith({
      kind: 'resource',
      resourceId: rootId,
    })
    expect(report.mock.calls.at(-1)?.[0]).toEqual({
      kind: 'message',
      message: 'Imported 2 folders, 1 note, 1 file',
    })
    expect(
      report.mock.calls.some(
        ([feedback]) =>
          feedback.kind === 'pending' &&
          feedback.message.startsWith('Importing resources') &&
          feedback.progress,
      ),
    ).toBe(true)
    core.dispose()
  })

  it('classifies a standalone dropped text file as a note', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const navigationGateway = {
      ...navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
      open: vi.fn(),
    }
    const core = createInMemoryEditorRuntime({
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigationGateway,
    })
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const execute = vi.fn((...args: Parameters<NonNullableTransfer['execute']>) => {
      const [intent] = args
      return Promise.resolve({
        jobId: intent.jobId,
        status: 'settled' as const,
        entries: [completedTransfer('Session.md', 'selected-file', noteId, 'note')],
      })
    })
    const runtime = withTransfers(core.runtime, execute)

    await createWorkspaceActions(runtime, vi.fn()).importExternal(
      null,
      browserDataTransfer(browserFileEntry('Session.md', '# Session')),
    )

    expect(execute).toHaveBeenCalledOnce()
    expect(navigationGateway.open).toHaveBeenLastCalledWith({
      kind: 'resource',
      resourceId: noteId,
    })
    core.dispose()
  })

  it('replays an authored upload after response loss even when the initiating surface aborts', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    const createAsset = core.runtime.content.files.createAsset.bind(core.runtime.content.files)
    const retry = vi.fn(createAsset)
    const runtime = {
      ...core.runtime,
      content: {
        ...core.runtime.content,
        files: {
          create: (envelope) => core.runtime.content.files.create(envelope),
          createAsset: vi.fn((source) =>
            Promise.resolve({
              status: 'retryable' as const,
              reason: 'response_lost' as const,
              retry: () => retry(source),
            }),
          ),
          dispose: () => core.runtime.content.files.dispose(),
          export: (resourceId) => core.runtime.content.files.export(resourceId),
          get: (resourceId) => core.runtime.content.files.get(resourceId),
          replace: (resourceId, version, source) =>
            core.runtime.content.files.replace(resourceId, version, source),
          subscribe: (resourceId, listener) =>
            core.runtime.content.files.subscribe(resourceId, listener),
        },
      },
    } satisfies EditorRuntime
    const controller = new AbortController()
    const settlement = await createWorkspaceActions(runtime, vi.fn()).createAssetFile(
      new File(['once'], 'Once.txt', { type: 'text/plain' }),
      controller.signal,
    )
    if (settlement.status !== 'indeterminate') {
      throw new Error('Expected an indeterminate creation')
    }
    controller.abort()

    const replay = await settlement.retry()

    if (replay.status !== 'completed') throw new Error('Expected a completed replay')
    expect(runtime.content.files.createAsset).toHaveBeenCalledOnce()
    expect(retry).toHaveBeenCalledOnce()
    const file = runtime.resources.index.getSnapshot().lookup(replay.resourceId)
    expect(file).toMatchObject({ state: 'known', value: { kind: 'file', title: 'Once.txt' } })
    if (file.state !== 'known' || file.value.displayParentId === null) {
      throw new Error('Expected the created file in Assets')
    }
    core.dispose()
  })

  it('creates authored uploads under one canonical Assets folder', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    const actions = createWorkspaceActions(core.runtime, vi.fn())

    const [first, second] = await Promise.all([
      actions.createAssetFile(new File(['first'], 'First.txt', { type: 'text/plain' })),
      actions.createAssetFile(new File(['second'], 'Second.txt', { type: 'text/plain' })),
    ])

    if (first.status !== 'completed' || second.status !== 'completed') {
      throw new TypeError('Expected completed Assets uploads')
    }
    const snapshot = core.runtime.resources.index.getSnapshot()
    const firstFile = snapshot.lookup(first.resourceId)
    const secondFile = snapshot.lookup(second.resourceId)
    if (firstFile.state !== 'known' || secondFile.state !== 'known') {
      throw new TypeError('Expected uploaded resources')
    }
    expect(firstFile.value.displayParentId).toBe(secondFile.value.displayParentId)
    const assetsFolderId = firstFile.value.displayParentId
    if (assetsFolderId === null) throw new TypeError('Expected Assets parent')
    expect(snapshot.lookup(assetsFolderId)).toMatchObject({
      state: 'known',
      value: { kind: 'folder', title: 'Assets', displayParentId: null, icon: 'Box' },
    })
    if (core.runtime.resources.structure.status !== 'available') {
      throw new TypeError('Expected editable structure')
    }
    await expect(
      core.runtime.resources.structure.value.execute({
        campaignId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: { type: 'trash', resourceIds: [assetsFolderId] },
      }),
    ).resolves.toEqual({
      status: 'received',
      result: { status: 'rejected', reason: 'protected_resource' },
    })
    core.dispose()
  })
})

type NonNullableTransfer = Extract<EditorRuntime['transfers'], { status: 'available' }>['value']

function withTransfers(
  runtime: EditorRuntime,
  execute: NonNullableTransfer['execute'],
): EditorRuntime {
  return { ...runtime, transfers: { status: 'available', value: { execute } } }
}

function completedTransfer(
  sourcePath: string,
  sourceId: string,
  resourceId: ResourceRecord['id'],
  kind: Extract<ResourceRecord['kind'], 'file' | 'folder' | 'note'>,
) {
  return { status: 'completed' as const, sourceId, sourcePath, resourceId, kind }
}

function navigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  let target: ReturnType<ResourceNavigation['current']> = {
    kind: 'resource',
    resourceId: initialResourceId,
  }
  return {
    current: () => target,
    open: (nextTarget) => {
      target = nextTarget
    },
    subscribe: () => () => {},
  }
}

function browserDataTransfer(
  entry: FileSystemEntry,
): Parameters<ReturnType<typeof createWorkspaceActions>['importExternal']>[1] {
  const item = {
    kind: 'file',
    type: '',
    getAsFile: () => new File([], entry.name),
    getAsString: () => {},
    webkitGetAsEntry: () => entry,
  } as DataTransferItem
  return { files: [], items: [item] }
}

function browserFileEntry(name: string, content: string): FileSystemFileEntry {
  return {
    filesystem: {} as FileSystem,
    fullPath: `/${name}`,
    isDirectory: false,
    isFile: true,
    name,
    file: (resolve) => resolve(new File([content], name)),
    getParent: () => {},
  } as FileSystemFileEntry
}

function browserDirectory(
  name: string,
  batches: ReadonlyArray<ReadonlyArray<FileSystemEntry>>,
): FileSystemDirectoryEntry {
  let index = 0
  return {
    filesystem: {} as FileSystem,
    fullPath: `/${name}`,
    isDirectory: true,
    isFile: false,
    name,
    createReader: () =>
      ({
        readEntries: (resolve) => {
          resolve([...(batches[index] ?? [])])
          index += 1
        },
      }) as FileSystemDirectoryReader,
    getDirectory: () => {},
    getFile: () => {},
    getParent: () => {},
  } as FileSystemDirectoryEntry
}
