import { MD5, enc } from "crypto-js"
import { fetch } from "@tauri-apps/plugin-http"
import { useLocalStorage } from "@vueuse/core"

function md5(s: string) {
    return enc.Hex.stringify(MD5(s))
}

function ksort(a: any) {
    const o: any = {}
    const keys = Object.keys(a).sort()
    keys.forEach((key) => {
        o[key] = a[key]
    })
    return o
}

export class Yunlian {
    private static apiKey = useLocalStorage("setting_yunlian_apikey", "")
    private static phone = useLocalStorage("setting_yunlian_phone", "")
    private static token = useLocalStorage("setting_yunlian_token", "")
    private static tokenExpire = useLocalStorage("setting_yunlian_token_expire", 0)

    get apiKey() {
        return Yunlian.apiKey.value
    }

    get phone() {
        return Yunlian.phone.value
    }

    get token() {
        return Yunlian.token.value
    }

    set token(value: string) {
        Yunlian.token.value = value
    }

    get tokenExpire() {
        return Yunlian.tokenExpire.value
    }

    set tokenExpire(value: number) {
        Yunlian.tokenExpire.value = value
    }

    get time() {
        return ~~(Date.now() / 1e3)
    }

    async get_token() {
        const response = await fetch("http://47.116.207.238:8001/index/access/get_token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: this.phone, secret: md5(this.apiKey + this.phone).slice(7, 24) }),
        })
        return (await response.json()) as {
            code: number
            data: {
                token: string
                expire: string
            }
        }
    }

    async checkToken() {
        if (this.tokenExpire > Date.now()) {
            return true
        }
        const response = await this.get_token()
        if (response.code === 200) {
            this.token = response.data.token
            this.tokenExpire = +response.data.expire * 1000
        }
    }

    private async apiWithSign<T>(url: string, kv: { [k: string]: any }): Promise<T> {
        await this.checkToken()
        const { token, time } = this
        const sign = md5(JSON.stringify(ksort(kv)) + this.apiKey + this.time).slice(7, 24)
        const body = JSON.stringify({ token, sign, time, ...kv })

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        })
        return await response.json()
    }

    /** 获取用户积分 */
    async get_points() {
        return await this.apiWithSign<{
            code: number
            data: {
                points: number
            }
        }>("http://47.116.207.238:8001/index/user/get_points", {})
    }

    /** 获取服务可用状态 */
    async check_service(service_id: number) {
        return await this.apiWithSign<{
            code: number
            data: {
                /** 服务状态，0-停用 1-可用 */
                state: number
                /** 服务所需积分 */
                point: number
                /** 服务账号提交格式 */
                text: string
            }
        }>("http://47.116.207.238:8001/index/service/check_service", { service_id })
    }

    /**
     * 提交账号数据
     * @param content 账号密码等信息字符串,数据结构:
     * ```
        test123——xxx111xx11
        test123——xxx111xx11
        ```
     * @returns 
     */
    async push(content: string) {
        return await this.apiWithSign<{
            code: number
            data: {
                /** 订单号 @example "YL202312221138523976" */
                order_no: string
            }
        }>("http://47.116.207.238:8001/index/service/push", { content })
    }
    /**
     * 获取订单详情
     * @param order_no 订单号,多个订单号用英文','隔开;不传递order_no参数则默认查询最近100条记录
     */
    async order_info(order_no: string) {
        return await this.apiWithSign<{
            code: number
            data: {
                /** 订单号 @example "YL202312221138523976" */
                order_no: string
                /** 数据提交时间 @example "2024-01-04 15:07:44" */
                push_time: string
                /** 服务项目 @example "查询角色信息" */
                service_name: string
                /** 成功条数 */
                succ: number
                /** 失败条数 */
                fail: number
                /** 导入状态 0,1入库中 2.提交成功 */
                state: number
                /** 导入提示 @example "成功1条" */
                status: string
                /** 处理进度 @example "100%" */
                process: string
            }
        }>("http://47.116.207.238:8001/index/service/order_info", { order_no })
    }

    async view_data_v1(order_no: string) {
        return await this.apiWithSign<{
            code: number
            data:
                | {
                      /** 处理进度 @example "100%" */
                      process: string
                  }
                | {
                      /** 结果数据 @example [
"q4*****com----13*****5----等级42----性别「女」----活跃天数13----五星3个「镜流1命|瓦尔特|姬子」----四星4个「娜塔莎|丹恒1命|三月七|黑塔1命」----此身为剑----未绑定手机----已绑定安全手机----未绑定Tap----Uid「1***0」----不能实名----无设备锁----米游社正常----详「**伟|520************312」",
] */
                      result: string[]
                  }
        }>("http://47.116.207.238:8001/index/service/view_data_v1", { order_no })
    }

    errcode(code: number) {
        const kmap = {
            10001: "检查参数是否正确",
            10002: "secret错误或不存在",
            10003: "电话号码错误或不存在",
            10005: "token无效/过期了，需要重新获取",
            10006: "sign签名错误",
            10007: "用户APi状态暂不可用",
            20002: "服务id错误",
            30000: "请求方式错误",
            30001: "未选择密码是否加密",
            30002: "服务已关闭",
            30003: "积分不足",
            30004: "数据数量上限",
            30005: "请求频繁",
            30006: "订单号不存在",
            30007: "限制时间内提交数量超限",
            30011: "数据格式错误或验证类型错误",
            30013: "content数据结构错误",
            30014: "数据处理失败",
            30020: "获取数据频繁",
            50000: "错误",
        } as { [key: number]: string }
        return kmap[code] || "未知错误"
    }
}
