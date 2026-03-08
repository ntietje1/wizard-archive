import prosemirrorSync from '@convex-dev/prosemirror-sync/convex.config.js'
import betterAuth from '@convex-dev/better-auth/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(prosemirrorSync)
app.use(betterAuth)

export default app
