export type AdStartedShellEvent = {
    type: "adStarted"
}
export type AdFinishedShellEvent = {
    type: "adFinished"
}
export type TimeUpdateShellEvent = {
    type: "timeupdate"
    currentTime: number
    duration: number
    paused: boolean
    playbackRate: number
}
export type VideoInfoShellEvent = {
    type: "videoInfo"
    currentTime: number
    duration: number
    paused: boolean
    playbackRate: number
    volume: number
    muted: boolean
}

export type ShellEvent = AdStartedShellEvent | AdFinishedShellEvent | TimeUpdateShellEvent | VideoInfoShellEvent

export function add_shell_events_listener(listener: (event: ShellEvent) => void) {
    window.addEventListener("message", (event) => {
        if (!event || typeof event !== "object" || !event?.data?.type) return
        listener(event.data as ShellEvent)
    })
}

export type SuccessRequest = {
    type: "success"
}
export type FailRequest = {
    type: "fail"
}
export type PlayRequest = {
    type: "play"
}
export type PauseRequest = {
    type: "pause"
}
export type SeekToRequest = {
    type: "seekTo"
    value: number
}
export type SetPlaybackRateRequest = {
    type: "setPlaybackRate"
    value: number
}
export type SetVolumeRequest = {
    type: "setVolume"
    value: number
}
export type GetVideoInfoRequest = {
    type: "getVideoInfo"
}
export type SetVideoFilterRequest = {
    type: "setVideoFilter"
    value: string
}

export type ShellRequest =
    | SuccessRequest
    | FailRequest
    | PlayRequest
    | PauseRequest
    | SeekToRequest
    | SetPlaybackRateRequest
    | SetVolumeRequest
    | GetVideoInfoRequest
    | SetVideoFilterRequest

export function send_shell_request(request: ShellRequest) {
    window.top!.postMessage(request, "*")
}
