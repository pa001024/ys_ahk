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
                    if (key === "Query" || key === "Mutation") {
                        Object.assign(resolvers[key], item[key])
                    } else if (key === "Subscription") {
                        for (const subKey in item[key]) {
                            resolvers[key][subKey] = { subscribe: item[key][subKey] }
                        }
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
                    return new SubSelection(selection)
                }
            }
        }
    }
    return null
}

export class SubSelection {
    constructor(public selection: any) {}

    hasArg(name: string) {
        return this.selection.arguments.some((arg: any) => arg.name.value === name)
    }

    getArg(name: string) {
        const arg = this.selection.arguments.find((arg: any) => arg.name.value === name)
        return arg ? arg.value.value : null
    }
}
