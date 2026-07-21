import type {
  InMemoryEditorContent,
  InMemoryEditorRuntimeInput,
} from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import type { ResourceCatalogSnapshot } from '@wizard-archive/editor/resources/catalog-contract'

export type LocalWorkspaceFixture = Readonly<{
  scope: InMemoryEditorRuntimeInput['scope']
  snapshot: ResourceCatalogSnapshot
  content: InMemoryEditorContent
}>
