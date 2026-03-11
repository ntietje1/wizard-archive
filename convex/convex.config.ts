import prosemirrorSync from '@convex-dev/prosemirror-sync/convex.config.js'
import betterAuth from '@convex-dev/better-auth/convex.config'
import resend from '@convex-dev/resend/convex.config.js'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(prosemirrorSync)
app.use(betterAuth)
app.use(resend)

export default app
