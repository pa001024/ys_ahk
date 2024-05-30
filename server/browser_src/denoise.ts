import { AIDenoiser, AIDenoiserProcessorMode, AIDenoiserProcessorLevel } from "ai-noise-reduction"

async function initAudioData(stream: MediaStream) {
    const audioContext = new AudioContext()
    const denoiser = new AIDenoiser({
        assetsPath: "/assets/",
        context: audioContext,
        ains: true,
        agc: true,
        bufferTime: 30,
        dumpBundleNums: 3,
        threshold: 2,
    })
    denoiser.on("overload", () => {
        // 如果处理超时转换成性能消耗更小的稳态降噪
        denoiser.setMode(AIDenoiserProcessorMode.STATIONARY_NS)
    })
    await denoiser.init()
    // denoiser.dump()
    const destination = audioContext.createMediaStreamDestination()
    const source = audioContext.createMediaStreamSource(stream)
    const aiDenoiserNode = denoiser.connect(source, audioContext)
    aiDenoiserNode.connect(destination)
    // 初始设置成AI降噪模式
    denoiser.setMode(AIDenoiserProcessorMode.NSNG)
    // 推荐设置成舒缓降噪
    denoiser.setLevel(AIDenoiserProcessorLevel.SOFT)
    return destination.stream
}

;(window as any)["initAudioData"] = initAudioData
