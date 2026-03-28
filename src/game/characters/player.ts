import {get_element, play_audio_element} from "@/utils"

import {GameUpdateContext} from "../core"
import type {Game} from "../game"
import {Attack, ATTACK_PHASES_SEQUENCE, AttackDef, Character, HitBox} from "./core"

export type PlayerItemName = "flask"
export type PlayerItem = {
    name: PlayerItemName
    owned: number
}

const player_root_selector = ".player"
const parry_audio_selector = ".sound.parry"
const enemy_break_audio_selector = ".sound.enemy-break"

export class Player extends Character {
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

    items: Record<PlayerItemName, PlayerItem> = {
        flask: {name: "flask", owned: 3},
    }
    flask_health_recover_pct: number = 0.65

    constructor(game: Game) {
        super(game)

        this.player_root_el = get_element(player_root_selector, this.game.game_root_el) as HTMLDivElement

        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this))
        this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this))
        this.game.game_root_el.addEventListener("mouseup", this._on_mouseup.bind(this))
        this.game.game_root_el.addEventListener("contextmenu", (e: PointerEvent) => {
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

    use_item(item_name: PlayerItemName): void {
        const item = this.items[item_name]
        if (!item) console.warn(`Player has no item "${item_name}"`)
        if (item.owned > 0) {
            if (item.name === "flask") {
                this.health += this.max_health * this.flask_health_recover_pct
                if (this.health > this.max_health) {
                    this.health = this.max_health
                }
            }
            item.owned -= 1
        }
    }
}
