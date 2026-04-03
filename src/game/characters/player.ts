import {get_element} from "@/utils"

import {GameUpdateContext} from "../core"
import type {Game} from "../game"
import {Attack, ATTACK_PHASES_SEQUENCE, AttackDef, Character, HitBox} from "./core"

import FlaskIcon from "@/assets/flask.webp"
import AttackFast from "@/assets/player-attack-fast.png"
import ShieldIcon from "@/assets/shield.webp"
import PlayerAttackHitSound1 from "@/assets/sounds/player-attack-hit/442903.opus"
import PlayerAttackHitSound2 from "@/assets/sounds/player-attack-hit/547042.opus"
import PlayerAttackHitSound3 from "@/assets/sounds/player-attack-hit/574820.opus"
import PlayerAttackHitSound4 from "@/assets/sounds/player-attack-hit/574821.opus"
import PlayerAttackSound1 from "@/assets/sounds/player-attack/268227.opus"
import PlayerAttackSound2 from "@/assets/sounds/player-attack/724716.opus"
import PlayerCureSound from "@/assets/sounds/player-cure/er-cure.opus"
import PlayerDamageSound1 from "@/assets/sounds/player-damage/488225.opus"
import PlayerDamageSound2 from "@/assets/sounds/player-damage/629664.opus"
import PlayerDeathSound from "@/assets/sounds/player-death/398068.opus"
import PlayerDefendSound1 from "@/assets/sounds/player-defend/364530.opus"
import PlayerDefendSound2 from "@/assets/sounds/player-defend/442769.opus"
import PlayerDefendSound3 from "@/assets/sounds/player-defend/574043.opus"
import PlayerParrySound from "@/assets/sounds/player-parry/er-parry.opus"
import SwordIcon from "@/assets/sword.svg"

export type PlayerItemName = "flask" | "shield" | "sword"
export type PlayerItemBase = {
    name: PlayerItemName
    icon_src: string
}
export type PlayerItemConsumable = PlayerItemBase & {
    consumable: true
    owned: number
}
export type PlayerItemEquipment = PlayerItemBase & {
    consumable: false
}
export type PlayerItem = PlayerItemConsumable | PlayerItemEquipment

const player_root_selector = ".player"

class Player extends Character<Player> {
    player_root_el: HTMLDivElement

    width: number = 48
    height: number = 48

    base_acceleration: number = 500
    base_max_vel: number = 100

    health: number = 1850.0
    max_health: number = 1850.0

    stamina: number = 200.0
    max_stamina: number = 200.0
    stamina_movement_consume_factor: number = 5.0
    stamina_movement_vel_min: number = 60.0
    stamina_recover: number = 100.0
    stamina_recover_delay: number = 500
    last_stamina_consume_ts: number = -Infinity
    low_stamina_max_vel: number = 1
    low_stamina_accel: number = 100
    low_stamina: boolean = false
    low_stamina_enter_threshold: number = 1 // TODO: sanity check
    low_stamina_exit_threshold: number = 200 // TODO: sanity check

    hurtbox_def: HitBox = {shape: {x: 0, y: 0, width: 0.75, height: 1}, rotation_ref: 0}

    attacks_defs: Record<string, AttackDef<Player>> = {
        fast: {
            phases: {
                anticipation: {
                    duration: 0,
                    acceleration: 20,
                    sound: [PlayerAttackSound1, PlayerAttackSound2],
                },
                hit: {
                    duration: 150,
                    acceleration: 1,
                    animation: (player, attack) => {
                        const randid = "anim-" + Math.random().toString(36)
                        const anim_el = document.createElement("img")
                        anim_el.id = randid
                        anim_el.src = AttackFast
                        anim_el.style = `
                            position: absolute;
                            width: ${player.width}px;
                            height: ${player.height}px;
                            top: 0;
                            left: 0;
                            mix-blend-mode: plus-lighter;
                        `
                        const rotation_base_deg = ((player.direction - attack.hitbox.rotation_ref) * 180) / Math.PI
                        player.player_root_el.appendChild(anim_el)
                        const update = (progress: number) => {
                            const rotation_offset_deg = 30 - 45 * progress ** 0.25
                            anim_el.style.transform = `
                                scale(${attack.scale})
                                rotate(${rotation_base_deg + rotation_offset_deg}deg)
                            `
                            const overblend = 1 - progress
                            anim_el.style.filter = `drop-shadow(0 0 0 rgba(255, 255, 255, ${overblend})) drop-shadow(0 0 0 rgba(255, 255, 255, ${overblend}))`
                            anim_el.style.opacity = ((1 - progress) ** 0.125).toString()
                        }
                        update(0)
                        return {
                            update,
                            end: () => anim_el.remove(),
                        }
                    },
                },
                recovery: {duration: 100, acceleration: 50},
            },
            damage: 213,
            stamina_consume: 20,
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
            hit_sound: [PlayerAttackHitSound1, PlayerAttackHitSound2, PlayerAttackHitSound3, PlayerAttackHitSound4],
        },
    }

    items: Record<PlayerItemName, PlayerItem> = {
        flask: {name: "flask", icon_src: FlaskIcon, owned: 3, consumable: true},
        shield: {name: "shield", icon_src: ShieldIcon, consumable: false},
        sword: {name: "sword", icon_src: SwordIcon, consumable: false},
    }
    flask_health_recover_pct: number = 0.65

    sounds = {
        defend: [PlayerDefendSound1, PlayerDefendSound2, PlayerDefendSound3],
        parry: [PlayerParrySound],
        damage: [PlayerDamageSound1, PlayerDamageSound2],
        death: [PlayerDeathSound],
        cure: [PlayerCureSound],
    }

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
        if (this.game.state === "battle") {
            if (event.button === 0) {
                this.attack_requested = true
            } else if (event.button === 2) {
                this.defend_request_ts = this.game.timeref
                this.defend_requested = true
            }
        }
    }
    _on_mouseup(event: MouseEvent): void {
        if (this.game.state === "battle") {
            if (event.button === 2) {
                this.defend_request_ts = this.game.timeref
                this.defend_requested = false
            }
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

    new_attack(): AttackDef<Player> {
        return this.attacks_defs["fast"]
    }
    _attack_start(attack: Attack<Player>, {context}: {context: GameUpdateContext}) {
        super._attack_start(attack, {context})
        this.player_root_el.style.setProperty("--attack-scale", attack.scale.toString())
    }
    attack_parry({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack<Player>
        attacking_character: Character
        context: GameUpdateContext
    }): boolean {
        const do_parry = super.attack_parry({attack, attacking_character, context})
        if (do_parry) {
            // slow down game effect
            this.game.timescale = 0.1
            setTimeout(() => (this.game.timescale = 1.0), 500)
        }
        return do_parry
    }

    use_item(item_name: PlayerItemName): void {
        const item = this.items[item_name]
        if (!item) console.warn(`Player has no item "${item_name}"`)
        if (!this.dead && (!item.consumable || item.owned > 0)) {
            if (item.name === "flask") {
                this.health += this.max_health * this.flask_health_recover_pct
                if (this.health > this.max_health) {
                    this.health = this.max_health
                }
                this.game.pick_and_play_sound_effect(this.sounds.cure)
            }
            if (item.consumable) {
                item.owned -= 1
            }
        }
    }
}

export default Player
