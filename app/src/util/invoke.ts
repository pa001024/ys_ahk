import type { InvokeArgs, InvokeOptions } from '@tauri-apps/api/core'
import type { Event } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export class InvokeRequest<Payload, Error = string> {
    resolve: (value: Payload | PromiseLike<Payload>)=> void
    reject: (reason?: Error)=> void

    constructor(sucess_type: string, error_type: string) {
        this.resolve = () => {}
        this.reject = () => {}
        listen(sucess_type, (event: Event<Payload>) => {
            this.resolve(event.payload)
        })
        listen(error_type, (event: Event<Error>) => {
            this.reject(event.payload)
        })
    }

    invoke(type: string, args?: InvokeArgs, option?: InvokeOptions) {
        const { promise, resolve, reject } = Promise.withResolvers<Payload>()
        this.resolve = resolve
        this.reject = reject
        invoke(type, args, option)
        
        return promise
    }
}