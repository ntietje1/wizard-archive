import type { InMemoryEditorContent } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import type { ResourceCatalogSnapshot } from '@wizard-archive/editor/resources/catalog-contract'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'

export type LocalWorkspaceFixture = Readonly<{
  scope: ResourceProjectionScope
  snapshot: ResourceCatalogSnapshot
  content: InMemoryEditorContent
}>
