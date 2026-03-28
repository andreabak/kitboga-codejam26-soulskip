import {send_shell_request, ShellEvent} from "./shell"
import {
    aabb_overlap,
    delay,
    dist,
    dist_pt,
    fade_audio,
    get_element,
    HitBox,
    play_audio_element,
    Point,
    random_pick,
    Rect,
    rect_center_dist,
    rect_to_shape,
    sat_overlap,
    Shape,
    shape_bbox,
    TargetFollower,
    transform_shape,
} from "./utils"

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
    timeref: number

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

type AttackPhases = "anticipation" | "hit" | "recovery"
const ATTACK_PHASES_SEQUENCE: Array<AttackPhases> = ["anticipation", "hit", "recovery"]
type AttackPhaseDef = {
    duration: number
    acceleration?: number | null
    max_vel?: number | null
    animation?: unknown // TODO
}
type AttackDef = {
    phases: Required<Record<AttackPhases, AttackPhaseDef>>
    damage: number
    stamina_consume: number
    parry_window_duration: number
    scale: number
    hitbox: HitBox
}
type AttackPhase = AttackPhaseDef & {
    start_ts?: number | null
}
type Attack = AttackDef & {
    start_ts: number
    phases: Required<Record<AttackPhases, AttackPhase>>
    current_phase: AttackPhases
}

abstract class Character extends Actor {
    private _follower: TargetFollower
    base_acceleration: number = 250
    base_max_vel: number = 100

    abstract width: number
    abstract height: number
    origin: Point = {x: 24, y: 24} // TODO: unused
    rotates: boolean = false

    health: number = 100.0
    max_health: number = 100.0 // TODO: sanity check
    last_damage_ts: number = -Infinity

    stamina: number = 100.0
    max_stamina: number = 100.0 // TODO: sanity check
    stamina_movement_consume_factor: number = 8.0
    stamina_movement_vel_min: number = 40.0
    stamina_recover: number = 100.0
    stamina_recover_delay: number = 1000
    last_stamina_consume_ts: number = -Infinity
    low_stamina_max_vel: number = 5
    low_stamina_accel: number = 100
    low_stamina: boolean = false
    low_stamina_enter_threshold: number = 1 // TODO: sanity check
    low_stamina_exit_threshold: number = 100 // TODO: sanity check

    abstract hurtbox_def: HitBox

    attack_requested: boolean = false
    current_attack: Attack | null = null
    attack_stamina_consume_multiplier: number = 1.0
    last_attack_hits: Array<Character> = []
    abstract attacks_defs: Record<string, AttackDef>

    defend_requested: boolean = false
    defend_request_ts: number = -Infinity
    defend_damage_reduction: number = 0.75
    defend_stamina_consume_factor: number = 0.3
    defend_acceleration: number = 50
    defend_max_vel: number = 5
    defending: boolean = false

    parry_enemy_stamina_consume_factor: number = 0.1

    constructor(game: Game) {
        super(game)
        this._follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {
                acceleration: this.base_acceleration,
                max_vel: this.base_max_vel,
                slowing_distance: 25,
                vel_max_rotation: ((10 * 360) / 180) * Math.PI,
                dir_max_rotation: ((2 * 360) / 180) * Math.PI,
            },
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
    get pos_target(): Point {
        return this._follower.pos_target
    }
    set pos_target(value: Point) {
        this._follower.pos_target = value
    }
    get dir_target(): Point | "pos" | null {
        return this._follower.dir_target
    }
    set dir_target(value: Point) {
        this._follower.dir_target = value
    }
    get direction(): number {
        return this._follower.direction
    }
    get direction_vector(): Point {
        return this._follower.direction_vector
    }

    get attacking(): boolean {
        return this.current_attack != null
    }
    get current_attack_phase(): AttackPhase | null {
        if (this.current_attack == null) return null
        return this.current_attack.phases[this.current_attack.current_phase]
    }

    _transform_shape(
        rel_shape: Shape | Rect,
        {
            rotation_ref = 0,
            rotates = true,
            scale_ref = 1.0,
            keep_aspect_ratio = false,
        }: {rotation_ref?: number; rotates?: boolean; scale_ref?: number; keep_aspect_ratio?: boolean} = {},
    ): Shape {
        let shape = rel_shape
        if (!("points" in shape)) {
            shape = rect_to_shape(shape)
        }
        let scale = {x: this.width / 2, y: this.height / 2}
        if (keep_aspect_ratio) {
            const uniform_scale = (scale.x + scale.y) / 2
            scale = {x: uniform_scale, y: uniform_scale}
        }
        shape = transform_shape(shape, {
            rotate: (rotates ? this._follower.direction : 0) - rotation_ref,
            scale: {x: scale.x * scale_ref, y: scale.y * scale_ref},
        })
        return shape
    }

    get hurtbox(): Shape {
        return this._transform_shape(this.hurtbox_def.shape, {
            rotation_ref: this.hurtbox_def.rotation_ref,
            rotates: this.rotates,
        })
    }
    get hurtbox_abs(): Shape {
        return transform_shape(this.hurtbox, {translate: this.pos})
    }
    get attack_hitbox(): Shape | null {
        if (!this.current_attack) {
            return null
        }
        return this._transform_shape(this.current_attack.hitbox.shape, {
            rotation_ref: this.current_attack.hitbox.rotation_ref,
            rotates: true,
            scale_ref: this.current_attack.scale,
            keep_aspect_ratio: true,
        })
    }
    get attack_hitbox_abs(): Shape | null {
        const attack_hitbox = this.attack_hitbox
        if (!attack_hitbox) return null
        return transform_shape(this.attack_hitbox, {translate: this.pos})
    }

    get dead(): boolean {
        return this.health <= 0
    }
    get can_attack(): boolean {
        return !this.attacking && !this.low_stamina && !this.dead
    }

    get can_defend(): boolean {
        return !this.attacking && !this.low_stamina && !this.dead
    }
    get can_parry(): boolean {
        return !this.attacking && !this.low_stamina && !this.dead
    }

    consume_stamina(amount: number, {context}: {context: GameUpdateContext}) {
        this.stamina -= amount
        if (this.stamina < 0) this.stamina = 0
        this.last_stamina_consume_ts = context.timeref
    }

    _update(context: GameUpdateContext) {
        const s_delta = (context.timedelta ?? 0) / 1000

        if (context.timedelta != null) {
            this._follower.update(context.timedelta)
        } else {
            this._follower.pos = {...this._follower.pos_target}
        }
        const vel_mag = dist_pt(this._follower.velocity)
        if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
            this.consume_stamina(vel_mag * this.stamina_movement_consume_factor * s_delta, {context})
        }

        if (this.attack_requested) {
            this.attack_requested = false
            if (this.can_attack) {
                const attack_def = this.new_attack()
                this.current_attack = {
                    ...attack_def,
                    start_ts: context.timeref,
                    current_phase: ATTACK_PHASES_SEQUENCE[0],
                }
                this.current_attack.phases[this.current_attack.current_phase].start_ts = context.timeref
                this.consume_stamina(this.current_attack.stamina_consume * this.attack_stamina_consume_multiplier, {
                    context,
                })
                this.last_attack_hits = []
                this._attack_start(this.current_attack, {context})
            }
        }
        if (this.current_attack) {
            const current_phase = this.current_attack.phases[this.current_attack.current_phase]
            if (current_phase.start_ts == null) {
                current_phase.start_ts = context.timeref
            } else if (current_phase.start_ts + current_phase.duration <= context.timeref) {
                const phase_idx = ATTACK_PHASES_SEQUENCE.indexOf(this.current_attack.current_phase)
                if (phase_idx + 1 < ATTACK_PHASES_SEQUENCE.length) {
                    const next_phase_name = ATTACK_PHASES_SEQUENCE[phase_idx + 1]
                    this.current_attack.current_phase = next_phase_name
                    this.current_attack.phases[next_phase_name].start_ts = context.timeref
                } else {
                    this._attack_end(this.current_attack, {context})
                    this.current_attack = null
                }
            }
            if (this.current_attack?.current_phase === "hit") {
                this._check_attack_hits(context)
            }
        }

        if (this.defend_requested) {
            if (this.can_defend) {
                this.defending = true
            }
        }
        if (this.defending) {
            if (!this.defend_requested || !this.can_defend) {
                this.defending = false
            }
        }

        if (context.timedelta && context.timedelta > 0) {
            if (context.timeref - this.last_stamina_consume_ts >= this.stamina_recover_delay) {
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
        return this.attacking
            ? (this.current_attack_phase?.acceleration ?? this.base_acceleration)
            : this.defending
              ? this.defend_acceleration
              : this.low_stamina
                ? this.low_stamina_accel
                : this.base_acceleration
    }
    calc_max_vel(): number {
        return this.dead
            ? 0
            : this.attacking
              ? (this.current_attack_phase?.max_vel ?? this.base_max_vel)
              : this.defending
                ? this.defend_max_vel
                : this.low_stamina
                  ? this.low_stamina_max_vel
                  : this.base_max_vel
    }

    abstract new_attack(): AttackDef
    _attack_start(attack: Attack, {context}: {context: GameUpdateContext}) {}
    _attack_end(attack: Attack, {context}: {context: GameUpdateContext}) {}
    _check_attack_hits(context: GameUpdateContext) {
        if (this.current_attack?.current_phase !== "hit") return
        for (const character of this.game.characters) {
            if (character === this) continue
            if (this.last_attack_hits.some((c) => c === character)) continue
            const attack_hitbox_abs = this.attack_hitbox_abs
            if (attack_hitbox_abs == null) throw new Error("expected attack hitbox with current_attack set")
            const character_hurtbox_abs = character.hurtbox_abs
            const attack_hitbox_bbox = shape_bbox(attack_hitbox_abs)
            const character_hurtbox_bbox = shape_bbox(character_hurtbox_abs)
            if (
                aabb_overlap(character_hurtbox_bbox, attack_hitbox_bbox) &&
                sat_overlap(attack_hitbox_abs, character_hurtbox_abs) &&
                character.attack_hit({attack: this.current_attack, attacking_character: this, context})
            ) {
                this.last_attack_hits.push(character)
            }
        }
    }
    attack_hit({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack
        attacking_character: Character
        context: GameUpdateContext
    }): boolean {
        console.assert(attack.current_phase === "hit")
        if (this.can_parry) {
            const within_parry_window =
                Math.abs(
                    (this.defending ? this.defend_request_ts : context.timeref) -
                        (attack.phases["hit"].start_ts ?? Infinity),
                ) <
                attack.parry_window_duration / 2
            if (within_parry_window) {
                if (!this.defending) {
                    return false // not parrying yet, but still in window, ignore hit this step, recheck later
                } else if (this.attack_parry({attack, attacking_character, context})) {
                    return true // parried, no further damage to this
                }
            }
        }
        let health_damage = attack.damage
        if (this.defending && !this.low_stamina) {
            const stamina_consume = attack.damage * this.defend_stamina_consume_factor
            this.consume_stamina(stamina_consume, {context})
            health_damage *= 1.0 - this.defend_damage_reduction
        }
        if (health_damage >= 0) {
            this.health -= health_damage
            this.last_damage_ts = context.timeref
            if (this.health < 0) this.health = 0
        }
        return true
    }
    attack_parry({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack
        attacking_character: Character
        context: GameUpdateContext
    }): boolean {
        attacking_character.consume_stamina(attack.damage * this.parry_enemy_stamina_consume_factor, {context})
        return true // no damage to us
    }
}

const player_root_selector = ".player"
const parry_audio_selector = ".sound.parry"
const enemy_break_audio_selector = ".sound.enemy-break"

class Player extends Character {
    player_root_el: HTMLDivElement

    width: number = 48
    height: number = 48

    base_acceleration: number = 500
    base_max_vel: number = 100

    health: number = 1850.0
    max_health: number = 1850.0

    stamina: number = 200.0
    max_stamina: number = 200.0
    stamina_movement_consume_factor: number = 14.0
    stamina_movement_vel_min: number = 30.0
    stamina_recover: number = 100.0
    stamina_recover_delay: number = 500
    last_stamina_consume_ts: number = -Infinity
    low_stamina_max_vel: number = 1
    low_stamina_accel: number = 100
    low_stamina: boolean = false
    low_stamina_enter_threshold: number = 1 // TODO: sanity check
    low_stamina_exit_threshold: number = 200 // TODO: sanity check

    hurtbox_def: HitBox = {shape: {x: 0, y: 0, width: 0.75, height: 1}, rotation_ref: 0}

    attacks_defs = {
        fast: {
            phases: {
                anticipation: {duration: 50, acceleration: 20},
                hit: {duration: 150, acceleration: 10},
                recovery: {duration: 100, acceleration: 50},
            },
            damage: 213,
            stamina_consume: 30,
            parry_window_duration: 200,
            scale: 3.0,
            hitbox: {
                shape: {
                    points: [
                        {x: -1.0, y: 0.0},
                        {x: -0.71, y: -0.71},
                        {x: 0.0, y: -1.0},
                        {x: 0.71, y: -0.71},
                        {x: 1.0, y: 0.0},
                        {x: 0.25, y: 0.25},
                        {x: -0.25, y: 0.25},
                    ],
                },
                rotation_ref: (-90 / 180) * Math.PI,
            },
        },
    }

    constructor(game: Game) {
        super(game)

        this.player_root_el = get_element(player_root_selector, this.game.game_root_el) as HTMLDivElement

        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this))
        this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this))
        this.game.game_root_el.addEventListener("mouseup", this._on_mouseup.bind(this))
        this.game.game_root_el.addEventListener("contextmenu", (e) => {
            e.preventDefault()
            return false
        })
    }

    _on_mousemove(event: MouseEvent): void {
        const rect = this.game.game_root_el.getBoundingClientRect()
        this.pos_target = {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }
    _on_mousedown(event: MouseEvent): void {
        if (event.button === 0) {
            this.attack_requested = true
        } else if (event.button === 2) {
            this.defend_request_ts = this.game.timeref
            this.defend_requested = true
        }
    }
    _on_mouseup(event: MouseEvent): void {
        if (event.button === 2) {
            this.defend_request_ts = this.game.timeref
            this.defend_requested = false
        }
    }

    _update(context: GameUpdateContext) {
        super._update(context)

        if (this.game.state === "battle" && !this.attacking) {
            this.dir_target = {...this.game.enemy.pos}
        }

        if (this.game.state === "battle" && this.dead) {
            this.game.change_state_soon("defeat")
        }

        this.player_root_el.classList.toggle("hidden", this.game.state === "chill")

        this.player_root_el.style.top = `${this.pos.y - this.player_root_el.clientHeight / 2}px`
        this.player_root_el.style.left = `${this.pos.x - this.player_root_el.clientWidth / 2}px`

        this.player_root_el.classList.toggle("attacking", this.attacking)
        for (const phase of ATTACK_PHASES_SEQUENCE) {
            this.player_root_el.classList.toggle(`attack-phase-${phase}`, this.current_attack?.current_phase == phase)
        }
        this.player_root_el.classList.toggle("defending", this.defending)

        this.player_root_el.classList.toggle("low-stamina", this.low_stamina)
        this.player_root_el.classList.toggle("hurt", context.timeref - this.last_damage_ts < 500)
    }

    new_attack(): AttackDef {
        return this.attacks_defs["fast"]
    }
    _attack_start(attack: Attack, {context}: {context: GameUpdateContext}) {
        super._attack_start(attack, {context})
        this.player_root_el.style.setProperty("--attack-scale", attack.scale.toString())
    }
    attack_parry({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack
        attacking_character: Character
        context: GameUpdateContext
    }): boolean {
        const do_parry = super.attack_parry({attack, attacking_character, context})
        if (do_parry) {
            this.game.timescale = 0.1
            setTimeout(() => (this.game.timescale = 1.0), 500)
            if (attacking_character.stamina < attacking_character.low_stamina_enter_threshold) {
                play_audio_element(enemy_break_audio_selector, this.game.game_root_el)
            } else {
                play_audio_element(parry_audio_selector, this.game.game_root_el)
            }
        }
        return do_parry
    }
}

const enemy_root_selector = ".skip-btn"

class Enemy extends Character {
    enemy_root_el: HTMLDivElement

    width: number
    height: number

    base_acceleration: number = 10
    base_max_vel: number = 2

    health: number = 5000.0
    max_health: number = 5000.0

    hurtbox_def: HitBox = {shape: {x: -1, y: -1, width: 2, height: 2}, rotation_ref: 0}

    max_stamina: number = 150.0 // TODO: sanity check
    stamina_recover: number = 25
    stamina_recover_delay: number = 2000
    low_stamina_max_vel: number = 0
    low_stamina_enter_threshold: number = 1 // TODO: sanity check
    low_stamina_exit_threshold: number = 150 // TODO: sanity check

    attacks_defs = {
        slow: {
            phases: {
                anticipation: {duration: 300, acceleration: 100, max_vel: 100},
                hit: {duration: 200, acceleration: 5, max_vel: 2},
                recovery: {duration: 500, acceleration: 20, max_vel: 4},
            },
            damage: 500,
            stamina_consume: 6,
            parry_window_duration: 100,
            scale: 2.5,
            hitbox: {
                shape: {
                    points: [
                        {x: -1.0, y: 0.0},
                        {x: -0.71, y: -0.71},
                        {x: 0.0, y: -1.0},
                        {x: 0.71, y: -0.71},
                        {x: 1.0, y: 0.0},
                        {x: 0.25, y: 0.25},
                        {x: -0.25, y: 0.25},
                    ],
                },
                rotation_ref: (-90 / 180) * Math.PI,
            },
        },
        fast: {
            phases: {
                anticipation: {duration: 150, acceleration: 100, max_vel: 100},
                hit: {duration: 200, acceleration: 5, max_vel: 2},
                recovery: {duration: 250, acceleration: 20, max_vel: 4},
            },
            damage: 250,
            stamina_consume: 3,
            parry_window_duration: 100,
            scale: 2.5,
            hitbox: {
                shape: {
                    points: [
                        {x: -1.0, y: 0.0},
                        {x: -0.71, y: -0.71},
                        {x: 0.0, y: -1.0},
                        {x: 0.71, y: -0.71},
                        {x: 1.0, y: 0.0},
                        {x: 0.25, y: 0.25},
                        {x: -0.25, y: 0.25},
                    ],
                },
                rotation_ref: (-90 / 180) * Math.PI,
            },
        },
    }
    attacks_chains_defs: Record<string, Array<keyof typeof Enemy.prototype.attacks_defs>> = {
        fast_flurry: ["fast", "fast", "fast"],
        fast_slow_flurry: ["fast", "fast", "slow"],
        slow_fast_duplet: ["slow", "fast"],
    }
    current_attack_chain: {
        def: (typeof Enemy.prototype.attacks_chains_defs)[keyof typeof Enemy.prototype.attacks_chains_defs]
        index: number
    } | null = null
    // TODO: aggro: number = 0.0

    // TODO: AI
    follow_dist_offset: number = 5
    next_attack_ts: number = 1e10
    auto_attack_dist: number = 400
    auto_attack_interval: [number, number] = [1500, 3000]

    constructor(game: Game) {
        super(game)

        this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el) as HTMLDivElement

        // make sure we use top+left and not bottom+right
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        this.enemy_root_el.style.top = `${rel_rect.y}px`
        this.enemy_root_el.style.left = `${rel_rect.x}px`
        this.enemy_root_el.style.bottom = "unset"
        this.enemy_root_el.style.right = "unset"
        this.pos_target = this.pos = this.display_pos // initial position is whatever document styling defines
        this.width = rel_rect.width
        this.height = rel_rect.height

        this.enemy_root_el.addEventListener("click", this._aggro_trigger.bind(this))
    }

    get display_pos(): Point {
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        return {x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2}
    }

    _update(context: GameUpdateContext) {
        if (this.game.state === "battle" && !this.attacking) {
            this.pos_target = this._get_reach_player_point()
            this.dir_target = {...this.game.player.pos}
        }

        const low_stamina_before = this.low_stamina
        super._update(context)

        if (this.game.state === "battle") {
            const player_dist = dist(this.pos.x - this.game.player.pos.x, this.pos.y - this.game.player.pos.y)
            if (
                this.can_attack &&
                (this.current_attack_chain ||
                    (context.timeref > this.next_attack_ts && player_dist <= this.auto_attack_dist))
            ) {
                this.attack_requested = true
            } else if (!this.attacking && !this.can_attack) {
                if (this.current_attack_chain != null) this.current_attack_chain = null
            }

            if (!low_stamina_before && this.low_stamina) {
                play_audio_element(enemy_break_audio_selector, this.game.game_root_el)
            }

            if (this.dead) {
                this.game.change_state_soon("victory")
            }
        }

        this.enemy_root_el.style.top = `${this.pos.y - this.enemy_root_el.clientHeight / 2}px`
        this.enemy_root_el.style.left = `${this.pos.x - this.enemy_root_el.clientWidth / 2}px`

        this.enemy_root_el.classList.toggle("attacking", this.attacking)
        for (const phase of ATTACK_PHASES_SEQUENCE) {
            this.enemy_root_el.classList.toggle(`attack-phase-${phase}`, this.current_attack?.current_phase == phase)
        }
    }

    _get_reach_player_point(): Point {
        const origin_bbox = shape_bbox(this.hurtbox_abs)
        const origin = {x: origin_bbox.x + origin_bbox.width / 2, y: origin_bbox.y + origin_bbox.height / 2}
        const target_bbox = shape_bbox(this.game.player.hurtbox_abs)
        const target = {x: target_bbox.x + target_bbox.width / 2, y: target_bbox.y + target_bbox.height / 2}

        const line_vec: Point = {x: target.x - origin.x, y: target.y - origin.y}
        const line_angle = Math.atan2(line_vec.y, line_vec.x)
        const line_dist = dist(line_vec.x, line_vec.y)
        const offset_dist =
            rect_center_dist(origin_bbox, line_angle) +
            rect_center_dist(target_bbox, line_angle) +
            this.follow_dist_offset
        let reach_dist = line_dist - offset_dist
        // if overlapping target already, approach slow
        if (reach_dist < 0) {
            reach_dist = 1
        }
        // find point on line distant offset_dist to target
        return {
            x: origin.x + line_vec.x * (reach_dist / line_dist),
            y: origin.y + line_vec.y * (reach_dist / line_dist),
        }
    }

    new_attack(): AttackDef {
        if (
            this.current_attack_chain == null ||
            this.current_attack_chain.index >= this.current_attack_chain.def.length - 1
        ) {
            const chain_def = random_pick(Object.values(this.attacks_chains_defs))
            this.current_attack_chain = {def: chain_def, index: 0}
        } else {
            this.current_attack_chain.index += 1
        }
        const next_attack = this.current_attack_chain.def[this.current_attack_chain.index]
        return this.attacks_defs[next_attack]
    }
    _attack_start(attack: Attack, {context}: {context: GameUpdateContext}) {
        super._attack_start(attack, {context})
        this.enemy_root_el.style.setProperty("--attack-scale", attack.scale.toString())
    }
    _attack_end(attack: Attack, {context}: {context: GameUpdateContext}) {
        super._attack_end(attack, {context})
        if (
            this.current_attack_chain != null &&
            this.current_attack_chain.index >= this.current_attack_chain.def.length - 1
        )
            this.current_attack_chain = null
        this.next_attack_ts = this.calc_next_attack_ts(context.timeref)
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
            this.game.change_state_soon("battle")

            // move to center of screen
            const game_rect = this.game.rect
            this.pos_target = {x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2}

            this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref)
        }
    }
}

abstract class HudBar extends GameComponent {
    hud: Hud
    abstract bar_root_el: HTMLDivElement

    value: number = 0
    max: number = 0
    max_recent: number = 0
    max_ts: number = -Infinity

    recent_delay: number = 1000
    decay_pct_speed: number = 200

    constructor(game: Game, hud: Hud) {
        super(game)
        this.hud = hud
    }

    abstract _get_values(): {value: number; max: number}

    _update(context: GameUpdateContext): void {
        const {value, max} = this._get_values()
        this.value = value
        this.max = max
        if (this.value >= this.max_recent) {
            this.max_recent = this.value
            this.max_ts = context.timeref
        } else if (this.max_recent >= value && context.timeref - this.max_ts > this.recent_delay) {
            this.max_recent -= this.max * ((this.decay_pct_speed / 100) * ((context.timedelta ?? 0) / 1000))
        }
        const pct_value = this.value / this.max
        const pct_diff = (this.max_recent - value) / this.max
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
const hud_enemy_damage_selector = ".boss-info .damage"

class EnemyHealthBar extends HudBar {
    bar_root_el: HTMLDivElement
    damage_el: HTMLDivElement

    last_value: number = 0
    damage_value_max: number = 0
    last_value_change_ts: number = -Infinity
    damage_reset_delay: number = 2000

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_enemy_health_bar_selector, this.hud.hud_root_el) as HTMLDivElement
        this.damage_el = get_element(hud_enemy_damage_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.enemy.health, max: this.game.enemy.max_health}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
            if (this.value != this.last_value) {
                this.last_value_change_ts = context.timeref
            }
            if (
                this.value < this.damage_value_max &&
                context.timeref - this.last_value_change_ts < this.damage_reset_delay
            ) {
                const diff = this.damage_value_max - this.value
                this.damage_el.innerText = diff.toFixed(0)
            } else {
                this.damage_value_max = this.value
                this.damage_el.innerText = ""
            }
            this.last_value = this.value
        }
    }
}

const hud_enemy_stamina_bar_selector = ".enemy-bar.bar.stamina"

class EnemyStaminaBar extends HudBar {
    bar_root_el: HTMLDivElement

    constructor(game: Game, hud: Hud) {
        super(game, hud)

        this.bar_root_el = get_element(hud_enemy_stamina_bar_selector, this.hud.hud_root_el) as HTMLDivElement
    }

    _get_values(): {value: number; max: number} {
        return {value: this.game.enemy.stamina, max: this.game.enemy.max_stamina}
    }

    _update(context: GameUpdateContext) {
        if (this.hud.should_show) {
            super._update(context)
            this.bar_root_el.classList.toggle("low-stamina", this.game.enemy.low_stamina)
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
    enemy_stamina_bar: EnemyStaminaBar
    show_enemy_stamina_bar: boolean = true // TODO: debug only

    constructor(game: Game) {
        super(game)

        this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el) as HTMLDivElement

        this.player_health_bar = this.add_component(new PlayerHealthBar(game, this))
        this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game, this))
        this.enemy_health_bar = this.add_component(new EnemyHealthBar(game, this))
        this.enemy_stamina_bar = this.add_component(new EnemyStaminaBar(game, this))
    }

    get should_show(): boolean {
        return this.game.state !== "chill"
    }

    _update(context: GameUpdateContext): void {
        this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show)
        this.enemy_stamina_bar.bar_root_el.classList.toggle(hud_hidden_class, !this.show_enemy_stamina_bar)
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
const battle_start_audio_selector = ".sound.battle-start"
const defeat_audio_selector = ".sound.defeat"
const victory_audio_selector = ".sound.victory"

export class Game extends Component<GameUpdateContext> {
    private _state: GameState = "chill"
    private _last_state: GameState = "chill"
    private _next_state: GameState | null = null

    private _timeref: number = 0.0
    _timescale: number = 1.0
    private _last_step_ts: number | null = null

    game_root_el: HTMLDivElement

    player: Player
    enemy: Enemy
    characters: Array<Character> = []

    hud: Hud

    defeat_screen: DefeatScreen
    victory_screen: VictoryScreen

    private debug_hitboxes: boolean = true

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
        return this.state !== this._last_state
    }
    get state(): GameState {
        return this._state
    }
    change_state_soon(new_state: GameState): void {
        this._next_state = new_state
    }

    get timeref(): number {
        return this._timeref
    }
    get timescale(): number {
        return this._timescale
    }
    set timescale(value: number) {
        this._timescale = value
        send_shell_request({type: "setPlaybackRate", value: value})
    }

    handle_shell_event(event: ShellEvent | unknown): void {
        if (!event || typeof event !== "object" || !("type" in event)) {
            console.warn("Received unknown event object", event)
            return
        }
        // repeat ad forever
        if (event.type === "adFinished") {
            send_shell_request({type: "seekTo", value: 0})
            send_shell_request({type: "play"})
        }
    }

    _update(context: GameUpdateContext): void {
        this.game_root_el.classList.toggle("hide-mouse", this.state !== "chill")
        if (this.changed_state) {
            if (this.state === "battle") {
                send_shell_request({type: "setVideoFilter", value: "blur(3px) brightness(0.8)"})
                play_audio_element(battle_start_audio_selector, this.game_root_el).then(async () => {
                    await delay(3500)
                    const battle_start_audio_el = get_element(
                        battle_start_audio_selector,
                        this.game_root_el,
                    ) as HTMLAudioElement
                    await fade_audio(battle_start_audio_el, {duration: 15000, volume: 0, stop_after: true})
                })
            } else if (this.state === "defeat") {
                play_audio_element(defeat_audio_selector, this.game_root_el)
                setTimeout(() => send_shell_request({type: "fail"}), 7000)
            } else if (this.state === "victory") {
                play_audio_element(victory_audio_selector, this.game_root_el)
                setTimeout(() => send_shell_request({type: "success"}), 7000)
            }
        }
    }

    step(timestamp: number): void {
        const last_timeref = this._timeref
        if (this._last_step_ts != null) {
            this._timeref += (timestamp - this._last_step_ts) * this.timescale
        }
        const context = {
            timeref: this._timeref,
            timedelta: this._timeref - last_timeref,
        } as GameUpdateContext
        if (this._next_state != null) {
            this._state = this._next_state
            this._next_state = null
        }
        this.update(context)
        this._debug_hitboxes()
        this._last_state = this._state
        this._last_step_ts = timestamp
    }

    get rect(): DOMRect {
        return this.game_root_el.getBoundingClientRect()
    }

    get_relative_rect(el: HTMLElement): DOMRect {
        const {x: game_x, y: game_y} = this.rect
        const el_rect = el.getBoundingClientRect()
        return new DOMRect(el_rect.x - game_x, el_rect.y - game_y, el_rect.width, el_rect.height)
    }

    _debug_hitboxes() {
        const svg_id = "hitboxes"
        const svg_els = this.game_root_el.querySelectorAll(`#${svg_id}`)
        for (const el of svg_els) {
            el.parentNode?.removeChild(el)
        }
        if (this.debug_hitboxes) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.id = svg_id
            svg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${this.rect.width}px;
                height: ${this.rect.height}px;
                pointer-events: none;
            `
            this.game_root_el.appendChild(svg)

            for (const character of this.characters) {
                const create_path_from_points = (points: Array<Point>): SVGPathElement | null => {
                    if (points.length === 0) return null

                    const d_parts = []
                    for (let i = 0; i < points.length; i++) {
                        const ptyp = i === 0 ? "M" : "L"
                        d_parts.push(`${ptyp} ${points[i].x} ${points[i].y}`)
                    }
                    d_parts.push("Z")

                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
                    path.setAttribute("d", d_parts.join(" "))

                    return path
                }

                const hurtbox_path = create_path_from_points(character.hurtbox_abs.points)
                if (hurtbox_path) {
                    hurtbox_path.style.fill = "hsla(195, 100%, 50%, 0.4)"
                    svg.appendChild(hurtbox_path)
                }

                const direction_vec = character.direction_vector
                const dir_vector_path = create_path_from_points([
                    character.pos,
                    {x: character.pos.x + direction_vec.x * 20, y: character.pos.y + direction_vec.y * 20},
                ])
                if (dir_vector_path) {
                    dir_vector_path.style.stroke = "hsla(0, 100%, 50%, 0.4)"
                    dir_vector_path.style.strokeWidth = "2px"
                    svg.appendChild(dir_vector_path)
                }

                const attack_hitbox_abs = character.attack_hitbox_abs
                if (attack_hitbox_abs) {
                    const attack_hitbox_bbox = shape_bbox(attack_hitbox_abs)
                    let attack_would_hit = false
                    for (const other of this.characters) {
                        if (other === character) continue
                        const other_hurtbox_abs = other.hurtbox_abs
                        const other_hurtbox_bbox = shape_bbox(other_hurtbox_abs)
                        if (
                            aabb_overlap(other_hurtbox_bbox, attack_hitbox_bbox) &&
                            sat_overlap(attack_hitbox_abs, other_hurtbox_abs)
                        ) {
                            attack_would_hit = true
                            break
                        }
                    }
                    const current_phase = character.current_attack?.current_phase
                    const phase_color =
                        current_phase === "anticipation"
                            ? "hsl(220, 100%, 55%)"
                            : current_phase === "hit"
                              ? "hsl(0, 100%, 50%)"
                              : current_phase === "recovery"
                                ? "hsl(0, 0%, 40%)"
                                : "hsl(322, 81%, 43%)"
                    const attack_hitbox_path = create_path_from_points(attack_hitbox_abs.points)
                    if (attack_hitbox_path) {
                        attack_hitbox_path.style.fill = phase_color
                        attack_hitbox_path.style.opacity = attack_would_hit ? "0.6" : "0.3"
                        svg.appendChild(attack_hitbox_path)
                    }
                }
            }
        }
    }
}
