import type {Game} from "./game"

export type GameState = "chill" | "battle" | "defeat" | "victory"

export type UpdateContext = object

export abstract class Component<T extends UpdateContext> {
    _children: Array<Component<T>> = []

    add_component<C extends Component<T>>(component: C): C {
        this._children.push(component)
        return component
    }

    abstract _update(context: T): void

    update(context: T): void {
        this._update(context)
        for (const component of this._children) {
            component.update(context)
        }
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

export type SubsType = Array<[number, number, string]>
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

export type GameUpdateContext = {
    /*
     * timestamp of update tick
     */
    timeref: number

    /*
     * update time delta since last update
     */
    timedelta: number | null
}

export abstract class GameComponent extends Component<GameUpdateContext> {
    game: Game

    constructor(game: Game) {
        super()
        this.game = game
    }

    preload(): void {}
}

export abstract class Actor extends GameComponent {}
