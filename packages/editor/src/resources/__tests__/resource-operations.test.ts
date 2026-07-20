import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { initialResourceMetadataVersion } from '../resource-metadata-version'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceRecord } from '../resource-record'
import { createWorkspaceActions } from '../workspace/resource-operations'

describe('resource application workflows', () => {
  it('empties trash roots through bounded canonical command batches', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resources = await Promise.all(
      Array.from({ length: 51 }, async (_, index): Promise<ResourceRecord> => {
        const title = canonicalizeResourceTitle(`Trashed ${index}`)
        const metadata = {
          parentId: null,
          kind: 'folder' as const,
          title,
          icon: null,
          color: null,
          lifecycle: 'trashed' as const,
        }
        return {
          id: generateDomainId(DOMAIN_ID_KIND.resource),
          campaignId,
          ...metadata,
          lifecycle: { state: 'trashed', at: 1, by: actorId },
          metadataVersion: await initialResourceMetadataVersion(metadata),
          created: { at: 1, by: actorId },
          updated: { at: 1, by: actorId },
        }
      }),
    )
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources,
        tombstones: [],
        aliases: [],
      },
      navigation: navigation(resources[0]!.id),
    })
    const structure = core.runtime.resources.structure
    if (structure.status !== 'available') throw new Error('Expected structure capability')
    const execute = vi.fn((envelope) => structure.value.execute(envelope))
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: { status: 'available', value: { execute } },
      },
    } satisfies EditorRuntime
    const report = vi.fn()

    await createWorkspaceActions(runtime, report).emptyTrash(
      resources.map((resource) => resource.id),
    )

    expect(execute).toHaveBeenCalledTimes(3)
    expect(
      execute.mock.calls.map(([envelope]) =>
        envelope.command.type === 'permanentlyDelete' ? envelope.command.resourceIds.length : 0,
      ),
    ).toEqual([25, 25, 1])
    expect(report).toHaveBeenLastCalledWith('Trash emptied')
    expect(
      resources.every(
        (resource) => runtime.resources.index.getSnapshot().lookup(resource.id).state === 'missing',
      ),
    ).toBe(true)
    core.dispose()
  })

  it('submits explicit uploads to the canonical transfer owner without authoring a resource', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigation(generateDomainId(DOMAIN_ID_KIND.resource)),
    })
    if (core.runtime.transfers.status !== 'available') throw new Error('Expected transfers')
    const transfers = core.runtime.transfers.value
    const execute = vi.fn((...args: Parameters<typeof transfers.execute>) =>
      transfers.execute(...args),
    )
    const runtime = {
      ...core.runtime,
      transfers: { status: 'available' as const, value: { execute } },
    } satisfies EditorRuntime
    const report = vi.fn()

    const result = await createWorkspaceActions(runtime, report).createFile(
      null,
      new File(['# Kept as a file'], 'Session.md', { type: 'text/markdown' }),
    )

    expect(result).toMatchObject({ status: 'completed' })
    expect(execute).toHaveBeenCalledOnce()
    const [intent, sources, entries] = execute.mock.calls[0]!
    expect(intent).toMatchObject({
      campaignId,
      destinationParentId: null,
      textFileHandling: 'files',
    })
    expect(sources).toEqual([{ id: 'selected-file', kind: 'file', name: 'Session.md' }])
    expect(entries).toMatchObject([{ sourceId: 'selected-file', path: 'Session.md', type: 'file' }])
    if (result.status !== 'completed') throw new TypeError('Expected completed transfer')
    expect(runtime.resources.index.getSnapshot().lookup(result.resourceId)).toMatchObject({
      state: 'known',
      value: { kind: 'file', title: 'Session.md' },
    })
    expect(report).toHaveBeenLastCalledWith('File uploaded')
    core.dispose()
  })

  it('imports nested browser directories through one transfer and opens the created folder', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const open = vi.fn()
    const core = createInMemoryEditorRuntime({
      canEdit: true,
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
    const directory = browserDirectory('Campaign', [
      [
        browserFileEntry('Readme.md', '# Campaign'),
        browserDirectory('Maps', [[browserFileEntry('Map.bin', 'map')], []]),
      ],
      [],
    ])

    await createWorkspaceActions(core.runtime, report).importExternal(
      null,
      browserDataTransfer(directory),
    )

    const rootQuery = { parentId: null, lifecycle: 'active' as const }
    await core.runtime.resources.loader.ensureCollection(rootQuery)
    let snapshot = core.runtime.resources.index.getSnapshot()
    const roots = snapshot.list(rootQuery)
    expect(roots).toMatchObject({
      state: 'known',
      complete: true,
      items: [{ kind: 'folder', title: 'Campaign' }],
    })
    if (roots.state !== 'known' || !roots.items[0]) throw new Error('Expected imported root')
    const childQuery = { parentId: roots.items[0].id, lifecycle: 'active' as const }
    await core.runtime.resources.loader.ensureCollection(childQuery)
    snapshot = core.runtime.resources.index.getSnapshot()
    const children = snapshot.list(childQuery)
    expect(children).toMatchObject({
      state: 'known',
      complete: true,
      items: expect.arrayContaining([
        expect.objectContaining({ kind: 'note', title: 'Readme.md' }),
        expect.objectContaining({ kind: 'folder', title: 'Maps' }),
      ]),
    })
    expect(open).toHaveBeenLastCalledWith({
      kind: 'resource',
      resourceId: roots.items[0].id,
    })
    expect(report.mock.calls.at(-1)?.[0]).toBe('Imported 2 folders, 1 note, 1 file')
    expect(
      report.mock.calls.some(
        ([message, , progress]) =>
          typeof message === 'string' && message.startsWith('Importing resources') && progress,
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
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: [],
        tombstones: [],
        aliases: [],
      },
      navigation: navigationGateway,
    })

    await createWorkspaceActions(core.runtime, vi.fn()).importExternal(
      null,
      browserDataTransfer(browserFileEntry('Session.md', '# Session')),
    )

    await core.runtime.resources.loader.ensureCollection({
      parentId: null,
      lifecycle: 'active',
    })
    const roots = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    expect(roots).toMatchObject({
      state: 'known',
      items: [expect.objectContaining({ kind: 'note', title: 'Session.md' })],
    })
    if (roots.state !== 'known' || !roots.items[0]) throw new Error('Expected imported note')
    expect(navigationGateway.open).toHaveBeenLastCalledWith({
      kind: 'resource',
      resourceId: roots.items[0].id,
    })
    core.dispose()
  })

  it('replays an authored upload after response loss even when the initiating surface aborts', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const core = createInMemoryEditorRuntime({
      canEdit: true,
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
      canEdit: true,
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

function navigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  return {
    current: () => ({ kind: 'resource', resourceId: initialResourceId }),
    open: () => {},
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
