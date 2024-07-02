import type { CreateMobius, Resolver } from "graphql-mobius"
import { db, schema } from ".."
import { Context } from "../yoga"
import { eq, like } from "drizzle-orm"
import { getSubSelection } from "."

export const typeDefs = /* GraphQL */ `
    type Mutation {
        createRoom(data: RoomsCreateInput!): Room
        deleteroom(id: String!): Boolean!
    }

    type Query {
        rooms(name_like: String, limit: Int, offset: Int): [Room!]!
        timeOffset(t: Int!): Int!
    }

    type Room {
        id: String!
        name: String!
        type: String
        ownerId: String!
        maxUsers: Int
        createdAt: String
        updateAt: String

        owner: User
        msgs(limit: Int = 1): [Msg!]
    }

    type RoomFilter {
        name: String
        type: String
        ownerId: String
    }

    input RoomsCreateInput {
        name: String!
        type: String
        maxUsers: Int
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
                              limit: msgsSel.getArg("limit") || 1,
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
        createRoom: async (parent, { data: { name, type, maxUsers } }, context, info: any) => {
            const user = context.user
            if (!user) return null
            const rst = (
                await db
                    .insert(schema.rooms)
                    .values({
                        name,
                        type,
                        maxUsers,
                        ownerId: user.id,
                    })
                    .onConflictDoNothing()
                    .returning()
            )[0]
            if (rst) {
                const room = await db.query.rooms.findFirst({
                    with: { owner: true },
                })
                return room
            }
            return null
        },
        deleteroom: async (parent, { id }, context, info) => {
            const user = context.user
            if (!user) return false
            const room = await db.query.rooms.findFirst({
                where: eq(schema.rooms.id, id),
                with: { owner: true },
            })
            if (room && room.ownerId === user.id) {
                await db.delete(schema.rooms).where(eq(schema.rooms.id, id)).execute()
                return true
            }
            return false
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
