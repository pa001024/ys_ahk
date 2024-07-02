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
        createdAt: text("created_at").$default(now),
        updateAt: text("update_at").$onUpdate(now),
    },
    (users) => ({
        emailIdx: uniqueIndex("email_idx").on(users.email),
    })
)

export const userRelations = relations(users, ({ one }) => ({
    password: one(passwords, { fields: [users.id], references: [passwords.userId] }),
}))

/** 登录 */
export const logins = sqliteTable("logins", {
    id: text("id").$default(nanoid).primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    ip: text("ip"),
    ua: text("ua"),
    createdAt: text("created_at").$default(now),
})

export const loginsRelations = relations(logins, ({ one }) => ({
    user: one(users, { fields: [logins.userId], references: [users.id] }),
}))

/** 密码 */
export const passwords = sqliteTable("passwords", {
    id: text("id").$default(nanoid).primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    hash: text("hash").notNull(),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

/** 房间 */
export const rooms = sqliteTable("rooms", {
    id: text("id").$default(nanoid).primaryKey(),
    name: text("name").notNull(),
    type: text("type"),
    ownerId: text("owner_id")
        .notNull()
        .references(() => users.id),
    maxUsers: integer("max_users"),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const roomsRelations = relations(rooms, ({ one, many }) => ({
    owner: one(users, { fields: [rooms.ownerId], references: [users.id] }),
    msgs: many(msgs, { relationName: "room" }),
    views: many(roomViews, { relationName: "room" }),
}))

/** 房间查看 */
export const roomViews = sqliteTable("room_views", {
    id: text("id").$default(nanoid).primaryKey(),
    roomId: text("room_id")
        .notNull()
        .references(() => rooms.id),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const roomViewsRelations = relations(roomViews, ({ one }) => ({
    room: one(rooms, { fields: [roomViews.roomId], references: [rooms.id] }),
    user: one(users, { fields: [roomViews.userId], references: [users.id] }),
}))

/** 消息 */
export const msgs = sqliteTable("msgs", {
    id: text("id").$default(nanoid).primaryKey(),
    roomId: text("room_id")
        .notNull()
        .references(() => rooms.id),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    content: text("content").notNull(),
    edited: integer("edited").$default(() => 0),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const msgsRelations = relations(msgs, ({ one, many }) => ({
    room: one(rooms, { fields: [msgs.roomId], references: [rooms.id], relationName: "room" }),
    user: one(users, { fields: [msgs.userId], references: [users.id], relationName: "user" }),
    reactions: many(reactions),
}))

/** 反应 */
export const reactions = sqliteTable("reactions", {
    id: text("id").$default(nanoid).primaryKey(),
    msgId: text("msg_id")
        .notNull()
        .references(() => msgs.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: text("created_at").$default(now),
})

export const reactionsRelations = relations(reactions, ({ one, many }) => ({
    msg: one(msgs, { fields: [reactions.msgId], references: [msgs.id] }),
}))

/** m2m 用户消息反应 */
export const userReactions = sqliteTable(
    "user_reactions",
    {
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        reactionId: text("reaction_id")
            .notNull()
            .references(() => reactions.id, { onDelete: "cascade" }),
        createdAt: text("created_at").$default(now),
    },
    (userReactions) => ({
        userReactionIdx: uniqueIndex("user_reaction_idx").on(userReactions.userId, userReactions.reactionId),
    })
)

export const userMsgReactionsRelations = relations(userReactions, ({ one }) => ({
    user: one(users, { fields: [userReactions.userId], references: [users.id] }),
    reaction: one(reactions, { fields: [userReactions.reactionId], references: [reactions.id] }),
}))

/** 通知 */
export const notifications = sqliteTable("notifications", {
    id: text("id").$default(nanoid).primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    type: text("type").notNull(),
    content: text("content").notNull(),
    isRead: integer("is_read").$default(() => 0),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))

/** 计划 */
export const schedules = sqliteTable("schedules", {
    id: text("id").$default(nanoid).primaryKey(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    repeatType: text("repeat_type"),
    repeatInterval: integer("repeat_interval"),
    repeatCount: integer("repeat_count"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const schedulesRelations = relations(schedules, ({ one }) => ({
    user: one(users, { fields: [schedules.userId], references: [users.id] }),
}))

/** 任务 */
export const tasks = sqliteTable("tasks", {
    id: text("id").$default(nanoid).primaryKey(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: text("status").$default(() => "todo"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id),
    createdAt: text("created_at").$default(now),
    updateAt: text("update_at").$onUpdate(now),
})

export const tasksRelations = relations(tasks, ({ one }) => ({
    user: one(users, { fields: [tasks.userId], references: [users.id] }),
}))
