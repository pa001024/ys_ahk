import type { CreateMobius, Resolver } from "graphql-mobius"
import { db, schema } from ".."
import { Context, jwtToken } from "."
import { eq, sql } from "drizzle-orm"
import jwt from "jsonwebtoken"

export const typeDefs = /* GraphQL */ `
    type Mutation {
        createRoom(data: RoomsCreateInput!): RoomsCreateResult!
        updatePassword(old_password: String!, new_password: String!): PasswordsUpdateResult!
        login(email: String!, password: String!): UserLoginResult!
        register(name: String!, qq: String!, email: String!, password: String!): UserLoginResult!
        updateUserMeta(data: UsersUpdateInput!): UsersUpdateResult!
    }

    type Query {
        me: UsersItem
    }

    type UserLoginResult {
        success: Boolean!
        message: String!
        token: String
        user: UsersItem
    }

    type RoomsCreateResult {
        success: Boolean!
        message: String!
        room: RoomsItem
    }

    type PasswordsUpdateResult {
        success: Boolean!
        message: String!
    }

    input RoomsCreateInput {
        name: String!
        type: String
        max_users: Int
    }

    input UsersUpdateInput {
        name: String
        qq: String
    }

    type UsersUpdateResult {
        success: Boolean!
        message: String!
        user: UsersItem
    }
`

export const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if (!context.user) return null
            const user = (
                await db
                    .select()
                    .from(schema.users)
                    .where(sql`id = ${context.user.id}`)
            )[0]
            return user
        },
    },
    Mutation: {
        register: async (parent, { name, qq, email, password }, context) => {
            const user = (await db.insert(schema.users).values({ name, qq, email }).onConflictDoNothing().returning())[0]
            if (user) {
                const token = jwt.sign({ id: user.id }, jwtToken)
                const hash = await Bun.password.hash(password)
                await db.insert(schema.passwords).values({ hash, user_id: user.id }).onConflictDoUpdate({ target: schema.passwords.id, set: { hash } })
                return { success: true, message: "User created successfully", token, user }
            }
            return { success: false, message: "User already exists" }
        },
        login: async (parent, { email, password }, context) => {
            const user = (
                await db
                    .select({
                        id: schema.users.id,
                        name: schema.users.name,
                        email: schema.users.email,
                        qq: schema.users.qq,
                        roles: schema.users.roles,
                        createdAt: schema.users.createdAt,
                        updateAt: schema.users.updateAt,
                        hash: schema.passwords.hash,
                    })
                    .from(schema.users)
                    .leftJoin(schema.passwords, eq(schema.users.id, schema.passwords.user_id))
                    .where(sql`email = ${email}`)
            )[0]
            if (user) {
                const isMatch = user.hash ? await Bun.password.verify(password, user.hash) : true
                if (isMatch) {
                    const token = jwt.sign({ id: user.id }, jwtToken)
                    await db
                        .insert(schema.logins)
                        .values({ user_id: user.id, ip: context.request.headers.get("x-real-ip"), ua: context.request.headers.get("user-agent") })
                        .onConflictDoNothing()
                    return { success: true, message: "Login successful", token, user }
                }
            }
            return { success: false, message: "Invalid email or password" }
        },
        createRoom: async (parent, { data: { name, type, max_users } }, { user }) => {
            if (!user) return { success: false, message: "Unauthorized" }
            const room = (
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
            if (room) {
                return { success: true, message: "Room created successfully", room }
            }
            return { success: false, message: "Room already exists" }
        },
        updatePassword: async (parent, { old_password, new_password }, context) => {
            if (!context.user) return { success: false, message: "Unauthorized" }
            const user = await db
                .select({ id: schema.users.id })
                .from(schema.users)
                .where(sql`id = ${context.user.id}`)
            if (user[0]) {
                const old_pw = await db
                    .select({ hash: schema.passwords.hash })
                    .from(schema.passwords)
                    .where(sql`id = ${context.user.id}`)

                if (!old_pw || !old_pw[0] || !old_pw[0].hash) return { success: false, message: "User not found" }
                const isMatch = await Bun.password.verify(old_password, old_pw[0].hash)
                if (!isMatch) return { success: false, message: "Incorrect password" }
                const hash = await Bun.password.hash(new_password)
                await db
                    .update(schema.passwords)
                    .set({ hash })
                    .where(sql`id = ${context.user.id}`)
                return { success: true, message: "Password updated successfully" }
            }
            return { success: false, message: "User not found" }
        },
        updateUserMeta: async (parent, { data }, context) => {
            if (!context.user) return { success: false, message: "Unauthorized" }
            const user = (
                await db
                    .update(schema.users)
                    .set(data)
                    .where(sql`id = ${context.user.id}`)
                    .returning()
            )[0]
            if (user) {
                return { success: true, message: "User updated successfully", user }
            }
            return { success: false, message: "User not found" }
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
