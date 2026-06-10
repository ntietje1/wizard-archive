import { useMapRenderPins } from '~/features/editor/components/viewer/map/use-map-render-pins'
import type { EmbeddedMapStateResolver } from '../context/embedded-map-state-resolution'

export const LiveEmbeddedMapStateResolver: EmbeddedMapStateResolver = ({ children, map }) => {
  const state = useMapRenderPins(map)

  return <>{children(state)}</>
}
