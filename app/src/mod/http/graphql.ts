import { Client, fetchExchange, subscriptionExchange, gql } from "@urql/vue"
import { useSettingStore } from "../state/setting"
import { useLocalStorage } from "@vueuse/core"
import { SubscribePayload, createClient } from "graphql-ws"
import { offlineExchange } from "@urql/exchange-graphcache"
import { makeDefaultStorage } from "@urql/exchange-graphcache/default-storage"
import { nanoid } from "nanoid"

const storage = makeDefaultStorage({
    idbName: "graphcache-v3", // The name of the IndexedDB database
    maxAge: 7, // The maximum age of the persisted data in days
})

const cacheExchange = offlineExchange({
    storage,
    updates: {
        Mutation: {
            sendMessage: (result: any, args, cache, _info) => {
                if (!result.sendMessage?.success) return
                const fragment = gql`
                    fragment _ on Room {
                        id

                        msgs(limit: 1) {
                            id
                            content
                            user {
                                id
                                name
                                qq
                            }
                        }
                    }
                `
                const msg = result.sendMessage.msg
                const token = useSettingStore().token
                const user = JSON.parse(atob(token.split(".")[1]))
                cache.writeFragment(fragment, {
                    id: args.room_id,
                    msgs: [
                        {
                            __typename: "Msg",
                            id: msg.id,
                            content: args.content,
                            createdAt: msg.createdAt,
                            user: {
                                __typename: "User",
                                id: user.id,
                                name: user.name,
                                qq: user.qq,
                            },
                        },
                    ],
                })
            },
        },
    },
    optimistic: {},
})

export const gqClientHttp = new Client({
    url: `${useLocalStorage("setting_endpoint", "http://localhost:8887").value}/graphql`,
    exchanges: [cacheExchange, fetchExchange],
    fetchSubscriptions: true,
    fetchOptions: () => {
        const token = useSettingStore().token
        return {
            headers: { token },
        }
    },
})

export const gqClient = (function () {
    const url = `${useLocalStorage("setting_endpoint", "http://localhost:8887").value}/graphql`
    const ws = createClient({
        url: url.replace("http", "ws"),
        connectionParams: () => {
            const token = useSettingStore().token
            return {
                token,
            }
        },
        generateID: () => nanoid(),
    })
    return new Client({
        url,
        exchanges: [
            cacheExchange,
            fetchExchange,
            subscriptionExchange({
                forwardSubscription(operation) {
                    return {
                        subscribe: (sink) => {
                            const dispose = ws.subscribe(operation as SubscribePayload, sink)
                            return {
                                unsubscribe: dispose,
                            }
                        },
                    }
                },
            }),
        ],
        fetchOptions: () => {
            const token = useSettingStore().token
            return {
                headers: { token },
            }
        },
    })
})()

export { gql } from "graphql-tag"
