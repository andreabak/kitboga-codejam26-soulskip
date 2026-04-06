import {
    aabb_overlap,
    dist_pt,
    Point,
    Rect,
    rect_to_shape,
    sat_overlap,
    Shape,
    shape_bbox,
    TargetFollower,
    transform_shape,
} from "@/utils"

import {
    AnimationDef,
    AnimationDefTypes,
    AnimationHandle,
    image_animation_def,
    ImageAnimationParams,
    ImagesAnimationDefMixin,
} from "../animations"
import {Actor, GameUpdateContext} from "../core"
import type {Game} from "../game"

export type HitBox = {
    shape: Shape | Rect
    origin_ref?: Point
    rotation_ref: number
}

export function hitbox_bbox(box: HitBox): Rect {
    if (!("points" in box.shape)) {
        return box.shape
    }
    return shape_bbox(box.shape)
}

export type AttackAnimationDef<C extends Character> = (
    component: C,
    attack: Attack<C>,
    phase: AttackPhase<C>,
) => AnimationHandle
export type AttackImageAnimationDef<C extends Character> = AttackAnimationDef<C> & ImagesAnimationDefMixin
export function attack_image_animation_def<C extends Character>(
    image_src: string,
    params?: ImageAnimationParams,
    init?: (character: C, attack: Attack<C>, image_el: HTMLElement) => AnimationHandle,
): AttackImageAnimationDef<C> {
    const image_factory = image_animation_def(image_src, (character: C) => character.root_el)
    const factory = (character: C, attack: Attack<C>, phase: AttackPhase<C>) => {
        const uniform_scale = (character.width + character.height) / 2
        return image_factory(
            character,
            {
                ...{
                    position: {x: 0, y: 0},
                    size: {x: uniform_scale, y: uniform_scale},
                },
                ...(params ?? {}),
            },
            (character: C, image_el) => (init != null ? init(character, attack, image_el) : {}),
        )
    }
    factory.image_src = image_factory.image_src
    return factory
}
type AttackAnimationDefTypes<C extends Character> = AttackAnimationDef<C> | AttackImageAnimationDef<C>
type CharacterAnimationDefTypes<C extends Character> = AnimationDefTypes<C> | AttackAnimationDefTypes<C>

export function attack_swing_animation_def<C extends Character>(
    image_src: string,
    {
        base_color,
        ref_angle_deg = 0,
        swing_angle_deg = 30,
        swing_ease_fn,
    }: {
        base_color: [number, number, number]
        ref_angle_deg?: number
        swing_angle_deg?: number
        swing_ease_fn?: (progress: number) => number
    },
    params?: ImageAnimationParams,
) {
    return attack_image_animation_def(
        image_src,
        {...{style: {mixBlendMode: "plus-lighter", ...(params?.style ?? {})}}, ...(params ?? {})},
        (character: C, attack, image_el) => {
            const rotation_base_deg = ((character.direction - attack.hitbox.rotation_ref) * 180) / Math.PI
            const update = (progress: number) => {
                const _progress = typeof swing_ease_fn === "function" ? swing_ease_fn(progress) : progress ** 0.25
                const rotation_offset_deg = -ref_angle_deg - swing_angle_deg * _progress
                image_el.style.transform = `
                    scale(${attack.scale})
                    rotate(${rotation_base_deg + rotation_offset_deg}deg)
                `
                const overblend = 1 - progress
                image_el.style.filter = `
                    drop-shadow(0 0 0 rgba(${base_color[0]}, ${base_color[1]}, ${base_color[2]}, ${overblend}))
                    drop-shadow(0 0 0 rgba(${base_color[0]}, ${base_color[1]}, ${base_color[2]}, ${overblend}))
                `
                image_el.style.opacity = ((1 - progress) ** 0.125).toString()
            }
            return {update}
        },
    )
}

export type AttackPhases = "anticipation" | "hit" | "recovery"
export const ATTACK_PHASES_SEQUENCE: Array<AttackPhases> = ["anticipation", "hit", "recovery"]
export type AttackPhaseDef<C extends Character> = {
    duration: number
    acceleration?: number | null
    max_vel?: number | null
    animation?: AnimationDef<C> | AttackAnimationDef<C> | AttackImageAnimationDef<C> | null
    sound?: Array<string> | null
}
export type AttackDef<C extends Character> = {
    phases: Required<Record<AttackPhases, AttackPhaseDef<C>>>
    damage: number
    stamina_consume: number
    parry_window_duration: number
    scale: number
    hitbox: HitBox
    hit_sound?: Array<string> | null
}
export type AttackPhase<C extends Character> = AttackPhaseDef<C> & {
    start_ts?: number | null
    animation_handle?: AnimationHandle | null
}
export type Attack<C extends Character> = AttackDef<C> & {
    start_ts: number
    phases: Required<Record<AttackPhases, AttackPhase<C>>>
    current_phase: AttackPhases
}

export type CharacterSounds = {
    damage?: Array<string> | null
    break?: Array<string> | null
    defend?: Array<string> | null
    parry?: Array<string> | null
    cure?: Array<string> | null
    death?: Array<string> | null
} & Record<string, Array<string> | null>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class Character<C extends Character<C> = any> extends Actor {
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
    invicible: boolean = false

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
    current_attack: Attack<C> | null = null
    attack_stamina_consume_multiplier: number = 1.0
    last_attack_hits: Array<Character> = []
    abstract attacks_defs: Record<string, AttackDef<C>>

    defend_requested: boolean = false
    defend_request_ts: number = -Infinity
    defend_damage_reduction: number = 0.75
    defend_stamina_consume_factor: number = 0.3
    defend_acceleration: number = 50
    defend_max_vel: number = 5
    defending: boolean = false

    parry_stamina_consume: number = 30
    parry_enemy_stamina_consume_factor: number = 0.1

    last_cure_ts: number = -Infinity
    cure_duration: number = 500
    curing_max_vel: number = 2.0
    curing: boolean = false

    animations: Record<string, CharacterAnimationDefTypes<C>> = {}
    sounds: CharacterSounds = {}

    constructor(game: Game) {
        super(game)
        this._follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {
                acceleration: this.base_acceleration,
                max_vel: this.base_max_vel,
                slowing_distance: 25,
                vel_max_rotation: ((20 * 360) / 180) * Math.PI,
                dir_max_rotation: ((2 * 360) / 180) * Math.PI,
            },
        )
    }

    preload() {
        super.preload()
        for (const attack_def of Object.values(this.attacks_defs)) {
            this.game.preload_sounds(...(attack_def.hit_sound ?? []))
            for (const attack_phase_def of Object.values(attack_def.phases)) {
                if (attack_phase_def.animation && "image_src" in attack_phase_def.animation) {
                    const images = attack_phase_def.animation.image_src
                    this.game.preload_images(...(typeof images === "string" ? [images] : images))
                }
                this.game.preload_sounds(...(attack_phase_def.sound ?? []))
            }
        }
        for (const animation of Object.values(this.animations)) {
            if (animation && "image_src" in animation) {
                const images = animation.image_src
                this.game.preload_images(...(typeof images === "string" ? [images] : images))
            }
        }
        for (const sound of Object.values(this.sounds)) {
            this.game.preload_sounds(...(sound ?? []))
        }
    }

    abstract get root_el(): HTMLElement

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

    get velocity(): Point {
        return this._follower.velocity
    }

    get dir_target(): Point | number | "pos" | null {
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

    get current_attack_phase(): AttackPhase<C> | null {
        if (this.current_attack == null) return null
        return this.current_attack.phases[this.current_attack.current_phase]
    }

    _transform_shape(
        rel_shape: Shape | Rect,
        {
            origin_ref,
            rotation_ref = 0,
            rotates = true,
            scale_ref = 1.0,
            keep_aspect_ratio = false,
        }: {
            origin_ref?: Point
            rotation_ref?: number
            rotates?: boolean
            scale_ref?: number
            keep_aspect_ratio?: boolean
        } = {},
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
        if (origin_ref) shape = transform_shape(shape, {translate: origin_ref})
        return shape
    }

    get hurtbox(): Shape {
        return this._transform_shape(this.hurtbox_def.shape, {
            origin_ref: this.hurtbox_def.origin_ref,
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
            origin_ref: this.current_attack.hitbox.origin_ref,
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
        return !this.curing && !this.attacking && !this.low_stamina && !this.dead
    }

    get can_defend(): boolean {
        return !this.curing && !this.attacking && !this.low_stamina && !this.dead
    }

    get can_parry(): boolean {
        return !this.curing && !this.attacking && !this.low_stamina && !this.dead
    }

    consume_stamina(amount: number, {context}: {context: GameUpdateContext}) {
        this.stamina -= amount
        if (this.stamina < 0) this.stamina = 0
        this.last_stamina_consume_ts = context.timeref
    }

    consume_health(amount: number, {context}: {context: GameUpdateContext}) {
        this.health -= amount
        if (this.health < 0) this.health = 0
        this.last_damage_ts = context.timeref
    }
    recover_health(amount: number) {
        if (this.dead) return
        this.health += amount
        if (this.health > this.max_health) this.health = this.max_health
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

        this.curing = context.timeref < this.last_cure_ts + this.cure_duration

        if (this.attack_requested) {
            this.attack_requested = false
            if (this.can_attack) {
                const attack_def = this.new_attack()
                this.current_attack = {
                    ...attack_def,
                    start_ts: context.timeref,
                    current_phase: ATTACK_PHASES_SEQUENCE[0],
                }
                this._attack_phase_start(this.current_attack, ATTACK_PHASES_SEQUENCE[0], {context})
                this.consume_stamina(this.current_attack.stamina_consume * this.attack_stamina_consume_multiplier, {
                    context,
                })
                this.last_attack_hits = []
                this._attack_start(this.current_attack, {context})
            }
        }
        if (this.current_attack) {
            const current_phase = this.current_attack.phases[this.current_attack.current_phase]
            if (current_phase.start_ts == null) current_phase.start_ts = context.timeref
            const phase_end_ts = current_phase.start_ts + current_phase.duration
            if (context.timeref <= phase_end_ts)
                this._attack_phase_update(this.current_attack, current_phase, {context})
            if (context.timeref >= phase_end_ts) {
                this._attack_phase_end(this.current_attack, current_phase, {context})
                const phase_idx = ATTACK_PHASES_SEQUENCE.indexOf(this.current_attack.current_phase)
                if (phase_idx + 1 < ATTACK_PHASES_SEQUENCE.length) {
                    const next_phase_name = ATTACK_PHASES_SEQUENCE[phase_idx + 1]
                    this.current_attack.current_phase = next_phase_name
                    this._attack_phase_start(this.current_attack, next_phase_name, {context})
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
              : this.curing
                ? this.curing_max_vel
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
                : this.curing
                  ? this.curing_max_vel
                  : this.low_stamina
                    ? this.low_stamina_max_vel
                    : this.base_max_vel
    }

    abstract new_attack(): AttackDef<C>

    _attack_start(attack: Attack<C>, {context}: {context: GameUpdateContext}) {}
    _attack_phase_start(attack: Attack<C>, phase_name: AttackPhases, {context}: {context: GameUpdateContext}) {
        const phase = attack.phases[phase_name]
        phase.start_ts = context.timeref
        if (phase.animation != null) {
            phase.animation_handle = phase.animation(this as unknown as C, attack, phase)
        }
        this.game.pick_and_play_sound_effect(phase.sound)
    }
    _attack_phase_update(attack: Attack<C>, phase: AttackPhase<C>, {context}: {context: GameUpdateContext}) {
        if (phase.start_ts == null) phase.start_ts = context.timeref
        const progress = (context.timeref - phase.start_ts) / phase.duration
        if (phase.animation_handle?.update != null) phase.animation_handle.update(Math.max(0, Math.min(progress, 1)))
    }
    _attack_phase_end(attack: Attack<C>, phase: AttackPhase<C>, {context}: {context: GameUpdateContext}) {
        if (phase.animation_handle?.end != null) phase.animation_handle.end()
    }
    _attack_end(attack: Attack<C>, {context}: {context: GameUpdateContext}) {}

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
        attack: Attack<C>
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
                    const stamina_break = attacking_character.stamina < attacking_character.low_stamina_enter_threshold
                    const break_sound = attacking_character.sounds.break
                    if (stamina_break && break_sound?.length) {
                        this.game.pick_and_play_sound_effect(break_sound)
                    } else {
                        this.game.pick_and_play_sound_effect(this.sounds.parry)
                    }
                    return true // parried, no further damage to this
                }
            }
        }
        let health_damage = attack.damage
        if (this.defending && !this.low_stamina) {
            const defend = this.attack_defend({attack, attacking_character, context})
            if (typeof defend === "number") {
                health_damage = defend
                this.game.pick_and_play_sound_effect(this.sounds.defend)
            }
        }
        if (!this.invicible && health_damage >= 0) {
            this.attack_damage(health_damage, {attack, attacking_character, context})
            if (this.health <= 0) {
                this.game.pick_and_play_sound_effect(this.sounds.death)
            } else if (!this.defending) {
                this.game.pick_and_play_sound_effect(this.sounds.damage)
            }
            this.game.pick_and_play_sound_effect(attack.hit_sound)
        }
        return true
    }

    attack_defend({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack<C>
        attacking_character: Character
        context: GameUpdateContext
    }): number | false {
        this.consume_stamina(attack.damage * this.defend_stamina_consume_factor, {context})
        return attack.damage * (1.0 - this.defend_damage_reduction)
    }
    attack_parry({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack<C>
        attacking_character: Character
        context: GameUpdateContext
    }): boolean {
        attacking_character.consume_stamina(attack.damage * this.parry_enemy_stamina_consume_factor, {context})
        this.consume_stamina(this.parry_stamina_consume, {context})
        return true // no damage to us
    }
    attack_damage(
        health_damage: number,
        {
            attack,
            attacking_character,
            context,
        }: {
            attack: Attack<C>
            attacking_character: Character
            context: GameUpdateContext
        },
    ): void {
        this.consume_health(health_damage, {context})
    }
}
