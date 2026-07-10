import { use } from 'react'
import { BlockShareMenuContext } from './menu-state'

export function useBlockShareMenu() {
  const context = use(BlockShareMenuContext)
  if (!context) {
    throw new Error('useBlockShareMenu must be used within BlockShareMenuProvider.')
  }
  return context
}
