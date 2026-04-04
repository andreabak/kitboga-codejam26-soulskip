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

import {Actor, AnimationDef, AnimationHandle, GameUpdateContext} from "../core"
import type {Game} from "../game"

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

export type AttackAnimationDef<C extends Character> = (
    component: C,
    attack: Attack<C>,
    phase: AttackPhase<C>,
) => AnimationHandle

export type AttackImageAnimationDef<C extends Character> = AttackAnimationDef<C> & {image_src: string}
export function image_animation_def<C extends Character>(
    image_src: string,
    init?: (character: C, attack: Attack<C>, image_el: HTMLElement) => AnimationHandle,
): AttackImageAnimationDef<C> {
    function factory(character: C, attack: Attack<C>): AnimationHandle {
        const randid = "anim-" + Math.random().toString(36)
        const image_el = document.createElement("div")
        image_el.id = randid
        // using div + background-image prevents further browser HEAD requests
        image_el.style = `
            position: absolute;
            width: ${character.width}px;
            height: ${character.height}px;
            top: 0;
            left: 0;
            mix-blend-mode: plus-lighter;
            background-image: url('${image_src}');
            background-size: contain;
        `
        character.root_el.appendChild(image_el)
        let sub_update,
            sub_end = undefined
        if (init != null) {
            ;({update: sub_update, end: sub_end} = init(character, attack, image_el))
        }
        const update = sub_update
        const end = () => {
            if (sub_end != null) sub_end()
            image_el.remove()
        }
        if (update != null) {
            update(0)
        }
        return {update, end}
    }
    factory.image_src = image_src
    return factory
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
                    this.game.preload_images(attack_phase_def.animation.image_src)
                }
                this.game.preload_sounds(...(attack_phase_def.sound ?? []))
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

    get current_attack_phase(): AttackPhase<C> | null {
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
            const stamina_consume = attack.damage * this.defend_stamina_consume_factor
            this.consume_stamina(stamina_consume, {context})
            health_damage *= 1.0 - this.defend_damage_reduction
            this.game.pick_and_play_sound_effect(this.sounds.defend)
        }
        if (!this.invicible && health_damage >= 0) {
            this.health -= health_damage
            this.last_damage_ts = context.timeref
            // FIXME: don't play these sound effects if defended, maybe refactor health_consume into a fn, then make this if block exclusive with the defend one
            if (this.health <= 0) {
                this.health = 0
                // FIXME: should trigger also in defend, maybe move elsewhere (where transition) and leave reverse if block
                this.game.pick_and_play_sound_effect(this.sounds.death)
            } else {
                this.game.pick_and_play_sound_effect(this.sounds.damage)
            }
            this.game.pick_and_play_sound_effect(attack.hit_sound)
        }
        return true
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
}
