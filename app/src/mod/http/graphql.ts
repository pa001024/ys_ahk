import { Client, cacheExchange, fetchExchange, subscriptionExchange } from "@urql/vue"
import { useSettingStore } from "../state/setting"
import { useLocalStorage } from "@vueuse/core"
import { SubscribePayload, Client as WsClient } from "graphql-ws"

export const gqClientHttp = new Client({
    url: `${useLocalStorage("setting_endpoint", "http://localhost:8887").value}/graphql`,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
        const token = useSettingStore().token
        return {
            headers: { authorization: token || "" },
        }
    },
})

export const gqClientWs = function (ws: WsClient) {
    return new Client({
        url: `${useLocalStorage("setting_endpoint", "http://localhost:8887").value}/graphql`,
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
                headers: { authorization: token || "" },
            }
        },
    })
}

export { gql } from "graphql-tag"
