// for `bun gen`

import { sqliteTable, text, integer, foreignKey, uniqueIndex } from "drizzle-orm/sqlite-core"
import { nanoid } from "nanoid"
import { relations } from "drizzle-orm"

function now() {
    return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
}

/** 用户 */
export const users = sqliteTable(
    "users",
    {
        id: text("id").$default(nanoid).primaryKey(),
        email: text("email").notNull().unique(),
        name: text("name"),
        qq: text("qq"),
        roles: text("roles"),
        createdAt: text("createdAt").$default(now),
        updateAt: text("updateAt").$onUpdate(now),
    },
    (users) => ({
        emailIdx: uniqueIndex("email_idx").on(users.email),
    })
)

export const userRelations = relations(users, ({ one }) => ({
    password: one(passwords, { fields: [users.id], references: [passwords.user_id] }),
}))

/** 登录 */
export const logins = sqliteTable(
    "logins",
    {
        id: text("id").$default(nanoid).primaryKey(),
        user_id: text("user_id").notNull(),
        ip: text("ip"),
        ua: text("ua"),
        createdAt: text("createdAt").$default(now),
    },
    (logins) => ({
        user_idFk: foreignKey({ columns: [logins.user_id], foreignColumns: [users.id] }),
    })
)

export const loginsRelations = relations(logins, ({ one }) => ({
    user: one(users, { fields: [logins.user_id], references: [users.id] }),
}))

/** 密码 */
export const passwords = sqliteTable(
    "passwords",
    {
        id: text("id").$default(nanoid).primaryKey(),
        user_id: text("user_id").notNull(),
        hash: text("hash").notNull(),
        createdAt: text("createdAt").$default(now),
        updateAt: text("updateAt").$onUpdate(now),
    },
    (passwords) => ({
        user_idFk: foreignKey({ columns: [passwords.user_id], foreignColumns: [users.id] }),
    })
)

/** 房间 */
export const rooms = sqliteTable(
    "rooms",
    {
        id: text("id").$default(nanoid).primaryKey(),
        name: text("name").notNull(),
        type: text("type"),
        owner_id: text("owner_id").notNull(),
        max_users: integer("max_users"),
        createdAt: text("createdAt").$default(now),
        updateAt: text("updateAt").$onUpdate(now),
    },
    (rooms) => ({
        owner_idFk: foreignKey({ columns: [rooms.owner_id], foreignColumns: [users.id] }),
    })
)

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    owner: one(users, { fields: [rooms.owner_id], references: [users.id] }),
    msgs: many(msgs, { relationName: "room" }),
    views: many(roomViews, { relationName: "room" }),
}))

/** 房间查看 */
export const roomViews = sqliteTable(
    "roomViews",
    {
        id: text("id").$default(nanoid).primaryKey(),
        room_id: text("room_id").notNull(),
        user_id: text("user_id").notNull(),
        createdAt: text("createdAt").$default(now),
        updateAt: text("updateAt").$onUpdate(now),
    },
    (roomViews) => ({
        room_idFk: foreignKey({ columns: [roomViews.room_id], foreignColumns: [rooms.id] }),
        user_idFk: foreignKey({ columns: [roomViews.user_id], foreignColumns: [users.id] }),
    })
)

export const roomViewsRelations = relations(roomViews, ({ one }) => ({
    room: one(rooms, { fields: [roomViews.room_id], references: [rooms.id], relationName: "room" }),
    user: one(users, { fields: [roomViews.user_id], references: [users.id], relationName: "user" }),
}))

/** 消息 */
export const msgs = sqliteTable(
    "msgs",
    {
        id: text("id").$default(nanoid).primaryKey(),
        room_id: text("room_id").notNull(),
        user_id: text("user_id").notNull(),
        content: text("content").notNull(),
        edited: integer("edited").$default(() => 0),
        createdAt: text("createdAt").$default(now),
        updateAt: text("updateAt").$onUpdate(now),
    },
    (msgs) => ({
        room_idFk: foreignKey({ columns: [msgs.room_id], foreignColumns: [rooms.id] }),
        user_idFk: foreignKey({ columns: [msgs.user_id], foreignColumns: [users.id] }),
    })
)

export const msgsRelations = relations(msgs, ({ one, many }) => ({
    room: one(rooms, { fields: [msgs.room_id], references: [rooms.id], relationName: "room" }),
    user: one(users, { fields: [msgs.user_id], references: [users.id], relationName: "user" }),
}))
