import type { CreateMobius, Resolver } from "graphql-mobius"
import { db, schema } from ".."
import { Context } from "."
import { eq } from "drizzle-orm"

export const typeDefs = /* GraphQL */ `
    type Mutation {
        sendMessage(room_id: String!, content: String!): SendMessageResult!
        modifyMessage(msg_id: String!, content: String!): ModifyMessageResult!
    }

    type SendMessageResult {
        success: Boolean!
        message: String!
        msg: MsgItem
    }

    type ModifyMessageResult {
        success: Boolean!
        message: String!
        msg: MsgItem
    }
`

export const resolvers = {
    Query: {},
    Mutation: {
        sendMessage: async (parent, { room_id, content }, { user }) => {
            if (!user) return { success: false, message: "You must be logged in to send a message" }
            // TODO: check if user is in the room
            const user_id = user.id
            const msg = (
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
            return { success: true, message: "Message sent successfully", msg }
        },

        modifyMessage: async (parent, { msg_id, content }, { user }) => {
            if (!user) return { success: false, message: "You must be logged in to modify a message" }
            const msg = (await db.select().from(schema.msgs).where(eq(schema.msgs.id, msg_id)))[0]
            if (!msg) return { success: false, message: "Message not found" }
            if (msg.user_id !== user.id) return { success: false, message: "You are not authorized to modify this message" }
            const updated_msg = (
                await db
                    .update(schema.msgs)
                    .set({ content, edited: (msg.edited ?? 0) + 1 })
                    .where(eq(schema.msgs.id, msg_id))
                    .returning()
            )[0]
            return { success: true, message: "Message modified successfully", msg: updated_msg }
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
