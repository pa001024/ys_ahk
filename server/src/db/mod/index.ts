import { machineIdSync } from "node-machine-id"
import { typeDefs as userSchema, resolvers as userResolvers } from "./user"
import { YogaInitialContext } from "graphql-yoga"

export type Context = YogaInitialContext & {
    user?: {
        id: string
    }
}

export const jwtToken = `${machineIdSync()}`

export const typeDefs = [userSchema]
export const resolvers = mergeResolvers(userResolvers)

function mergeResolvers(...items: any[]) {
    const resolvers = {
        Query: {} as any,
        Mutation: {} as any,
    }
    items.forEach((item) => {
        if (typeof item === "object") {
            Object.keys(item).forEach((key: string) => {
                if (key === "Query" || key === "Mutation") {
                    Object.assign(resolvers[key], item[key])
                }
            })
        }
    })
    return resolvers
}
