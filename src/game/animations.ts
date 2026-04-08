import type {Component, SubsType} from "@/game/core"
import type {Game} from "@/game/game"
import {interpolate, interpolate_point, Point, random_pick, shortest_delta_angle} from "@/utils"

export type ViteGlob = Record<string, {default: string}>
export class ImageSequence {
    frames_src: Array<string>
    fps: number

    constructor(frames_src: Array<string>, fps: number) {
        if (!frames_src.length) throw new Error("frames_src must not be empty")
        this.frames_src = frames_src
        this.fps = fps
    }

    get duration(): number {
        return (1000 / this.fps) * this.frames_src.length
    }

    frame_at_progress(progress: number): string {
        if (progress < 0) {
            return this.frames_src[0]
        } else if (progress < 1) {
            return this.frames_src[Math.floor(progress * this.frames_src.length)]
        } else {
            return this.frames_src.at(-1) as string
        }
    }

    static from_frames_dir(frames_glob: ViteGlob, fps: number): ImageSequence {
        const files = Object.entries(frames_glob)
        files.sort(([a], [b]) => a.localeCompare(b))
        const frames = files.map(([, mod]) => mod.default as string)
        return new ImageSequence(frames, fps)
    }
}

type ImageAtlasFrame = {
    index: number
    x: number
    y: number
    w: number
    h: number
}
export type ImageAtlasMeta = {
    frames: Array<ImageAtlasFrame>
    atlas: {
        image_src: string
        size: {width: number; height: number}
    }
}
export class ImageAtlas {
    readonly FRAME_EL_CLS = "atlas-frame"
    atlas_src: string
    atlas_meta: ImageAtlasMeta
    fps: number

    constructor(atlas_src: string, atlas_meta: ImageAtlasMeta, fps: number) {
        if (!atlas_meta.frames.length) throw new Error("atlas_meta should have at least one frame")
        this.atlas_src = atlas_src
        this.atlas_meta = atlas_meta
        this.fps = fps
    }

    get duration(): number {
        return (1000 / this.fps) * this.atlas_meta.frames.length
    }

    _frame_at_progress(progress: number): ImageAtlasFrame {
        if (progress < 0) {
            return this.atlas_meta.frames[0]
        } else if (progress < 1) {
            return this.atlas_meta.frames[Math.floor(progress * this.atlas_meta.frames.length)]
        } else {
            return this.atlas_meta.frames.at(-1) as ImageAtlasFrame
        }
    }

    set_frame_at_progress(image_el: HTMLElement, progress: number) {
        let frame_el: HTMLElement | undefined = image_el.querySelector(`.${this.FRAME_EL_CLS}`) as HTMLElement
        if (!frame_el) {
            frame_el = document.createElement("div")
            frame_el.classList.add(this.FRAME_EL_CLS)
            frame_el.style.position = "absolute"
            frame_el.style.top = "50%"
            frame_el.style.left = "50%"
            frame_el.style.backgroundImage = `url("${this.atlas_src}")`
            image_el.appendChild(frame_el)
        }
        const frame = this._frame_at_progress(progress)
        if (frame_el.dataset.index && parseInt(frame_el.dataset.index) === frame.index) return
        frame_el.dataset.index = frame.index.toString()
        frame_el.style.width = `${frame.w}px`
        frame_el.style.height = `${frame.h}px`
        frame_el.style.backgroundPosition = `${-frame.x}px ${-frame.y}px`
        const scale = Math.min(image_el.offsetWidth / frame.w, image_el.offsetHeight / frame.h)
        frame_el.style.transform = `translate(-50%, -50%) scale(${scale})`
    }
}

export type AnimationHandle = {
    update?: ((progress: number) => void) | null
    end?: (() => void) | null
}
export type AnimationDef<C extends Component<object>> = (component: C) => AnimationHandle

export type TimedAnimationHandle = {
    duration: number
    update?: ((progress: number) => void) | null
    end?: (() => void) | null
}
export type TimedAnimationDef<C extends Component<object>> = (component: C) => TimedAnimationHandle

export function delay_anim(callback: () => unknown, delay: number): TimedAnimationHandle {
    return {
        end: () => callback(),
        duration: delay,
    }
}

export type ImagesAnimationDefMixin = {image_src: string | Array<string>}
type ImagesAnimationFactory<C extends Component<object>, H extends AnimationHandle> = (
    component: C,
    params_override?: ImageAnimationParams,
    init_override?: (component: C, image_el: HTMLElement, ...rest: unknown[]) => H,
    ...rest: unknown[]
) => H
export type ImagesAnimationDef<C extends Component<object>> = ImagesAnimationFactory<C, AnimationHandle> &
    ImagesAnimationDefMixin
export type TimedImagesAnimationDef<C extends Component<object>> = ImagesAnimationFactory<C, TimedAnimationHandle> &
    ImagesAnimationDefMixin

export type ImageAnimationParams = {
    duration?: number
    remove?: boolean
    position?: Point
    size?: Point
    style?: Partial<CSSStyleDeclaration>
}
export function image_animation_def<C extends Component<object>>(
    image_src: string | Array<string>,
    element: HTMLElement | ((component: C) => HTMLElement),
    params?: Omit<ImageAnimationParams, "duration">,
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): ImagesAnimationDef<C>
export function image_animation_def<C extends Component<object>>(
    image_src: ImageSequence | ImageAtlas | Array<ImageSequence | ImageAtlas>,
    element: HTMLElement | ((component: C) => HTMLElement),
    params?: Omit<ImageAnimationParams, "duration">,
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): TimedImagesAnimationDef<C>
export function image_animation_def<C extends Component<object>>(
    image_src: string | ImageSequence | ImageAtlas | Array<string | ImageSequence | ImageAtlas>,
    element: HTMLElement | ((component: C) => HTMLElement),
    params: ImageAnimationParams & {duration: number},
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): TimedImagesAnimationDef<C>
export function image_animation_def<C extends Component<object>>(
    image_src: string | ImageSequence | ImageAtlas | Array<string | ImageSequence | ImageAtlas>,
    element: HTMLElement | ((component: C) => HTMLElement),
    {duration, remove, position, size, style}: ImageAnimationParams = {},
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): ImagesAnimationDef<C> | TimedImagesAnimationDef<C> {
    function factory(
        component: C,
        params_override?: ImageAnimationParams,
        init_override?: (component: C, image_el: HTMLElement, ...rest: unknown[]) => AnimationHandle,
        ...rest: unknown[]
    ): AnimationHandle {
        const params = {...{duration, remove, position, size, style}, ...(params_override ?? {})}
        const randid = "img-" + Math.random().toString(36)
        const _img =
            typeof image_src === "string" || image_src instanceof ImageSequence || image_src instanceof ImageAtlas
                ? image_src
                : random_pick(image_src)
        const _img_src =
            typeof _img === "string" ? _img : _img instanceof ImageSequence ? _img.frame_at_progress(0) : null
        // using div + background-image prevents further browser HEAD requests
        const image_el = document.createElement("div")
        image_el.id = randid
        image_el.style.position = "absolute"
        if (_img_src != null) {
            image_el.style.backgroundImage = `url('${_img_src}')`
            image_el.style.backgroundSize = "contain"
        }
        if (params.position) {
            image_el.style.top = `${params.position.y}px`
            image_el.style.left = `${params.position.x}px`
        }
        if (params.size) {
            image_el.style.width = `${params.size.x}px`
            image_el.style.height = `${params.size.y}px`
        }
        if (params.style) {
            Object.assign(image_el.style, params.style)
        }
        const el = element instanceof HTMLElement ? element : element(component)
        el.appendChild(image_el)
        let sub_update: ((progress: number) => void) | null | undefined = undefined
        let sub_end: (() => void) | null | undefined = undefined
        const _init = init_override ?? init
        if (_init != null) {
            ;({update: sub_update, end: sub_end} = _init(component, image_el, ...rest))
        }
        const update = (progress: number) => {
            if (sub_update != null) sub_update(progress)
            if (_img instanceof ImageSequence) {
                image_el.style.backgroundImage = `url('${_img.frame_at_progress(progress)}')`
            } else if (_img instanceof ImageAtlas) {
                _img.set_frame_at_progress(image_el, progress)
            }
        }
        const end = () => {
            if (sub_end != null) sub_end()
            if (params.remove == null || params.remove === true) image_el.remove()
        }
        update(0)
        const _duration =
            params.duration ?? (_img instanceof ImageSequence || _img instanceof ImageAtlas ? _img.duration : undefined)
        if (_duration != null) return {duration: _duration, update, end} as TimedAnimationHandle
        else return {update, end} as AnimationHandle
    }
    factory.image_src = (Array.isArray(image_src) ? image_src : [image_src])
        .map((i) => (i instanceof ImageSequence ? i.frames_src : i instanceof ImageAtlas ? i.atlas_src : i))
        .flat()
    return factory
}

export function multi_animation_def<
    C extends Component<object>,
    D = Array<UntimedAnimationDefTypes<C>> | Record<string, UntimedAnimationDefTypes<C>>,
>(
    defs: D,
    {duration}: {duration?: number} = {},
    init?: (component: C, defs: D) => Array<AnimationHandle>,
): AnimationDefTypes<C> {
    const defs_array = Array.isArray(defs) ? defs : [...Object.values(defs as object)]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function factory(component: C, ...rest: any): AnimationHandle | TimedAnimationHandle {
        let animations: Array<AnimationHandle>
        if (init != null) {
            animations = init(component, defs)
        } else {
            animations = defs_array.map((def) => def(component, ...rest))
        }
        const update = (progress: number) =>
            animations.forEach((anim) => {
                if (anim.update) anim.update(progress)
            })
        const end = () =>
            animations.forEach((anim) => {
                if (anim.end) anim.end()
            })
        if (duration != null) return {duration, update, end} as TimedAnimationHandle
        else return {update, end} as AnimationHandle
    }
    const image_src_set = new Set(
        defs_array
            .filter((def) => "image_src" in def)
            .map((img_def) => img_def.image_src)
            .flat(),
    )
    if (image_src_set.size > 0) factory.image_src = [...image_src_set.values()]
    return factory
}

export type UntimedAnimationDefTypes<C extends Component<object>> = AnimationDef<C> | ImagesAnimationDef<C>
export type TimedAnimationDefTypes<C extends Component<object>> = TimedAnimationDef<C> | TimedImagesAnimationDef<C>
export type AnimationDefTypes<C extends Component<object>> = UntimedAnimationDefTypes<C> | TimedAnimationDefTypes<C>

export type InterpolateState = {
    position?: Point
    rotation?: number
    scale?: number
}
export type InterpolateAnimationParams = {
    duration?: number
    shortest_angle?: boolean
    ease_fn?: (progress: number) => number
}
export function interpolate_anim_def<C extends Component<object>>(
    start: InterpolateState | ((component: C) => InterpolateState),
    target: InterpolateState | ((component: C) => InterpolateState),
    set: (component: C, new_state: InterpolateState) => void,
    params?: Omit<InterpolateAnimationParams, "duration">,
): AnimationDef<C>
export function interpolate_anim_def<C extends Component<object>>(
    start: InterpolateState | ((component: C) => InterpolateState),
    target: InterpolateState | ((component: C) => InterpolateState),
    set: (component: C, new_state: InterpolateState) => void,
    params: InterpolateAnimationParams & {duration: number},
): TimedAnimationDef<C>
export function interpolate_anim_def<C extends Component<object>>(
    start: InterpolateState | ((component: C) => InterpolateState),
    target: InterpolateState | ((component: C) => InterpolateState),
    set: (component: C, new_state: InterpolateState) => void,
    {duration, shortest_angle = true, ease_fn}: InterpolateAnimationParams = {},
): AnimationDef<C> | TimedAnimationDef<C> {
    return (component: C): AnimationHandle | TimedAnimationHandle => {
        const _start = typeof start === "function" ? start(component) : start
        const _target = typeof target === "function" ? target(component) : target
        const update = (progress: number) => {
            const _progress = ease_fn != null ? ease_fn(progress) : progress
            const state: InterpolateState = {}
            if (_start.position != null && _target.position != null)
                state.position = interpolate_point(_start.position, _target.position, _progress)
            if (_start.rotation != null && _target.rotation != null) {
                if (shortest_angle)
                    state.rotation =
                        _start.rotation + _progress * shortest_delta_angle(_start.rotation, _target.rotation)
                else state.rotation = interpolate(_start.rotation, _target.rotation, _progress)
            }
            if (_start.scale != null && _target.scale != null)
                state.scale = interpolate(_start.scale, _target.scale, _progress)
            set(component, state)
        }
        const end = () => set(component, _target)
        if (duration != null) return {duration, update, end} as TimedAnimationHandle
        else return {update, end} as AnimationHandle
    }
}

export function subs_anim(game: Game, subs: SubsType): TimedAnimationHandle {
    if (!subs.length) return {duration: 0}
    const duration = Math.max(...subs.map(([, end_s]) => end_s)) * 1000
    const lines: Array<[number, number, HTMLElement]> = subs.map(([start, end, text]) => {
        const line_el = document.createElement("div")
        line_el.classList.add("sub-line")
        line_el.textContent = text
        return [start, end, line_el]
    })
    return {
        duration,
        update: (progress) => {
            const reltime = progress * duration
            for (const [start_s, end_s, line_el] of lines) {
                if (reltime < start_s * 1000) continue
                const in_dom = game.subs_root_el.contains(line_el)
                if (reltime < end_s * 1000) {
                    if (!in_dom) game.subs_root_el.appendChild(line_el)
                } else {
                    if (in_dom) line_el.remove()
                }
            }
        },
        end: () => {
            for (const [, , line_el] of lines) {
                line_el.remove()
            }
        },
    }
}
