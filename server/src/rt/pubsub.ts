import mitt from "mitt"
import type { msgs } from "../db/schema"

type PubSubEvents = {
    [K in `r:${string}:msg`]: (message: typeof msgs.$inferSelect) => void
}

export const pubsub = mitt<PubSubEvents>()
