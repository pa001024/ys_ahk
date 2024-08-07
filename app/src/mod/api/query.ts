import { gql, type AnyVariables, type OperationContext } from "@urql/vue"
import { gqClient } from "./graphql"

function extractType<T extends string>(gqlQuery: T) {
    const match = gqlQuery.match(/query[\s\S]*?\s(\w+?)\s*\(/m)
    if (match) {
        return match[1]
    }
    return ""
}

function namedQuery<R = { id: string }, G extends string = string>(gqlQuery: G) {
    const name = extractType(gqlQuery)
    const query = gql(gqlQuery)
    return async (variables?: AnyVariables, context?: Partial<OperationContext> | undefined) => {
        const raw = await gqClient.query(query, variables, context).toPromise()
        return raw?.data?.[name] as R
    }
}

export const msgCountQuery = namedQuery<number>(/* GraphQL */ `
    query ($roomId: String!) {
        msgCount(roomId: $roomId)
    }
`)
