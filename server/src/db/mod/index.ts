import { typeDefs as userSchema, resolvers as userResolvers } from "./user"
import { typeDefs as messageSchema, resolvers as messageResolvers } from "./message"
import { typeDefs as roomSchema, resolvers as roomResolvers } from "./room"

export function schemaWith(ctx: any) {
    const typeDefs = [userSchema, messageSchema, roomSchema]
    const resolvers = mergeResolvers(userResolvers, messageResolvers, roomResolvers)

    function mergeResolvers(...items: any[]) {
        const resolvers = {
            Query: {} as any,
            Mutation: {} as any,
            Subscription: {} as any,
        }
        items.forEach((item) => {
            if (typeof item === "function") {
                item = item(ctx)
            }
            if (typeof item === "object") {
                Object.keys(item).forEach((key: string) => {
                    if (key === "Query" || key === "Mutation" || key === "Subscription") {
                        Object.assign(resolvers[key], item[key])
                    }
                })
            }
        })
        return resolvers
    }
    return { typeDefs, resolvers }
}

// util
export const getSubSelection = (info: any, subKey: string = "msgs") => {
    if (info.fieldNodes.length > 0) {
        const field = info.fieldNodes[0]
        if (field.selectionSet) {
            for (const selection of field.selectionSet.selections) {
                if (selection.name.value === subKey) {
                    return selection
                }
            }
        }
    }
    return null
}
