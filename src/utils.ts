export function get_element(selector: string, root?: Element): Element {
    root = (root ?? document) as Element
    const el = root.querySelector(selector)
    if (!el) throw new Error(`Could not find element with selector "${selector}"`)
    return el as Element
}

export function random_pick<T>(items: Array<T>): T {
    return items[Math.floor(Math.random() * items.length)]
}

export type Point = {
    x: number
    y: number
}

export function dist(x: number, y: number): number {
    return Math.sqrt(x * x + y * y)
}
export function dist_pt(p: Point): number {
    return dist(p.x, p.y)
}

export function smooth_ema(v0: number, v1: number, sf: number) {
    return (1.0 - sf) * v0 + sf * v1
}

export class TargetFollower {
    pos: Point
    target: Point

    acceleration: number
    private _vel: Point = {x: 0, y: 0}

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

        const vel = dist(this._vel.x, this._vel.y)
        if (d > 0) {
            // align velocity direction to target (hacky, means immediate turning radius)
            this._vel.x = vel * (dx / d)
            this._vel.y = vel * (dy / d)
        }
        if (this.max_vel != null && vel >= this.max_vel) {
            this._vel.x = this.max_vel * (this._vel.x / vel)
            this._vel.y = this.max_vel * (this._vel.y / vel)
        }

        this.pos.x += this._vel.x
        this.pos.y += this._vel.y

        return this.pos
    }
}
