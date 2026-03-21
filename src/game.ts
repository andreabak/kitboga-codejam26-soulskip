import {ShellEvent} from "./shell"
import {dist_pt, get_element, Point, smooth_ema, TargetFollower} from "./utils"

export type GameState = "chill" | "battle" | "defeat" | "win"

type UpdateContext = object

abstract class Component<T extends UpdateContext> {
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

type GameUpdateContext = {
    /*
     * timestamp of update tick
     */
    timestamp: number

    /*
     * update time delta since last update
     */
    timedelta: number | null
}

abstract class GameComponent extends Component<GameUpdateContext> {
    game: Game

    constructor(game: Game) {
        super()
        this.game = game
    }
}

abstract class Actor extends GameComponent {}

const player_root_selector = ".player-pointer"

class PlayerActor extends Actor {
    player_root_el: HTMLDivElement

    private _follower: TargetFollower
    acceleration: number = 400
    max_vel: number = 100

    stamina: number = 200.0
    max_stamina: number = 200.0
    stamina_consume_factor: number = 4.0
    stamina_consume_min: number = 21.0
    stamina_recover: number = 100.0
    stamina_recover_delay: number = 500
    last_stamina_consume_ts: number = 0
    low_stamina_max_vel: number = 5
    low_stamina_accel: number = 100

    constructor(game: Game) {
        super(game)

        this.player_root_el = get_element(player_root_selector, this.game.game_root_el) as HTMLDivElement

        this._follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {acceleration: this.acceleration, max_vel: this.max_vel, slowing_distance: 50},
        )

        this._on_mousemove = this._on_mousemove.bind(this)
        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove)
    }

    _on_mousemove(event: MouseEvent): void {
        const rect = this.game.game_root_el.getBoundingClientRect()
        this._follower.target = {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }

    _update(context: GameUpdateContext) {
        let new_pos: Point
        if (context.timedelta != null) {
            this._follower.update(context.timedelta)
        } else {
            this._follower.pos = {...this._follower.target}
        }
        this.player_root_el.style.top = `${this._follower.pos.y - this.player_root_el.clientHeight / 2}px`
        this.player_root_el.style.left = `${this._follower.pos.x - this.player_root_el.clientWidth / 2}px`

        if (context.timedelta && context.timedelta > 0) {
            const s_delta = context.timedelta / 1000

            const stamina_consume = dist_pt(this._follower.velocity) * this.stamina_consume_factor * s_delta
            if (stamina_consume / s_delta > this.stamina_consume_min) {
                this.stamina -= stamina_consume
                this.last_stamina_consume_ts = context.timestamp
            } else if (
                !this.last_stamina_consume_ts ||
                context.timestamp - this.last_stamina_consume_ts >= this.stamina_recover_delay
            ) {
                this.stamina += this.stamina_recover * s_delta
            }
            this.stamina = Math.max(0, Math.min(this.stamina, this.max_stamina))

            const low_stamina = this.stamina < 1
            this._follower.max_vel = low_stamina ? this.low_stamina_max_vel : this.max_vel
            this._follower.acceleration = low_stamina ? this.low_stamina_accel : this.acceleration
            this.player_root_el.classList.toggle("low-stamina", low_stamina)
        }
    }
}

const enemy_root_selector = ".skip-btn"

class EnemyActor extends Actor {
    enemy_root_el: HTMLDivElement

    // TODO: aggro: number = 0.0

    constructor(game: Game) {
        super(game)

        this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el) as HTMLDivElement

        this.enemy_root_el.addEventListener("click", () => (this.game.state = "battle")) // FIXME testing
    }

    _update(context: GameUpdateContext) {
        // TODO: update enemy
    }
}

const hud_root_selector = ".hud"
const hud_stamina_bar_selector = ".bar.stamina"
const hud_hidden_class = "hidden"

class Hud extends GameComponent {
    hud_root_el: HTMLDivElement

    stamina_bar_el: HTMLDivElement
    player_stamina_max_recent: number = 0
    player_stamina_max_ts: number = 0

    bar_recent_delay: number = 1000

    constructor(game: Game) {
        super(game)

        this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el) as HTMLDivElement

        this.stamina_bar_el = get_element(hud_stamina_bar_selector, this.hud_root_el) as HTMLDivElement
    }

    _update(context: GameUpdateContext): void {
        const should_show = this.game.state !== "chill"
        this.hud_root_el.classList.toggle(hud_hidden_class, !should_show)
        if (should_show) {
            const stamina = this.game.player_actor.stamina
            if (stamina >= this.player_stamina_max_recent) {
                this.player_stamina_max_recent = stamina
                this.player_stamina_max_ts = context.timestamp
            } else {
                if (context.timestamp - this.player_stamina_max_ts > this.bar_recent_delay) {
                    this.player_stamina_max_recent = smooth_ema(this.player_stamina_max_recent, stamina, 0.5)
                }
            }
            const pct_stamina = stamina / this.game.player_actor.max_stamina
            const pct_diff = (this.player_stamina_max_recent - stamina) / this.game.player_actor.max_stamina
            this.stamina_bar_el.style.setProperty("--bar-fill", pct_stamina.toFixed(3))
            this.stamina_bar_el.style.setProperty("--bar-diff", pct_diff.toFixed(3))
        }
    }
}

const game_root_selector = "#game-root"

export class Game extends Component<GameUpdateContext> {
    state: GameState = "chill"
    game_root_el: HTMLDivElement

    private _last_timestamp: number | null = null

    player_actor: PlayerActor
    enemy_actor: EnemyActor

    private _hud: Hud

    constructor() {
        super()

        this.game_root_el = get_element(game_root_selector) as HTMLDivElement
        this.game_root_el.classList.toggle("hidden", false)

        this.player_actor = this.add_component(new PlayerActor(this))
        this.enemy_actor = this.add_component(new EnemyActor(this))
        this._hud = this.add_component(new Hud(this))
    }

    handle_shell_event(event: ShellEvent | unknown): void {
        if (!event || typeof event !== "object" || !("type" in event)) {
            console.warn("Received unknown event object", event)
            return
        }
        if (event.type === "adStarted") {
            // TODO: handle events
        }
    }

    _update(context: GameUpdateContext): void {}

    step(timestamp: number): void {
        const context = {
            timestamp: timestamp,
            timedelta: this._last_timestamp != null ? timestamp - this._last_timestamp : null,
        } as GameUpdateContext
        this.update(context)
        this._last_timestamp = timestamp
    }
}
