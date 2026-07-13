import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { NoteBlockId } from '@wizard-archive/editor/resources/domain-id'

export function testNoteBlockId(label: string): NoteBlockId {
  return deterministicUuidV7(label) as NoteBlockId
}
