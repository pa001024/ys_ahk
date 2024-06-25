import mitt from "mitt"
import type { msgs } from "../db/schema"

type RoomEvent = {
    msg: typeof msgs.$inferSelect
    edited: typeof msgs.$inferSelect
}

type REvents<T extends Record<string, unknown>, L extends string = keyof T extends string ? keyof T : never> = {
    [K in `r:${string}:${L}`]: (message: T[L]) => void
}

type PubSubEvents = REvents<RoomEvent>

export const pubsub = mitt<PubSubEvents>()
