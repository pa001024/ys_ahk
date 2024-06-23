import jwt from "jsonwebtoken"
import type { CreateMobius, Resolver } from "graphql-mobius"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { Context, jwtToken } from "../yoga"
import { db, schema } from ".."

export const typeDefs = /* GraphQL */ `
    type Mutation {
        updatePassword(old_password: String!, new_password: String!): PasswordsUpdateResult!
        login(email: String!, password: String!): UserLoginResult!
        guest(name: String!, qq: String): UserLoginResult!
        register(name: String!, qq: String!, email: String!, password: String!): UserLoginResult!
        updateUserMeta(data: UsersUpdateInput!): UsersUpdateResult!
    }

    type Query {
        me: User
        user(id: String!): User!
    }

    type User {
        id: String!
        email: String!
        name: String
        qq: String
        roles: String
        createdAt: String
        updateAt: String
    }

    type UserLoginResult {
        success: Boolean!
        message: String!
        token: String
        user: User
    }

    type PasswordsUpdateResult {
        success: Boolean!
        message: String!
    }

    input UsersUpdateInput {
        name: String
        qq: String
    }

    type UsersUpdateResult {
        success: Boolean!
        message: String!
        user: User
    }
`

export const resolvers = {
    Query: {
        me: async (parent, args, context) => {
            if (!context.user) return null
            return await db.query.users.findFirst({
                where: eq(schema.users.id, context.user.id),
            })
        },
        user: async (parent, { id }, context, info) => {
            if (!context.user) return []

            return (await db.query.users.findFirst({
                where: eq(schema.users.id, id),
            })) as any
        },
    },
    Mutation: {
        register: async (parent, { name, qq, email, password }, context) => {
            const user = (await db.insert(schema.users).values({ name, qq, email }).onConflictDoNothing().returning())[0]
            if (user) {
                const token = jwt.sign({ id: user.id, name, qq }, jwtToken)
                const hash = await Bun.password.hash(password)
                await db.insert(schema.passwords).values({ hash, user_id: user.id }).onConflictDoUpdate({ target: schema.passwords.id, set: { hash } })
                return { success: true, message: "User created successfully", token, user }
            }
            return { success: false, message: "User already exists" }
        },
        guest: async (parent, { name, qq }, context) => {
            const user = (
                await db
                    .insert(schema.users)
                    .values({ name, qq, email: `${nanoid()}@guest`, roles: "guest" })
                    .onConflictDoNothing()
                    .returning()
            )[0]
            if (user) {
                const token = jwt.sign({ id: user.id, name, qq }, jwtToken)
                return { success: true, message: "Guest successful", token, user }
            }
            return { success: false, message: "Guest failed" }
        },
        login: async (parent, { email, password }, context) => {
            const user = await db.query.users.findFirst({
                with: { password: true },
                where: eq(schema.users.email, email),
            })
            if (user) {
                const isMatch = user.password.hash ? await Bun.password.verify(password, user.password.hash) : true
                if (isMatch) {
                    const token = jwt.sign({ id: user.id, name: user.name, qq: user.qq }, jwtToken)
                    await db
                        .insert(schema.logins)
                        .values({ user_id: user.id, ip: context.request.headers.get("x-real-ip"), ua: context.request.headers.get("user-agent") })
                        .onConflictDoNothing()
                    return {
                        success: true,
                        message: "Login successful",
                        token,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            qq: user.qq,
                            roles: user.roles,
                            createdAt: user.createdAt,
                            updateAt: user.updateAt,
                        },
                    }
                }
            }
            return { success: false, message: "Invalid email or password" }
        },
        updatePassword: async (parent, { old_password, new_password }, context) => {
            if (!context.user || context.user.id.startsWith("g@")) return { success: false, message: "Unauthorized" }
            const user = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, context.user.id))
            if (user[0]) {
                const old_pw = await db.select({ hash: schema.passwords.hash }).from(schema.passwords).where(eq(schema.passwords.user_id, context.user.id))

                if (!old_pw || !old_pw[0] || !old_pw[0].hash) return { success: false, message: "User not found" }
                const isMatch = await Bun.password.verify(old_password, old_pw[0].hash)
                if (!isMatch) return { success: false, message: "Incorrect password" }
                const hash = await Bun.password.hash(new_password)
                await db.update(schema.passwords).set({ hash }).where(eq(schema.passwords.user_id, context.user.id))
                return { success: true, message: "Password updated successfully" }
            }
            return { success: false, message: "User not found" }
        },
        updateUserMeta: async (parent, { data }, context) => {
            if (!context.user) return { success: false, message: "Unauthorized" }
            const user = (await db.update(schema.users).set(data).where(eq(schema.users.id, context.user.id)).returning())[0]
            if (user) {
                return { success: true, message: "User updated successfully", user }
            }
            return { success: false, message: "User not found" }
        },
    },
} satisfies Resolver<CreateMobius<typeof typeDefs>, Context>
