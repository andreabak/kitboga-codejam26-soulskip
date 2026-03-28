import {dist, get_element, Point, random_pick, rect_center_dist, shape_bbox} from "@/utils"

import {GameUpdateContext} from "../core"
import type {Game} from "../game"
import {Attack, ATTACK_PHASES_SEQUENCE, AttackDef, Character, HitBox} from "./core"

const enemy_root_selector = ".skip-btn"

export class Enemy extends Character {
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
            scale: 3,
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
            scale: 3,
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
    private _phase: "rest" | "fight-start" | "fight" | "defeat" = "rest"
    phases_ts: Partial<Record<typeof Enemy.prototype._phase, number>> = {}
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
                this.invicible = true
                if (context.timeref - (this.phases_ts[this.phase] ?? context.timeref) > 5000) {
                    this.phase = "fight"
                    this.invicible = false
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
            this.phase = "fight-start"

            // move to center of screen
            const game_rect = this.game.rect
            this.pos_target = {x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2}

            this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref)
        }
    }
}
