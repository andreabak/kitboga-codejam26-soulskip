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
}

export abstract class Actor extends GameComponent {}
