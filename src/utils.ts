export async function delay(ms: number): Promise<void> {
    return await new Promise((resolve) => setTimeout(resolve, ms))
}

export function get_element(selector: string, root?: Element): Element {
    root = (root ?? document) as Element
    const el = root.querySelector(selector)
    if (!el) throw new Error(`Could not find element with selector "${selector}"`)
    return el as Element
}

export function play_audio_element(selector: string, root?: Element): Promise<void> {
    const el = get_element(selector, root)
    if (!(el instanceof HTMLMediaElement)) {
        throw new Error(`Element with selector "${selector}" doesn't look like an audio element.`)
    }
    return el.play()
}

export async function fade_audio(
    audio_el: HTMLMediaElement,
    {
        duration,
        volume,
        fps = 60,
        exponential = true,
        stop_after = false,
    }: {duration: number; volume: number; fps?: number; exponential?: boolean; stop_after?: boolean},
) {
    const start_volume = audio_el.volume
    const step_delay = 1000 / fps
    const steps = Math.ceil(duration / step_delay)
    for (let i = 0; i < steps; i++) {
        const progress = (i + 1) / steps
        audio_el.volume = Math.max(
            0,
            Math.min(start_volume + (volume - start_volume) * (exponential ? Math.pow(progress, 0.5) : progress), 1),
        )
        await delay(step_delay)
    }
    audio_el.volume = volume
    if (stop_after) audio_el.pause()
}

export function random_pick<T>(items: Array<T>): T {
    return items[Math.floor(Math.random() * items.length)]
}

export type Point = {
    x: number
    y: number
}
export type Rect = {
    x: number
    y: number
    width: number
    height: number
}
export function rect_to_shape(rect: Rect): Shape {
    return {
        points: [
            {x: rect.x, y: rect.y},
            {x: rect.x + rect.width, y: rect.y},
            {x: rect.x + rect.width, y: rect.y + rect.height},
            {x: rect.x, y: rect.y + rect.height},
        ],
    }
}
export type Shape = {
    points: Array<Point>
}
export function shape_bbox(shape: Shape): Rect {
    if (!shape.points.length) {
        throw new Error("Shape has no points!")
    }
    let [min_x, max_x, min_y, max_y] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const p of shape.points) {
        min_x = Math.min(min_x, p.x)
        max_x = Math.max(max_x, p.x)
        min_y = Math.min(min_y, p.y)
        max_y = Math.max(max_y, p.y)
    }
    return {
        x: min_x,
        y: min_y,
        width: max_x - min_x,
        height: max_y - min_y,
    }
}
export type HitBox = {
    shape: Shape | Rect
    rotation_ref: number
}
export function hitbox_bbox(box: HitBox): Rect {
    if (!("points" in box.shape)) {
        return box.shape
    }
    return shape_bbox(box.shape)
}

export function transform(
    points: Array<Point>,
    {
        translate,
        rotate,
        scale,
        origin,
    }: {
        translate?: Point
        rotate?: number
        scale?: number | Point
        origin?: Point
    },
): Array<Point> {
    translate = translate ?? {x: 0, y: 0}
    rotate = rotate ?? 0
    const rvec: Point = {x: Math.cos(rotate), y: Math.sin(rotate)}
    scale = scale ?? 1.0
    scale = typeof scale === "number" ? {x: scale, y: scale} : scale
    origin = origin ?? {x: 0, y: 0}

    const result: Array<Point> = []
    for (const p of points) {
        let x = p.x + translate.x - origin.x
        let y = p.y + translate.y - origin.y
        const rx = x * rvec.x - y * rvec.y
        const ry = x * rvec.y + y * rvec.x
        x = rx
        y = ry
        x *= scale.x
        y *= scale.y
        x += origin.x
        y += origin.y
        result.push({x, y})
    }
    return result
}
export function transform_shape(
    shape: Shape,
    {
        translate,
        rotate,
        scale,
        origin,
    }: {
        translate?: Point
        rotate?: number
        scale?: number | Point
        origin?: Point
    },
): Shape {
    return {points: transform(shape.points, {translate, rotate, scale, origin})}
}

export function dist(x: number, y: number): number {
    return Math.sqrt(x * x + y * y)
}
export function dist_pt(p: Point): number {
    return dist(p.x, p.y)
}

export function aabb_overlap(a: Rect, b: Rect): boolean {
    return !(a.x > b.x + b.width || a.x + a.width < b.x || a.y > b.y + b.height || a.y + a.height < b.y)
}

export function sat_overlap(a: Shape, b: Shape): boolean {
    const get_axes = (points: Array<Point>): Array<Point> =>
        points.map((p0, i) => {
            const p1 = points[(i + 1) % points.length]
            return {x: -p1.y + p0.y, y: p1.x - p0.x}
        })

    const projected_range = (points: Array<Point>, axis: Point): [number, number] => {
        let [min, max] = [Infinity, -Infinity]
        for (const p of points) {
            const proj = p.x * axis.x + p.y * axis.y
            min = Math.min(min, proj)
            max = Math.max(max, proj)
        }
        return [min, max]
    }

    const axes = [...get_axes(a.points), ...get_axes(b.points)]

    return !axes.some((axis) => {
        const [a_min, a_max] = projected_range(a.points, axis)
        const [b_min, b_max] = projected_range(b.points, axis)
        return a_max < b_min || b_max < a_min
    })
}

export function smooth_ema(v0: number, v1: number, sf: number) {
    return (1.0 - sf) * v0 + sf * v1
}

export class TargetFollower {
    pos: Point
    target: Point

    acceleration: number
    private _vel: Point = {x: 0, y: 0}
    private _direction: number = (-90 / 180) * Math.PI

    max_vel: number | null
    slowing_distance: number | null

    constructor(
        pos: Point,
        target: Point,
        {
            acceleration,
            max_vel = null,
            slowing_distance = null,
        }: {acceleration: number; max_vel?: number | null; slowing_distance?: number | null},
    ) {
        this.pos = pos
        this.target = target
        this.acceleration = acceleration
        this.max_vel = max_vel
        this.slowing_distance = slowing_distance
    }

    get velocity(): Point {
        return {...this._vel}
    }
    get direction(): number {
        return this._direction
    }
    get direction_vector(): Point {
        return {x: Math.cos(this._direction), y: Math.sin(this._direction)}
    }

    update(timestep: number, {target}: {target?: Point} = {}): Point {
        if (target != null) {
            this.target = target
        }
        if (!timestep || timestep < 0) {
            return this.pos
        }

        const secs = timestep / 1000

        const dx = this.target.x - this.pos.x
        const dy = this.target.y - this.pos.y
        const d = dist(dx, dy)

        if (d > 0) {
            this._vel.x += (dx / d) * this.acceleration * secs
            this._vel.y += (dy / d) * this.acceleration * secs
        }
        if (this.slowing_distance && d < this.slowing_distance) {
            this._vel.x *= 1 - this.slowing_distance / (d + this.slowing_distance)
            this._vel.y *= 1 - this.slowing_distance / (d + this.slowing_distance)
        }

        let vel = dist(this._vel.x, this._vel.y)
        if (d > 0) {
            // align velocity direction to target (hacky, means immediate turning radius)
            this._vel.x = vel * (dx / d)
            this._vel.y = vel * (dy / d)
        }
        if (this.max_vel != null && vel >= this.max_vel) {
            this._vel.x = this.max_vel * (this._vel.x / vel)
            this._vel.y = this.max_vel * (this._vel.y / vel)
        }
        vel = dist(this._vel.x, this._vel.y)
        if (vel > 0.1) {
            // TODO: min rotation const
            this._direction = Math.atan2(this._vel.y, this._vel.x)
        }

        this.pos.x += this._vel.x
        this.pos.y += this._vel.y

        return this.pos
    }
}
