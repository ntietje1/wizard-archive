import type { TagDialogProps } from '../base-tag-form/types.ts'
import { TagFormDialog } from '../base-tag-form/tag-form-dialog.tsx'
import CharacterTagForm from './character-tag-form.tsx'
import type { Character } from 'convex/characters/types.ts'

export default function CharacterTagDialog(props: TagDialogProps<Character>) {
  const character = props.mode === 'edit' ? props.tag : undefined

  return (
    <TagFormDialog
      mode={props.mode}
      isOpen={props.isOpen}
      onClose={props.onClose}
      config={props.config}
    >
      <CharacterTagForm
        mode={props.mode}
        character={character}
        config={props.config}
        navigateToNote={props.navigateToNote}
        parentFolderId={props.parentFolderId}
        isOpen={props.isOpen}
        onClose={props.onClose}
      />
    </TagFormDialog>
  )
}
