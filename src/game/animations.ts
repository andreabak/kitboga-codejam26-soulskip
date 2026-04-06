import type {Component, SubsType} from "@/game/core"
import type {Game} from "@/game/game"
import {interpolate, interpolate_point, Point, shortest_delta_angle} from "@/utils"

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

export type ImagesAnimationDefMixin = {image_src: string | Array<string>}
type ImagesAnimationFactory<C extends Component<object>, H extends AnimationHandle> = (
    component: C,
    params_override?: ImageAnimationParams,
    init_override?: (component: C, image_el: HTMLElement) => H,
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
    image_size?: string
    style?: Partial<CSSStyleDeclaration>
}
export function image_animation_def<C extends Component<object>>(
    image_src: string,
    element: HTMLElement | ((component: C) => HTMLElement),
    {remove, position, size, image_size, style}?: Omit<ImageAnimationParams, "duration">,
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): ImagesAnimationDef<C>
export function image_animation_def<C extends Component<object>>(
    image_src: string,
    element: HTMLElement | ((component: C) => HTMLElement),
    {duration, remove, position, size, image_size, style}: ImageAnimationParams & {duration: number},
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): TimedImagesAnimationDef<C>
export function image_animation_def<C extends Component<object>>(
    image_src: string,
    element: HTMLElement | ((component: C) => HTMLElement),
    {duration, remove, position, size, image_size = "contain", style}: ImageAnimationParams = {},
    init?: (component: C, image_el: HTMLElement) => AnimationHandle,
): ImagesAnimationDef<C> | TimedImagesAnimationDef<C> {
    function factory(
        component: C,
        params_override?: ImageAnimationParams,
        init_override?: (component: C, image_el: HTMLElement) => AnimationHandle,
    ): AnimationHandle {
        const params = {...{duration, remove, position, size, image_size, style}, ...(params_override ?? {})}
        const randid = "img-" + Math.random().toString(36)
        const image_el = document.createElement("div")
        image_el.id = randid
        // using div + background-image prevents further browser HEAD requests
        image_el.style = `
            position: absolute;
            background-image: url('${image_src}');
            background-size: ${params.image_size};
        `
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
        let sub_update,
            sub_end = undefined
        const _init = init_override ?? init
        if (_init != null) {
            ;({update: sub_update, end: sub_end} = _init(component, image_el))
        }
        const update = sub_update
        const end = () => {
            if (sub_end != null) sub_end()
            if (params.remove == null || params.remove === true) image_el.remove()
        }
        if (update != null) {
            update(0)
        }
        if (params.duration != null) return {duration: params.duration, update, end} as TimedAnimationHandle
        else return {update, end} as AnimationHandle
    }
    factory.image_src = image_src
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
    {shortest_angle, ease_fn}?: Omit<InterpolateAnimationParams, "duration">,
): AnimationDef<C>
export function interpolate_anim_def<C extends Component<object>>(
    start: InterpolateState | ((component: C) => InterpolateState),
    target: InterpolateState | ((component: C) => InterpolateState),
    set: (component: C, new_state: InterpolateState) => void,
    {duration, shortest_angle, ease_fn}: InterpolateAnimationParams & {duration: number},
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
