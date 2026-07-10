import { useDndStore } from '../store'

export function resetDndStore() {
  useDndStore.setState(useDndStore.getInitialState(), true)
}
