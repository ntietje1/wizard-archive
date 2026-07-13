import { v } from 'convex/values'
import { folderValidator } from '../folders/baseSchema'
import { anySidebarItemValidator } from '../sidebarItems/schema/anySidebarItemValidator'
import { mapPinValidatorFields, mapValidatorFields } from './baseSchema'

const mapWithContentValidatorFields = mapValidatorFields

const mapPinWithItemValidatorFields = {
  ...mapPinValidatorFields,
  item: v.nullable(anySidebarItemValidator),
}

export const mapWithContentValidator = v.object({
  ...mapWithContentValidatorFields,
  ancestors: v.array(folderValidator),
  pins: v.array(v.object(mapPinWithItemValidatorFields)),
})
