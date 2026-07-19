import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type {
  FileContentSource,
  FileContentState,
  FileResourceSource,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { createResourceWatchStore } from './resource-watch-store'
import { liveContentPendingState } from './live-content-pending-state'
import type { LiveResourceContentAuthority } from './live-resource-content-authority'

type FileDownloadResult = FunctionReturnType<typeof api.resources.queries.loadFileDownload>
type ReplaceFileArgs = FunctionArgs<typeof api.resources.actions.replaceFileContent>
type ReplaceFileResult = FunctionReturnType<typeof api.resources.actions.replaceFileContent>
type FileSnapshot = FunctionReturnType<typeof api.resources.queries.loadFileContent>

type LiveFileContentBackend = Readonly<{
  load(resourceId: ResourceId): Promise<FileSnapshot>
  watch(resourceId: ResourceId, apply: (snapshot: FileSnapshot) => void): () => void
  download(resourceId: ResourceId): Promise<FileDownloadResult>
  discard(sessionId: Id<'fileStorage'>): Promise<void>
  replace(args: ReplaceFileArgs): Promise<ReplaceFileResult>
  upload(source: FileResourceSource): Promise<Id<'fileStorage'>>
}>

type FileContentStore = ReturnType<typeof createResourceWatchStore<FileSnapshot, FileContentState>>

class LiveFileContentStateSource {
  readonly #store: FileContentStore

  constructor(private readonly backend: LiveFileContentBackend) {
    this.#store = createResourceWatchStore<FileSnapshot, FileContentState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): FileContentState {
    return this.#store.get(resourceId)
  }

  async load(resourceId: ResourceId): Promise<FileContentState> {
    this.#apply(resourceId, await this.backend.load(resourceId))
    return this.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  dispose(): void {
    this.#store.dispose()
  }

  #apply(resourceId: ResourceId, snapshot: FileSnapshot): void {
    if (snapshot.status !== 'ready') {
      this.#store.set(resourceId, liveContentPendingState(snapshot))
      return
    }
    try {
      this.#store.set(resourceId, {
        status: 'ready',
        content: snapshot.content,
        version: assertVersionStamp(snapshot.version),
      })
    } catch {
      this.#store.set(resourceId, { status: 'integrity_error', issue: 'version_mismatch' })
    }
  }
}

export function createLiveFileContentSource(
  campaignId: CampaignId,
  backend: LiveFileContentBackend,
  authority: LiveResourceContentAuthority,
): FileContentSource {
  const content = new LiveFileContentStateSource(backend)
  return {
    get: (resourceId) => content.get(resourceId),
    subscribe: (resourceId, listener) => content.subscribe(resourceId, listener),
    export: async (resourceId) => {
      const state = await content.load(resourceId)
      if (state.status !== 'ready') {
        return state.status === 'initializing' ? { status: 'loading' } : state
      }
      const download = await backend.download(resourceId)
      if (download.status !== 'ready') return download
      const bytes =
        download.url === null
          ? new Uint8Array()
          : new Uint8Array(await (await fetchFile(download.url)).arrayBuffer())
      if (bytes.byteLength !== state.content.byteSize) {
        return { status: 'integrity_error', issue: 'content_corrupt' }
      }
      const expectedVersion = assertVersionStamp(download.version)
      const actualVersion = await initialFileContentVersion(bytes, state.content)
      if (
        !versionStampEquals(state.version, expectedVersion) ||
        actualVersion.digest !== expectedVersion.digest
      ) {
        return { status: 'integrity_error', issue: 'content_corrupt' }
      }
      return {
        status: 'ready',
        bytes,
        extension: state.content.extension ?? 'bin',
        mediaType: state.content.mediaType,
      }
    },
    replace: async (resourceId, expectedVersion, source) => {
      if (!authority.canEdit(resourceId)) {
        return { status: 'rejected', reason: 'unauthorized' }
      }
      let sessionId: Id<'fileStorage'> | null = null
      try {
        sessionId = await backend.upload(source)
        const args = {
          campaignId,
          resourceId,
          expectedVersion,
          uploadSessionId: sessionId,
        }
        let result: ReplaceFileResult
        try {
          result = await backend.replace(args)
        } catch {
          result = await backend.replace(args)
        }
        if (result.status === 'completed') {
          await content.load(resourceId).catch(() => undefined)
          return {
            status: 'completed',
            content: result.content,
            version: assertVersionStamp(result.version),
          }
        }
        await backend.discard(sessionId).catch(() => undefined)
        return result
      } catch {
        if (sessionId) await backend.discard(sessionId).catch(() => undefined)
        return { status: 'retryable', reason: 'response_lost' }
      }
    },
    dispose: () => {
      content.dispose()
    },
  }
}

async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new TypeError('File download failed')
  return response
}
