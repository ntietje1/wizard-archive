export const getOrigin = () => {
  const origin = (import.meta as any).env.VITE_SITE_URL!
  if (!origin) {
    throw new Error('VITE_SITE_URL is not set')
  }
  return origin
}
