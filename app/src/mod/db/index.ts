import Dexie from "dexie"
import type { DBTable, TypedDB } from "dexie"

export interface User extends DBTable {
    name: string
}

export interface Statistics extends DBTable {
    name: string
    age: number
    friends: number
}

interface DB {
    statistics: Statistics
    users: User
}

import { SHA1, enc } from "crypto-js"
export function pkey(str: string) {
    return enc.Base64.stringify(SHA1(str))
}

const db = new Dexie("Database") as unknown as TypedDB<DB>

// indexd props declaration:

db.version(1).stores({
    statistics: "++id, name",
    users: "++id, name, age",
})

export { db }
