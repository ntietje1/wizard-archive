import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../../resources/domain-id'
import type { UuidV7 } from '../../resources/domain-id'
import type { NoteBlock } from '../document/model'
import { evaluateNoteValues, extractNoteValues, noteValueReference } from '../values/runtime'

describe('note value runtime', () => {
  it('evaluates UUID references independently of editable labels', () => {
    const healthId = generateUuidV7()
    const bonusId = generateUuidV7()
    const totalId = generateUuidV7()
    const blocks = noteBlocks([
      { valueId: healthId, label: 'Health', expressionSource: '10' },
      { valueId: bonusId, label: 'Bonus', expressionSource: 'max(2, 4)' },
      {
        valueId: totalId,
        label: 'Total',
        expressionSource: `${noteValueReference(healthId)} + ${noteValueReference(bonusId)} * 2`,
      },
    ])

    const first = evaluateNoteValues(extractNoteValues(blocks))
    expect(first.get(totalId)).toMatchObject({ status: 'ok', value: 18, formatted: '18' })

    const renamed = noteBlocks([
      { valueId: healthId, label: 'Hit points', expressionSource: '10' },
      { valueId: bonusId, label: 'Modifier', expressionSource: 'max(2, 4)' },
      {
        valueId: totalId,
        label: 'Total',
        expressionSource: `${noteValueReference(healthId)} + ${noteValueReference(bonusId)} * 2`,
      },
    ])
    expect(evaluateNoteValues(extractNoteValues(renamed)).get(totalId)).toMatchObject({
      status: 'ok',
      value: 18,
    })
  })

  it('reports cycles, invalid identities, and arithmetic errors', () => {
    const firstId = generateUuidV7()
    const secondId = generateUuidV7()
    const blocks = noteBlocks([
      { valueId: firstId, label: 'First', expressionSource: noteValueReference(secondId) },
      { valueId: secondId, label: 'Second', expressionSource: noteValueReference(firstId) },
      { valueId: 'legacy-id' as UuidV7, label: 'Legacy', expressionSource: '1' },
      { valueId: generateUuidV7(), label: 'Bad math', expressionSource: '4 / 0' },
    ])

    const values = [...evaluateNoteValues(extractNoteValues(blocks)).values()]
    expect(values.filter((value) => value.status === 'error')).toHaveLength(4)
    expect(values.some((value) => value.error?.includes('cyclic'))).toBe(true)
    expect(values.some((value) => value.error?.includes('UUIDv7'))).toBe(true)
    expect(values.some((value) => value.error === 'Division by zero')).toBe(true)
  })
})

function noteBlocks(
  values: ReadonlyArray<{ valueId: UuidV7; label: string; expressionSource: string }>,
): Array<NoteBlock> {
  return [
    {
      id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
      type: 'paragraph',
      props: {},
      content: values.map((props) => ({ type: 'value' as const, props })),
    },
  ]
}
