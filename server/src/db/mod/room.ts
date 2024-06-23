import type { CreateMobius, Resolver } from "graphql-mobius"
import { db, schema } from ".."
import { Context } from "../yoga"
import { like } from "drizzle-orm"
import { getSubSelection } from "."

export const typeDefs = /* GraphQL */ `
    type Mutation {
        createRoom(data: RoomsCreateInput!): RoomsCreateResult!
    }

    type Query {
        rooms(name_like: String, limit: Int, offset: Int): [Room!]!
        timeOffset(t: Int!): Int!
    }

    type Room {
        id: String!
        name: String!
        type: String
        owner_id: String!
        max_users: Int
        createdAt: String
        updateAt: String

        owner: User
        msgs(limit: Int): [Msg!]
    }

    type RoomFilter {
        name: String
        type: String
        owner_id: String
    }

    input RoomsCreateInput {
        name: String!
        type: String
        max_users: Int
    }

    type RoomsCreateResult {
        success: Boolean!
        message: String!
        room: Room
    }
`
export const resolvers = {
    Query: {
        rooms: async (parent, args, context, info: any) => {
            if (!context.user) return []
            const msgsSel = getSubSelection(info, "msgs")
            const rst = await db.query.rooms.findMany({
                with: {
                    owner: true,
                    msgs: msgsSel
                        ? {
                              limit: msgsSel.arguments.find((arg: any) => arg.name.value === "limit")?.value.value || 1,
                              orderBy: (t, { desc, sql }) => desc(sql`rowid`),
                              with: { user: true },
                          }
                        : void 0,
                },
                where: (args?.name_like && like(schema.rooms.name, args.name_like)) || void 0,
                limit: args?.limit,
                offset: args?.offset,
                orderBy: (t, { desc, sql }) => desc(t.updateAt),
            })

            return rst
        },
        timeOffset: async (parent, { t }, context, info) => {
            return Date.now() - t
        },
    },
    Mutation: {
        createRoom: async (parent, { data: { name, type, max_users } }, context, info: any) => {
            const user = context.user
            if (!user) return { success: false, message: "Unauthorized" }
            const rst = (
                await db
                    .insert(schema.rooms)
                    .values({
                        name,
                        type,
                        max_users,
                        owner_id: user.id,
                    })
                    .onConflictDoNothing()
                    .returning()
            )[0]
            if (rst) {
                const room = await db.query.rooms.findFirst({
                    with: { owner: true },
                })
                if (room) {
                    return { success: true, message: "Room created successfully", room }
                }
            }
            return { success: false, message: "Room already exists" }
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
