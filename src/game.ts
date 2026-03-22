import {send_shell_request, ShellEvent} from "./shell"
import {dist_pt, get_element, smooth_ema, TargetFollower} from "./utils"

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

const player_root_selector = ".player"

class PlayerActor extends Actor {
    player_root_el: HTMLDivElement

    private _follower: TargetFollower
    acceleration: number = 500
    max_vel: number = 200

    health: number = 300.0
    max_health: number = 300.0

    stamina: number = 200.0
    max_stamina: number = 200.0
    stamina_movement_consume_factor: number = 8.0
    stamina_movement_vel_min: number = 40.0
    stamina_recover: number = 100.0
    stamina_recover_delay: number = 500
    last_stamina_consume_ts: number = 0
    low_stamina_max_vel: number = 5
    low_stamina_accel: number = 100
    low_stamina: boolean = false
    low_stamina_enter_threshold: number = 1 // TODO: sanity check
    low_stamina_exit_threshold: number = 200 // TODO: sanity check

    attack_requested: boolean = false
    attacking: boolean = false
    attack_stamina_consume: number = 30
    attack_duration: number = 150
    last_attack_ts: number = 0

    constructor(game: Game) {
        super(game)

        this.player_root_el = get_element(player_root_selector, this.game.game_root_el) as HTMLDivElement

        this._follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {acceleration: this.acceleration, max_vel: this.max_vel, slowing_distance: 50},
        )

        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this))
        this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this))
    }

    _on_mousemove(event: MouseEvent): void {
        const rect = this.game.game_root_el.getBoundingClientRect()
        this._follower.target = {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }

    _on_mousedown(event: MouseEvent): void {
        this.attack_requested = true
    }

    _update(context: GameUpdateContext) {
        this.player_root_el.classList.toggle("hidden", this.game.state === "chill")

        const s_delta = (context.timedelta ?? 0) / 1000

        let stamina_consume: number = 0

        if (context.timedelta != null) {
            this._follower.update(context.timedelta)
        } else {
            this._follower.pos = {...this._follower.target}
        }
        this.player_root_el.style.top = `${this._follower.pos.y - this.player_root_el.clientHeight / 2}px`
        this.player_root_el.style.left = `${this._follower.pos.x - this.player_root_el.clientWidth / 2}px`
        const vel_mag = dist_pt(this._follower.velocity)
        if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
            stamina_consume += vel_mag * this.stamina_movement_consume_factor * s_delta
        }

        if (this.attack_requested) {
            this.attack_requested = false
            if (!this.attacking && !this.low_stamina) {
                this.attacking = true
                this.last_attack_ts = context.timestamp
                stamina_consume += this.attack_stamina_consume
                this.player_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1000}s`)
            }
        }
        if (this.attacking && context.timestamp - this.last_attack_ts >= this.attack_duration) {
            this.attacking = false
        }
        this.player_root_el.classList.toggle("attacking", this.attacking)

        if (context.timedelta && context.timedelta > 0) {
            if (stamina_consume > 0) {
                this.stamina -= stamina_consume
                this.last_stamina_consume_ts = context.timestamp
            } else if (
                !this.last_stamina_consume_ts ||
                context.timestamp - this.last_stamina_consume_ts >= this.stamina_recover_delay
            ) {
                this.stamina += this.stamina_recover * s_delta
            }
            this.stamina = Math.max(0, Math.min(this.stamina, this.max_stamina))

            if (!this.low_stamina && this.stamina < this.low_stamina_enter_threshold) {
                this.low_stamina = true
            } else if (this.low_stamina && this.stamina >= this.low_stamina_exit_threshold) {
                this.low_stamina = false
            }
            this._follower.max_vel = this.low_stamina ? this.low_stamina_max_vel : this.max_vel
            this._follower.acceleration = this.low_stamina ? this.low_stamina_accel : this.acceleration
            this.player_root_el.classList.toggle("low-stamina", this.low_stamina)
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

abstract class HudBar extends GameComponent {
    hud: Hud
    abstract bar_root_el: HTMLDivElement

    max_recent: number = 0
    max_ts: number = 0

    recent_delay: number = 1000

    constructor(game: Game, hud: Hud) {
        super(game)
        this.hud = hud
    }

    abstract _get_values(): {value: number; max: number}

    _update(context: GameUpdateContext): void {
        const {value, max} = this._get_values()
        if (value >= this.max_recent) {
            this.max_recent = value
            this.max_ts = context.timestamp
        } else {
            if (context.timestamp - this.max_ts > this.recent_delay) {
                this.max_recent = smooth_ema(this.max_recent, value, 0.5)
            }
        }
        const pct_value = value / max
        const pct_diff = (this.max_recent - value) / max
        this.bar_root_el.style.setProperty("--bar-fill", pct_value.toFixed(3))
        this.bar_root_el.style.setProperty("--bar-diff", pct_diff.toFixed(3))
    }
}

const hud_health_bar_selector = ".bar.health"

class HealthBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_health_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.player_actor.health, max: this.game.player_actor.max_health}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
        }
    }
}

const hud_stamina_bar_selector = ".bar.stamina"

class StaminaBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_stamina_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.player_actor.stamina, max: this.game.player_actor.max_stamina}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
            this.bar_root_el.classList.toggle("low-stamina", this.game.player_actor.low_stamina)
        }
    }
}

const hud_root_selector = ".hud"
const hud_hidden_class = "hidden"

class Hud extends GameComponent {
    hud_root_el: HTMLDivElement

    health_bar: HealthBar
    stamina_bar: StaminaBar

    constructor(game: Game) {
        super(game)

        this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el) as HTMLDivElement

        this.health_bar = this.add_component(new HealthBar(game, this))
        this.stamina_bar = this.add_component(new StaminaBar(game, this))
    }

    get should_show(): boolean {
        return this.game.state !== "chill"
    }

    _update(context: GameUpdateContext): void {
        this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show)
    }
}

const game_root_selector = "#game-root"

export class Game extends Component<GameUpdateContext> {
    state: GameState = "chill"
    last_state: GameState = "chill"
    game_root_el: HTMLDivElement

    private _last_timestamp: number | null = null

    player_actor: PlayerActor
    enemy_actor: EnemyActor

    hud: Hud

    constructor() {
        super()

        this.game_root_el = get_element(game_root_selector) as HTMLDivElement
        this.game_root_el.classList.toggle("hidden", false)

        this.player_actor = this.add_component(new PlayerActor(this))
        this.enemy_actor = this.add_component(new EnemyActor(this))
        this.hud = this.add_component(new Hud(this))
    }

    get changed_state(): boolean {
        return this.state !== this.last_state
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

    _update(context: GameUpdateContext): void {
        this.game_root_el.classList.toggle("hide-mouse", this.state !== "chill")
        if (this.changed_state && this.last_state === "chill") {
            send_shell_request({type: "setVideoFilter", value: "blur(3px) brightness(0.8)"})
        }
    }

    step(timestamp: number): void {
        const context = {
            timestamp: timestamp,
            timedelta: this._last_timestamp != null ? timestamp - this._last_timestamp : null,
        } as GameUpdateContext
        this.update(context)
        this._last_timestamp = timestamp
        this.last_state = this.state
    }
}
