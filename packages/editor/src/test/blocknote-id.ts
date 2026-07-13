import type { NoteBlockId } from '../resources/domain-id'
import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'

export function testNoteBlockId(label: string): NoteBlockId {
  return deterministicUuidV7(label) as NoteBlockId
}
