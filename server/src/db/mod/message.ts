import type { CreateMobius, Resolver } from "graphql-mobius"
import { and, eq } from "drizzle-orm"
import { Context } from "../yoga"
import { db, schema } from ".."
import { getSubSelection } from "."

export const typeDefs = /* GraphQL */ `
    type Query {
        msgs(roomId: String!, limit: Int, offset: Int): [Msg!]!
    }
    type Mutation {
        sendMessage(roomId: String!, content: String!): Msg
        editMessage(msgId: String!, content: String!): Msg
        addReaction(msgId: String!, reaction: String!): Msg
    }
    type Subscription {
        newMessage(roomId: String!): Msg!
        newReaction(roomId: String!): Reaction!
        msgEdited(roomId: String!): Msg!
        userJoined(roomId: String!): User!
        userLeaved(roomId: String!): User!
    }

    type Msg {
        id: String!
        roomId: String!
        userId: String!
        content: String!
        edited: Int
        createdAt: String
        updateAt: String
        user: User!
        reactions: [Reaction!]
    }

    type Reaction {
        id: String!
        msgId: String!
        count: Int
        users: [User!]
        createdAt: String
    }
`

export const resolvers = {
    Query: {
        msgs: async (parent, { roomId, limit, offset }, context, info) => {
            if (!context.user) return []

            const user = getSubSelection(info, "user")
            const reactions = getSubSelection(info, "reactions")
            const last = await db.query.msgs.findMany({
                with: {
                    user: user ? true : void 0,
                    reactions: reactions ? true : void 0,
                },
                where: eq(schema.msgs.roomId, roomId),
                limit,
                offset,
                orderBy: (t, { desc, sql }) => desc(sql`rowid`),
            })
            return last.reverse()
        },
    },
    Mutation: {
        sendMessage: async (parent, { roomId, content }, { user, pubsub }) => {
            if (!user) return null
            // TODO: check if user is in the room
            const userId = user.id
            const rst = (
                await db
                    .insert(schema.msgs)
                    .values({
                        roomId,
                        userId,
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
                if (msg) {
                    pubsub.publish("newMessage", msg.roomId, { newMessage: msg })
                }
                return rst
            }
            return null
        },

        addReaction: async (parent, { msgId, reaction }, { user }) => {
            if (!user) return null
            const userId = user.id
            // 查询是否已经存在该 reaction
            let existReaction = await db.query.reactions.findFirst({
                where: and(eq(schema.reactions.msgId, msgId), eq(schema.userReactions.userId, userId)),
            })
            // 判断当前userReactions表是否包含我
            if (existReaction) {
                const hasMe = await db.query.userReactions.findFirst({
                    where: and(eq(schema.userReactions.reactionId, existReaction.id), eq(schema.userReactions.userId, userId)),
                })
                if (hasMe) {
                    await db.delete(schema.userReactions).where(and(eq(schema.userReactions.reactionId, hasMe.reactionId), eq(schema.userReactions.userId, userId)))
                } else {
                    await db.insert(schema.userReactions).values({
                        userId,
                        reactionId: existReaction.id,
                    })
                }
            } else {
                existReaction = (
                    await db
                        .insert(schema.reactions)
                        .values({
                            msgId,
                            content: reaction,
                        })
                        .returning()
                )[0]
                await db.insert(schema.userReactions).values({
                    userId,
                    reactionId: existReaction.id,
                })
            }
            return existReaction
        },

        editMessage: async (parent, { msgId, content }, { user, pubsub }) => {
            if (!user) return null
            const msg = (await db.select().from(schema.msgs).where(eq(schema.msgs.id, msgId)))[0]
            if (!msg || msg.userId !== user.id) return null
            const updated_msg = (
                await db
                    .update(schema.msgs)
                    .set({ content, edited: (msg.edited ?? 0) + 1 })
                    .where(eq(schema.msgs.id, msgId))
                    .returning()
            )[0]
            pubsub.publish("msgEdited", msg.roomId, { msgEdited: updated_msg })

            return updated_msg
        },
    },
    Subscription: {
        newMessage: async (parent, { roomId }, { user, pubsub }, info) => {
            if (!user) return null
            return pubsub.subscribe("newMessage", roomId) as any
        },
        newReaction: async (parent, { roomId }, { user, pubsub }, info) => {
            if (!user) return null
            return pubsub.subscribe("newReaction", roomId) as any
        },
        msgEdited: async (parent, { roomId }, { user, pubsub }, info) => {
            if (!user) return null
            return pubsub.subscribe("msgEdited", roomId) as any
        },
        userJoined: async (parent, { roomId }, { user, pubsub }, info) => {
            if (!user) return null
            return pubsub.subscribe("userJoined", roomId) as any
        },
        userLeaved: async (parent, { roomId }, { user, pubsub }, info) => {
            if (!user) return null
            return pubsub.subscribe("userLeaved", roomId) as any
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>

export type MsgGQL = CreateMobius<typeof typeDefs>
