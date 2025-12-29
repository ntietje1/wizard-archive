import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import CharacterTagForm from './character-tag-form.tsx'
import type { TagDialogProps } from '../base-tag-form/types.ts'
import type { Character } from 'convex/characters/types.ts'

export default function CharacterTagDialog(props: TagDialogProps<Character>) {
  const character = props.mode === 'edit' ? props.tag : null

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      campaignId={props.campaignId}
      categoryId={props.categoryId}
    >
      <CharacterTagForm
        mode={props.mode}
        character={character}
        campaignId={props.campaignId}
        categoryId={props.categoryId}
        parentId={props.parentId}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </TagFormDialog>
  )
}
