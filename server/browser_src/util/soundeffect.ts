const resList = {
    notice: "/assets/notice.mp3",
    incoming: "/assets/incoming.mp3",
}
type SoundEffectResKey = keyof typeof resList
type SoundEffectResBinding = {
    [K in SoundEffectResKey]: () => void
}
export declare interface SoundEffect extends SoundEffectResBinding {}

export class SoundEffect {
    constructor() {
        for (const [name, url] of Object.entries(resList)) {
            const audio = this.preload(url)
            this[name as SoundEffectResKey] = () => ((audio.cloneNode() as HTMLAudioElement).autoplay = true)
        }
    }
    preload(url: string) {
        let audio = new Audio(url)
        audio.preload = "auto"
        return audio
    }
}
