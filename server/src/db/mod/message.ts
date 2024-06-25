import type { CreateMobius, Resolver } from "graphql-mobius"
import { eq } from "drizzle-orm"
import { Repeater } from "graphql-yoga"
import { pubsub } from "../../rt/pubsub"
import { Context } from "../yoga"
import { db, schema } from ".."

export const typeDefs = /* GraphQL */ `
    type Query {
        msgs(room_id: String!, limit: Int, offset: Int): [Msg!]!
    }
    type Mutation {
        sendMessage(room_id: String!, content: String!): Msg
        editMessage(msg_id: String!, content: String!): Msg
    }
    type Subscription {
        newMessage(room_id: String!): Msg!
        msgEdited(room_id: String!): Msg!
    }

    type Msg {
        id: String!
        room_id: String!
        user_id: String!
        content: String!
        edited: Int
        createdAt: String
        updateAt: String
        user: User!
    }
`

export const resolvers = {
    Query: {
        msgs: async (parent, { room_id, limit, offset }, context, info) => {
            if (!context.user) return []

            const last = await db.query.msgs.findMany({
                with: {
                    user: true,
                },
                where: eq(schema.msgs.room_id, room_id),
                limit,
                offset,
                orderBy: (t, { desc, sql }) => desc(sql`rowid`),
            })

            return last.reverse()
        },
    },
    Mutation: {
        sendMessage: async (parent, { room_id, content }, { user }) => {
            if (!user) return null
            // TODO: check if user is in the room
            const user_id = user.id
            const rst = (
                await db
                    .insert(schema.msgs)
                    .values({
                        room_id,
                        user_id,
                        content,
                    })
                    .onConflictDoNothing()
                    .returning()
            )[0]
            if (rst) {
                const msg = await db.query.msgs.findFirst({
                    with: { user: true },
                    where: eq(schema.msgs.id, rst.id),
                })
                pubsub.emit(`r:${room_id}:msg`, msg as any)
                return rst
            }
            return null
        },

        editMessage: async (parent, { msg_id, content }, { user }) => {
            if (!user) return null
            const msg = (await db.select().from(schema.msgs).where(eq(schema.msgs.id, msg_id)))[0]
            if (!msg || msg.user_id !== user.id) return null
            const updated_msg = (
                await db
                    .update(schema.msgs)
                    .set({ content, edited: (msg.edited ?? 0) + 1 })
                    .where(eq(schema.msgs.id, msg_id))
                    .returning()
            )[0]

            return updated_msg
        },
    },
    Subscription: {
        newMessage: async (parent, { room_id }, _context, _info) => {
            return new Repeater((push, stop) => {
                const handler = (msg: any) => {
                    push({ newMessage: msg })
                }
                pubsub.on(`r:${room_id}:msg`, handler)
                stop.then(() => pubsub.off(`r:${room_id}:msg`, handler))
            }) as any
        },
        msgEdited: async (parent, { room_id }, _context, _info) => {
            return new Repeater((push, stop) => {
                const handler = (msg: any) => {
                    push({ msgEdited: msg })
                }
                pubsub.on(`r:${room_id}:edited`, handler)
                stop.then(() => pubsub.off(`r:${room_id}:edited`, handler))
            }) as any
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
