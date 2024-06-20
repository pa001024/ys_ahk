import { yoga } from "@elysiajs/graphql-yoga"
import { buildSchema } from "drizzle-graphql"
import { db } from "."
import { GraphQLObjectType, GraphQLSchema } from "graphql"
import { typeDefs, resolvers } from "./mod"
import { jwtToken } from "./mod"
import { useSofa } from "@graphql-yoga/plugin-sofa"
import jwt from "jsonwebtoken"
import pkg from "../../package.json"

export const genSchema = () => {
    const { entities } = buildSchema(db, { mutations: false })

    const root = new GraphQLSchema({
        query: new GraphQLObjectType({
            name: "Query",
            fields: {
                users: entities.queries.users,
                msgs: entities.queries.msgs,
                rooms: entities.queries.rooms,
            },
        }),
        types: [...Object.values(entities.types), ...Object.values(entities.inputs)],
    })
    return {
        typeDefs: [root, ...typeDefs],
        resolvers: {
            Query: {
                users: entities.queries.users,
                msgs: entities.queries.msgs,
                rooms: entities.queries.rooms,
                ...resolvers.Query,
            },
            Mutation: {
                ...resolvers.Mutation,
            },
        },
    }
}

export function yogaPlugin() {
    return yoga({
        ...genSchema(),
        context: (ctx) => {
            const token = ctx.request.headers.get("Authorization")
            if (token) {
                const user = jwt.verify(token, jwtToken)
                return { user }
            }
            return {
                user: { id: "guest" },
            }
        },
        plugins: [
            useSofa({
                basePath: "/rest",
                swaggerUI: {
                    spec: {
                        info: {
                            title: "WeYS API",
                            version: pkg.version,
                        },
                    },
                    endpoint: "/swagger",
                },
            }),
        ],
        graphiql: {
            subscriptionsProtocol: "WS", // use WebSockets instead of SSE
        },
    })
}
