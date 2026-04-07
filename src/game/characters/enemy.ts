import {config} from "@/config"
import {dist, get_element, Point, random_pick, rect_center_dist, shape_bbox, TargetFollower} from "@/utils"

import {
    AnimationHandle,
    image_animation_def,
    ImagesAnimationDef,
    interpolate_anim_def,
    InterpolateAnimationParams,
    multi_animation_def,
    subs_anim,
} from "../animations"
import {GameComponent, GameUpdateContext, SubsType} from "../core"
import type {Game} from "../game"
import {
    Attack,
    ATTACK_PHASES_SEQUENCE,
    attack_swing_animation_def,
    AttackDef,
    blood_splat_animation_def,
    Character,
    HitBox,
} from "./core"

import EnemyAttackSwing from "@/assets/enemy/attack-swing.png"
import VineLongImage1 from "@/assets/enemy/vine_long1.png"
import VineLongImage2 from "@/assets/enemy/vine_long2.png"
import VineShortImage1 from "@/assets/enemy/vine_short1.png"
import VineShortImage2 from "@/assets/enemy/vine_short2.png"
import EnemyAttackHitSound1 from "@/assets/sounds/enemy-attack-hit/420674.opus"
import EnemyAttackHitSound2 from "@/assets/sounds/enemy-attack-hit/474575.opus"
import EnemyAttackHitSound3 from "@/assets/sounds/enemy-attack-hit/536258.opus"
import EnemyAttackFastSound1 from "@/assets/sounds/enemy-attack/380488_fast1.opus"
import EnemyAttackFastSound2 from "@/assets/sounds/enemy-attack/380488_fast2.opus"
import EnemyAttackFastSound3 from "@/assets/sounds/enemy-attack/380488_fast3.opus"
import EnemyAttackFastSound4 from "@/assets/sounds/enemy-attack/380488_fast4.opus"
import EnemyAttackFastSound5 from "@/assets/sounds/enemy-attack/380488_fast5.opus"
import EnemyAttackSlowSound1 from "@/assets/sounds/enemy-attack/380488_slow1.opus"
import EnemyAttackSlowSound2 from "@/assets/sounds/enemy-attack/380488_slow2.opus"
import EnemyAttackSlowSound3 from "@/assets/sounds/enemy-attack/542017_slow3.opus"
import EnemyBreakSound from "@/assets/sounds/enemy-break/er-break.opus"
import EnemyDamageSound1 from "@/assets/sounds/enemy-damage/404109.opus"
import EnemyDamageSound2 from "@/assets/sounds/enemy-damage/515624.opus"
import EnemyDamageSound3 from "@/assets/sounds/enemy-damage/770124_1.opus"
import EnemyDamageSound4 from "@/assets/sounds/enemy-damage/770124_2.opus"
import EnemyDamageSound5 from "@/assets/sounds/enemy-damage/770124_3.opus"
import EnemyDamageSound6 from "@/assets/sounds/enemy-damage/770124_4.opus"
import EnemyDamageSound7 from "@/assets/sounds/enemy-damage/770124_5.opus"
import EnemyDamageSound8 from "@/assets/sounds/enemy-damage/770124_6.opus"
import EnemyDamageSound9 from "@/assets/sounds/enemy-damage/770124_7.opus"
import EnemyDeathSound from "@/assets/sounds/enemy-death/369005.opus"
import EnemyIntroSound from "@/assets/sounds/enemy-intro/intro-abk.opus"

const enemy_weapon_selector = ".weapon"

export class EnemyWeapon extends GameComponent {
    enemy: Enemy
    weapon_el: HTMLElement

    follower: TargetFollower

    static initial_offset: Point = {x: 0, y: 24}
    base_offset: Point = {x: 0, y: 24}
    static initial_rotation = (-150 / 180) * Math.PI
    base_rotation = (-150 / 180) * Math.PI
    rotation_ref = (-135 / 180) * Math.PI

    velocity_drift_factor = 3.0

    static animation_base_def = ({
        position,
        rotation,
        params,
    }: {
        position?: Point | ((enemy: Enemy) => Point)
        rotation?: number | ((enemy: Enemy) => number)
        params?: InterpolateAnimationParams
    }) =>
        interpolate_anim_def(
            (enemy: Enemy) => ({position: enemy.weapon.base_offset, rotation: enemy.weapon.base_rotation}),
            (enemy: Enemy) => ({
                position: typeof position === "function" ? position(enemy) : position,
                rotation: typeof rotation === "function" ? rotation(enemy) : rotation,
            }),
            (enemy, state) => {
                enemy.weapon.base_offset = state.position as Point
                enemy.weapon.base_rotation = state.rotation as number
            },
            params,
        )

    static animations = {
        swing_fast_anticipation: EnemyWeapon.animation_base_def({
            position: {x: -24, y: -16},
            rotation: (enemy) =>
                (-90 / 180) * Math.PI + enemy.direction - (enemy.current_attack?.hitbox?.rotation_ref ?? 0),
        }),
        swing_fast_hit: EnemyWeapon.animation_base_def({
            position: {x: 24, y: 0},
            rotation: (enemy) =>
                (-355 / 180) * Math.PI + enemy.direction - (enemy.current_attack?.hitbox?.rotation_ref ?? 0),
            params: {shortest_angle: false, ease_fn: (progress) => progress ** 0.5},
        }),
        swing_slow_anticipation: EnemyWeapon.animation_base_def({
            position: {x: -32, y: -24},
            rotation: (enemy) =>
                (-60 / 180) * Math.PI + enemy.direction - (enemy.current_attack?.hitbox?.rotation_ref ?? 0),
        }),
        swing_slow_hit: EnemyWeapon.animation_base_def({
            position: {x: 24, y: 0},
            rotation: (enemy) =>
                (-355 / 180) * Math.PI + enemy.direction - (enemy.current_attack?.hitbox?.rotation_ref ?? 0),
            params: {shortest_angle: false, ease_fn: (progress) => progress ** 0.5},
        }),
        swing_recover: EnemyWeapon.animation_base_def({
            position: EnemyWeapon.initial_offset,
            rotation: EnemyWeapon.initial_rotation,
        }),
    }

    constructor(game: Game, enemy: Enemy) {
        super(game)

        this.enemy = enemy
        this.weapon_el = get_element(enemy_weapon_selector, enemy.enemy_root_el) as HTMLElement

        this.follower = new TargetFollower(
            {x: 0, y: 0},
            {x: 0, y: 0},
            {
                acceleration: 200,
                slowing_distance: 10,
                dir_max_rotation: ((20 * 360) / 180) * Math.PI,
            },
        )
    }

    _update(context: GameUpdateContext) {
        if (this.enemy.current_attack == null) {
            if (this.enemy.low_stamina || this.enemy.dead) this.base_rotation = (-190 / 180) * Math.PI
        }
        const offset = {
            x: this.base_offset.x - this.enemy.velocity.x * this.velocity_drift_factor,
            y: this.base_offset.y - this.enemy.velocity.y * this.velocity_drift_factor,
        }
        const rotation =
            this.base_rotation -
            this.rotation_ref +
            (Math.max(-30, Math.min(-this.enemy.velocity.x * 1.5, 30)) / 180) * Math.PI
        this.follower.pos_target = offset
        this.follower.dir_target = rotation
        if (context.timedelta) this.follower.update(context.timedelta)
        this.weapon_el.style.transform = `
            translate(calc(${this.follower.pos.x}px - 50%), calc(${this.follower.pos.y}px - 50%))
            rotate(${(this.follower.direction * 180) / Math.PI}deg)
        `
    }
}

const enemy_cfg = {...config.characters.defaults, ...config.characters.enemy}

const enemy_root_selector = ".enemy"
const skip_btn_selector = ".skip-btn"
const vines_root_selector = ".vines"
const eyes_selector = ".eye"

export class Enemy extends Character<Enemy> {
    enemy_root_el: HTMLDivElement
    skip_btn_el: HTMLDivElement
    vines_root_el: HTMLDivElement

    weapon: EnemyWeapon

    width: number
    height: number

    hurtbox_def: HitBox = {shape: {x: -1, y: -1, width: 2, height: 2}, rotation_ref: 0}

    attacks_defs = {
        slow: {
            phases: {
                anticipation: {
                    duration: 300,
                    acceleration: 100,
                    max_vel: 100,
                    animation: EnemyWeapon.animations.swing_slow_anticipation,
                },
                hit: {
                    duration: 200,
                    acceleration: 5,
                    max_vel: 2,
                    sound: [EnemyAttackSlowSound1, EnemyAttackSlowSound2, EnemyAttackSlowSound3],
                    animation: multi_animation_def([
                        EnemyWeapon.animations.swing_slow_hit,
                        attack_swing_animation_def(
                            EnemyAttackSwing,
                            {base_color: [255, 227, 85], ref_angle_deg: -210, swing_angle_deg: 50},
                            {
                                style: {backgroundRepeat: "no-repeat", backgroundPosition: "center"},
                            },
                        ),
                    ]),
                },
                recovery: {
                    duration: 500,
                    acceleration: 20,
                    max_vel: 4,
                    animation: EnemyWeapon.animations.swing_recover,
                },
            },
            damage: 500,
            stamina_consume: 6,
            parry_window_duration: 100,
            scale: 3.5,
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
                origin_ref: {x: 0, y: 24},
                rotation_ref: (-90 / 180) * Math.PI,
            },
            hit_sound: [EnemyAttackHitSound1, EnemyAttackHitSound2, EnemyAttackHitSound3],
        },
        fast: {
            phases: {
                anticipation: {
                    duration: 150,
                    acceleration: 100,
                    max_vel: 100,
                    animation: EnemyWeapon.animations.swing_fast_anticipation,
                },
                hit: {
                    duration: 200,
                    acceleration: 5,
                    max_vel: 2,
                    sound: [
                        EnemyAttackFastSound1,
                        EnemyAttackFastSound2,
                        EnemyAttackFastSound3,
                        EnemyAttackFastSound4,
                        EnemyAttackFastSound5,
                    ],
                    animation: multi_animation_def([
                        EnemyWeapon.animations.swing_fast_hit,
                        attack_swing_animation_def(
                            EnemyAttackSwing,
                            {base_color: [255, 227, 85], ref_angle_deg: -210, swing_angle_deg: 60},
                            {
                                style: {backgroundRepeat: "no-repeat", backgroundPosition: "center"},
                            },
                        ),
                    ]),
                },
                recovery: {
                    duration: 250,
                    acceleration: 20,
                    max_vel: 4,
                    animation: EnemyWeapon.animations.swing_recover,
                },
            },
            damage: 250,
            stamina_consume: 3,
            parry_window_duration: 100,
            scale: 3.5,
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
                origin_ref: {x: 0, y: 24},
                rotation_ref: (-90 / 180) * Math.PI,
            },
            hit_sound: [EnemyAttackHitSound1, EnemyAttackHitSound2, EnemyAttackHitSound3],
        },
    }
    attacks_chains_defs: Record<string, Array<keyof typeof Enemy.prototype.attacks_defs>> =
        enemy_cfg.attacks_chains_defs
    current_attack_chain: {
        def: (typeof Enemy.prototype.attacks_chains_defs)[keyof typeof Enemy.prototype.attacks_chains_defs]
        index: number
    } | null = null
    // TODO: aggro: number = 0.0

    // TODO: AI
    private _phase: "rest" | "fight-start" | "fight" | "defeat" = "rest"
    phases_ts: Partial<Record<typeof Enemy.prototype._phase, number>> = {}
    follow_dist_offset: number = enemy_cfg.follow_dist_offset
    next_attack_ts: number = Infinity
    auto_attack_dist: number = enemy_cfg.auto_attack_dist
    auto_attack_interval: [number, number] = enemy_cfg.auto_attack_interval

    animations = {
        grow_vines: multi_animation_def(
            {
                long1: image_animation_def(VineLongImage1, (enemy: Enemy) => enemy.vines_root_el, {remove: false}),
                long2: image_animation_def(VineLongImage2, (enemy: Enemy) => enemy.vines_root_el, {remove: false}),
                short1: image_animation_def(VineShortImage1, (enemy: Enemy) => enemy.vines_root_el, {remove: false}),
                short2: image_animation_def(VineShortImage2, (enemy: Enemy) => enemy.vines_root_el, {remove: false}),
            },
            {},
            (enemy: Enemy, defs) => {
                const avg_dist = 14
                const rand_jitter = 5
                const size_rand: [number, number] = [1.0, 2.0]
                const rot_rand = 10
                const btn_rect = enemy.skip_btn_el.getBoundingClientRect()
                const handles: Array<AnimationHandle> = []
                type CSSSize = "width" | "height"
                type CSSSide = "top" | "right" | "bottom" | "left"
                const axes: Array<[CSSSize, CSSSide, [CSSSide, string], ImagesAnimationDef<Enemy>[], number]> = [
                    ["width", "left", ["top", "0%"], [defs.short1, defs.short2], 48],
                    ["width", "left", ["top", "100%"], [defs.short1, defs.short2], 48],
                    ["height", "top", ["left", "0%"], [defs.long1, defs.long2], 48],
                    ["height", "top", ["left", "100%"], [defs.long1, defs.long2], 48],
                ]
                axes.forEach(([dim, mov_side, [fix_side, fix_pos], anim_pool, size_ref]) => {
                    let pos: number = (avg_dist + (2 * Math.random() - 1) * rand_jitter) / 2
                    while (pos < btn_rect[dim]) {
                        const vine_def = random_pick(anim_pool)
                        const size = size_ref * (size_rand[0] + Math.random() * (size_rand[1] - size_rand[0]))
                        const handle = vine_def(enemy, {size: {x: size, y: size}}, (_, image_el) => {
                            const rotation_offset_deg = 180 + (2 * Math.random() - 1) * rot_rand
                            image_el.style[fix_side] = fix_pos
                            image_el.style[mov_side] = `${pos}px`
                            image_el.style.filter = "drop-shadow(0 0 2px black)"
                            return {
                                update: (progress) => {
                                    const rotation_deg =
                                        (Math.atan2(
                                            image_el.offsetTop - btn_rect.height / 2,
                                            image_el.offsetLeft - btn_rect.width / 2,
                                        ) *
                                            180) /
                                            Math.PI +
                                        rotation_offset_deg
                                    image_el.style.transform = `
                                        translate(-50%, -50%)
                                        rotate(${rotation_deg}deg)
                                        scale(${progress})
                                    `
                                },
                            }
                        })
                        handles.push(handle)
                        pos += avg_dist + (2 * Math.random() - 1) * rand_jitter
                    }
                })
                return handles
            },
        ),
        damage: blood_splat_animation_def({
            style: {width: "54px", height: "54px", filter: "hue-rotate(90deg) brightness(1.5) contrast(1.4)"},
        }),
    }
    sounds = {
        intro: [EnemyIntroSound],
        damage: [
            EnemyDamageSound1,
            EnemyDamageSound2,
            EnemyDamageSound3,
            EnemyDamageSound4,
            EnemyDamageSound5,
            EnemyDamageSound6,
            EnemyDamageSound7,
            EnemyDamageSound8,
            EnemyDamageSound9,
        ],
        break: [EnemyBreakSound],
        death: [EnemyDeathSound],
    }

    intro_speech_subs: SubsType = [
        [0.0, 5.0, "Thou darest ravage my hallowed slumber!"],
        [5.0, 11.0, "Such divine display rabidly spurn'd..."],
        [11.0, 15.0, "Oblivion awaits thy gaze!"],
    ]

    constructor(game: Game) {
        super(game)

        this.apply_config(enemy_cfg)

        this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el) as HTMLDivElement
        this.skip_btn_el = get_element(skip_btn_selector, this.enemy_root_el) as HTMLDivElement
        this.vines_root_el = get_element(vines_root_selector, this.enemy_root_el) as HTMLDivElement

        this.weapon = this.add_component(new EnemyWeapon(this.game, this))

        // make sure we use top+left and not bottom+right
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        this.enemy_root_el.style.top = `${rel_rect.y}px`
        this.enemy_root_el.style.left = `${rel_rect.x}px`
        this.enemy_root_el.style.bottom = "unset"
        this.enemy_root_el.style.right = "unset"
        this.pos_target = this.pos = this.display_pos // initial position is whatever document styling defines
        this.width = rel_rect.width
        this.height = rel_rect.height

        this.enemy_root_el.addEventListener("click", (e) => {
            e.preventDefault()
            this._aggro_trigger()
        })
        this.enemy_root_el.addEventListener("touchstart", (e) => {
            e.preventDefault()
            this._aggro_trigger()
        })
    }

    get root_el(): HTMLElement {
        return this.enemy_root_el
    }

    get phase(): typeof Enemy.prototype._phase {
        return this._phase
    }
    set phase(value: typeof Enemy.prototype._phase) {
        this._phase = value
        this.phases_ts[value] = this.game.timeref
    }

    get display_pos(): Point {
        const rel_rect = this.game.get_relative_rect(this.enemy_root_el)
        return {x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2}
    }

    _update(context: GameUpdateContext) {
        if (this.game.state === "battle") {
            if (this.phase === "rest") {
                this.phase = "fight-start"
            }
            if (this.phase === "fight") {
                if (!this.attacking) {
                    this.pos_target = this._get_reach_player_point()
                    this.dir_target = {...this.game.player.pos}
                }
            }
        }

        const low_stamina_before = this.low_stamina
        super._update(context)

        if (this.game.state === "battle") {
            if (this.phase === "fight-start") {
                this.defending = true
                this.base_acceleration = 0.033
                if (this.game.changed_state) {
                    this.game.pick_and_play_sound_effect(this.sounds.intro)
                    this.game.play_animation(this.animations.grow_vines(this), 5000)
                    this.game.play_animation(subs_anim(this.game, this.intro_speech_subs))
                    this.game.play_animation({end: () => this.weapon.weapon_el.classList.remove("hidden")}, 5000)
                    this.enemy_root_el.querySelectorAll(eyes_selector).forEach((e) => e.classList.remove("hidden"))
                }
                if (context.timeref - (this.phases_ts[this.phase] ?? context.timeref) > 11000) {
                    this.phase = "fight"
                    this.defending = false
                    this.base_acceleration = enemy_cfg.base_acceleration
                }
            } else if (this.phase === "fight") {
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

                if (this.dead) {
                    this.game.change_state_soon("victory")
                }
            }
        }

        this.enemy_root_el.style.top = `${this.pos.y - this.enemy_root_el.clientHeight / 2}px`
        this.enemy_root_el.style.left = `${this.pos.x - this.enemy_root_el.clientWidth / 2}px`

        this.enemy_root_el.classList.toggle("attacking", this.attacking)
        this.enemy_root_el.classList.toggle("defending", this.defending)
        this.enemy_root_el.classList.toggle("low-stamina", this.low_stamina)
        this.enemy_root_el.classList.toggle("dead", this.dead)
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

    new_attack(): AttackDef<Enemy> {
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
    _attack_start(attack: Attack<Enemy>, {context}: {context: GameUpdateContext}) {
        super._attack_start(attack, {context})
        this.enemy_root_el.style.setProperty("--attack-scale", attack.scale.toString())
    }
    _attack_end(attack: Attack<Enemy>, {context}: {context: GameUpdateContext}) {
        super._attack_end(attack, {context})
        if (
            this.current_attack_chain != null &&
            this.current_attack_chain.index >= this.current_attack_chain.def.length - 1
        )
            this.current_attack_chain = null
        this.next_attack_ts = this.calc_next_attack_ts(context.timeref)
    }

    attack_damage(
        health_damage: number,
        {
            attack,
            attacking_character,
            context,
        }: {attack: Attack<Enemy>; attacking_character: Character; context: GameUpdateContext},
    ) {
        super.attack_damage(health_damage, {
            attack,
            attacking_character,
            context,
        })
        this.game.play_animation(this.animations.damage(this, {}, undefined, {attacking_character}))
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
            this.phase = "fight-start"

            // move to center of screen
            const game_rect = this.game.rect
            this.pos_target = {x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2}

            this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref)
        }
    }
}
