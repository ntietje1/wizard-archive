import { InMemoryResourceCatalog } from '../in-memory-resource-catalog'
import { defineResourceCatalogConformance } from './resource-catalog-conformance'

defineResourceCatalogConformance('in-memory', (options) => new InMemoryResourceCatalog(options))
