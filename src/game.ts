import {send_shell_request, ShellEvent} from "./shell"
import {dist, dist_pt, get_element, Point, smooth_ema, TargetFollower} from "./utils"

export type GameState = "chill" | "battle" | "defeat" | "victory"

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

abstract class Character extends Actor {
    private _follower: TargetFollower
    base_acceleration: number = 250
    base_max_vel: number = 100

    health: number = 100.0
    max_health: number = 100.0 // TODO: sanity check

    stamina: number = 100.0
    max_stamina: number = 100.0 // TODO: sanity check
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

    attack_characters: Array<Character> = []
    attack_requested: boolean = false
    attacking: boolean = false
    attack_stamina_consume: number = 30
    attack_duration: number = 150
    attack_radius: number = 100
    attack_damage: number = 20
    last_attack_hits: Array<Character> = []
    last_attack_ts: number = 0

    constructor(game: Game) {
        super(game)
        this._follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {acceleration: this.base_acceleration, max_vel: this.base_max_vel, slowing_distance: 50},
        )
    }

    get acceleration(): number {
        return this._follower.acceleration
    }
    set acceleration(value: number) {
        this._follower.acceleration = value
    }
    get max_vel(): number | null {
        return this._follower.max_vel
    }
    set max_vel(value: number | null) {
        this._follower.max_vel = value
    }
    get pos(): Point {
        return this._follower.pos
    }
    set pos(value: Point) {
        this._follower.pos = value
    }
    get target(): Point {
        return this._follower.target
    }
    set target(value: Point) {
        this._follower.target = value
    }

    get dead(): boolean {
        return this.health <= 0
    }
    get can_attack(): boolean {
        return !this.attacking && !this.low_stamina && !this.dead
    }

    _update(context: GameUpdateContext) {
        const s_delta = (context.timedelta ?? 0) / 1000

        let stamina_consume: number = 0

        if (context.timedelta != null) {
            this._follower.update(context.timedelta)
        } else {
            this._follower.pos = {...this._follower.target}
        }
        const vel_mag = dist_pt(this._follower.velocity)
        if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
            stamina_consume += vel_mag * this.stamina_movement_consume_factor * s_delta
        }

        if (this.attack_requested) {
            this.attack_requested = false
            if (this.can_attack) {
                this.attacking = true
                this.last_attack_ts = context.timestamp
                stamina_consume += this.attack_stamina_consume
                this._attack_start(context)
            }
        }
        if (this.attacking) {
            if (context.timestamp - this.last_attack_ts >= this.attack_duration) {
                this.attacking = false
                this._attack_end(context)
            } else {
                this._check_attack_hits(context)
            }
        }

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
        }

        this.max_vel = this.calc_max_vel()
        this.acceleration = this.calc_acceleration()
    }

    calc_acceleration(): number {
        return this.low_stamina ? this.low_stamina_accel : this.base_acceleration
    }
    calc_max_vel(): number {
        return this.dead ? 0 : this.low_stamina ? this.low_stamina_max_vel : this.base_max_vel
    }

    _check_attack_hits(context: GameUpdateContext) {
        for (const character of this.game.characters) {
            if (character === this) continue
            if (this.last_attack_hits.some((c) => c === character)) continue
            const distance = dist(this.pos.x - character.pos.x, this.pos.y - character.pos.y)
            if (distance < this.attack_radius) {
                character.attack_hit({attacking_character: this, damage: this.attack_damage, distance})
                this.last_attack_hits.push(character)
            }
        }
    }
    _attack_start(context: GameUpdateContext) {
        this.last_attack_hits = []
    }
    _attack_end(context: GameUpdateContext) {}
    attack_hit({
        attacking_character,
        damage,
        distance,
    }: {
        attacking_character: Character
        damage: number
        distance: number
    }) {
        this.health -= damage
        if (this.health < 0) this.health = 0
    }
}

const player_root_selector = ".player"

class Player extends Character {
    player_root_el: HTMLDivElement

    base_acceleration: number = 500
    base_max_vel: number = 200

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

        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this))
        this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this))
    }

    _on_mousemove(event: MouseEvent): void {
        const rect = this.game.game_root_el.getBoundingClientRect()
        this.target = {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }

    _on_mousedown(event: MouseEvent): void {
        this.attack_requested = true
    }

    _update(context: GameUpdateContext) {
        super._update(context)

        if (this.game.state === "battle" && this.dead) {
            this.game.state = "defeat"
        }

        this.player_root_el.classList.toggle("hidden", this.game.state === "chill")

        this.player_root_el.style.top = `${this.pos.y - this.player_root_el.clientHeight / 2}px`
        this.player_root_el.style.left = `${this.pos.x - this.player_root_el.clientWidth / 2}px`

        this.player_root_el.classList.toggle("attacking", this.attacking)

        this.player_root_el.classList.toggle("low-stamina", this.low_stamina)
    }

    _attack_start(context: GameUpdateContext) {
        super._attack_start(context)
        this.player_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1000}s`)
        this.player_root_el.style.setProperty("--attack-radius", `${this.attack_radius}px`)
    }
}

const enemy_root_selector = ".skip-btn"

class Enemy extends Character {
    enemy_root_el: HTMLDivElement

    base_acceleration: number = 10
    base_max_vel: number = 2

    health: number = 1000.0
    max_health: number = 1000.0

    attacking_acceleration: number = 100
    attacking_max_vel: number = 200
    attack_damage: number = 50
    attack_duration: number = 500
    // TODO: aggro: number = 0.0

    // TODO: AI
    next_attack_ts: number = 1e10
    auto_attack_dist: number = 200
    auto_attack_interval: [number, number] = [2000, 4000]

    constructor(game: Game) {
        super(game)

        this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el) as HTMLDivElement

        // make sure we use top+left and not bottom+right
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        this.enemy_root_el.style.top = `${rel_rect.y}px`
        this.enemy_root_el.style.left = `${rel_rect.x}px`
        this.enemy_root_el.style.bottom = "unset"
        this.enemy_root_el.style.right = "unset"
        this.target = this.pos = this.display_pos // initial position is whatever document styling defines

        this.enemy_root_el.addEventListener("click", this._aggro_trigger.bind(this))
    }

    get display_pos(): Point {
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        return {x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2}
    }

    _update(context: GameUpdateContext) {
        if (this.game.state === "battle" && !this.attacking) {
            this.target = {...this.game.player.pos}
        }

        super._update(context)

        if (this.game.state === "battle") {
            const player_dist = dist(this.pos.x - this.game.player.pos.x, this.pos.y - this.game.player.pos.y)
            if (this.can_attack && context.timestamp > this.next_attack_ts && player_dist <= this.auto_attack_dist) {
                this.attack_requested = true
            }

            if (this.dead) {
                this.game.state = "victory"
            }
        }

        this.enemy_root_el.style.top = `${this.pos.y - this.enemy_root_el.clientHeight / 2}px`
        this.enemy_root_el.style.left = `${this.pos.x - this.enemy_root_el.clientWidth / 2}px`

        this.enemy_root_el.classList.toggle("attacking", this.attacking)
    }

    calc_acceleration(): number {
        return this.attacking ? this.attacking_acceleration : super.calc_acceleration()
    }
    calc_max_vel(): number {
        return this.attacking ? this.attacking_max_vel : super.calc_max_vel()
    }

    _attack_start(context: GameUpdateContext) {
        super._attack_start(context)
        this.enemy_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1000}s`)
        this.enemy_root_el.style.setProperty("--attack-radius", `${this.attack_radius}px`)
    }
    _attack_end(context: GameUpdateContext) {
        super._attack_end(context)

        this.next_attack_ts = this.calc_next_attack_ts(context.timestamp)
    }

    calc_next_attack_ts(now_ts: number) {
        return (
            now_ts +
            this.auto_attack_interval[0] +
            Math.random() * (this.auto_attack_interval[1] - this.auto_attack_interval[0])
        )
    }

    _aggro_trigger() {
        if (this.game.state === "chill") {
            this.game.state = "battle"

            // move to center of screen
            const game_rect = this.game.rect
            this.target = {x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2}

            this.next_attack_ts = this.calc_next_attack_ts(performance.now())
        }
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

const hud_player_health_bar_selector = ".player-bar.bar.health"

class PlayerHealthBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_player_health_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.player.health, max: this.game.player.max_health}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
        }
    }
}

const hud_player_stamina_bar_selector = ".player-bar.bar.stamina"

class PlayerStaminaBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_player_stamina_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.player.stamina, max: this.game.player.max_stamina}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
            this.bar_root_el.classList.toggle("low-stamina", this.game.player.low_stamina)
        }
    }
}

const hud_enemy_health_bar_selector = ".enemy-bar.bar.health"

class EnemyHealthBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_enemy_health_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.enemy.health, max: this.game.enemy.max_health}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
        }
    }
}

const hud_root_selector = ".hud"
const hud_hidden_class = "hidden"

class Hud extends GameComponent {
    hud_root_el: HTMLDivElement

    player_health_bar: PlayerHealthBar
    player_stamina_bar: PlayerStaminaBar
    enemy_health_bar: EnemyHealthBar

    constructor(game: Game) {
        super(game)

        this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el) as HTMLDivElement

        this.player_health_bar = this.add_component(new PlayerHealthBar(game, this))
        this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game, this))
        this.enemy_health_bar = this.add_component(new EnemyHealthBar(game, this))
    }

    get should_show(): boolean {
        return this.game.state !== "chill"
    }

    _update(context: GameUpdateContext): void {
        this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show)
    }
}

const defeat_screen_selector = ".defeat-screen"

class DefeatScreen extends GameComponent {
    defeat_screen_el: HTMLDivElement

    constructor(game: Game) {
        super(game)

        this.defeat_screen_el = get_element(defeat_screen_selector, this.game.game_root_el) as HTMLDivElement
    }

    _update(context: GameUpdateContext) {
        this.defeat_screen_el.classList.toggle("hidden", this.game.state !== "defeat")
    }
}

const victory_screen_selector = ".victory-screen"

class VictoryScreen extends GameComponent {
    victory_screen_el: HTMLDivElement

    constructor(game: Game) {
        super(game)

        this.victory_screen_el = get_element(victory_screen_selector, this.game.game_root_el) as HTMLDivElement
    }

    _update(context: GameUpdateContext) {
        this.victory_screen_el.classList.toggle("hidden", this.game.state !== "victory")
    }
}

const game_root_selector = "#game-root"

export class Game extends Component<GameUpdateContext> {
    state: GameState = "chill"
    last_state: GameState = "chill"
    game_root_el: HTMLDivElement

    private _last_timestamp: number | null = null

    player: Player
    enemy: Enemy
    characters: Array<Character> = []

    hud: Hud

    defeat_screen: DefeatScreen
    victory_screen: VictoryScreen

    constructor() {
        super()

        this.game_root_el = get_element(game_root_selector) as HTMLDivElement
        this.game_root_el.classList.toggle("hidden", false)

        this.player = this.add_character(this.add_component(new Player(this)))
        this.enemy = this.add_character(this.add_component(new Enemy(this)))

        this.hud = this.add_component(new Hud(this))

        this.defeat_screen = this.add_component(new DefeatScreen(this))
        this.victory_screen = this.add_component(new VictoryScreen(this))
    }

    add_character<C extends Character>(character: C): C {
        this.characters.push(character)
        return character
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

    get rect(): DOMRect {
        return this.game_root_el.getBoundingClientRect()
    }

    get_relative_rect(el: HTMLElement): DOMRect {
        const {x: game_x, y: game_y} = this.rect
        const el_rect = el.getBoundingClientRect()
        return new DOMRect(el_rect.x - game_x, el_rect.y - game_y, el_rect.width, el_rect.height)
    }
}
