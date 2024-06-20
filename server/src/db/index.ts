import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import * as schema from "./schema"
import { migrateDatabase } from "./migrate"
import { eq } from "drizzle-orm"

export const db = drizzle(new Database("data.db"), {
    schema,
})

migrateDatabase()

export { schema }
export { yogaPlugin } from "./yoga"

export namespace Model {
    export class User {
        static async get(id: string) {
            return (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
        }
    }

    export class Room {
        static async get(id: string) {
            return (await db.select().from(schema.rooms).where(eq(schema.rooms.id, id)))[0]
        }
        static async getAll() {
            return await db.select().from(schema.rooms)
        }
    }
}
