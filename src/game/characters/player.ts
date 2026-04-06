import {get_element, Point} from "@/utils"

import {image_animation_def, ImageAnimationParams, multi_animation_def} from "../animations"
import {GameComponent, GameUpdateContext} from "../core"
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

import FlaskIcon from "@/assets/flask.webp"
import AttackSwing from "@/assets/player/attack-swing.png"
import PlayerParryStar1 from "@/assets/player/parry-star_1.svg"
import PlayerParryStar2 from "@/assets/player/parry-star_2.svg"
import PlayerParryStar3 from "@/assets/player/parry-star_3.svg"
import PlayerParryStar4 from "@/assets/player/parry-star_4.svg"
import ShieldIcon from "@/assets/shield.webp"
import PlayerAttackHitSound1 from "@/assets/sounds/player-attack-hit/442903.opus"
import PlayerAttackHitSound2 from "@/assets/sounds/player-attack-hit/547042.opus"
import PlayerAttackHitSound3 from "@/assets/sounds/player-attack-hit/574820.opus"
import PlayerAttackHitSound4 from "@/assets/sounds/player-attack-hit/574821.opus"
import PlayerAttackSound1 from "@/assets/sounds/player-attack/268227.opus"
import PlayerAttackSound2 from "@/assets/sounds/player-attack/724716.opus"
import PlayerCureSound1 from "@/assets/sounds/player-cure/797763_1.opus"
import PlayerCureSound2 from "@/assets/sounds/player-cure/797763_2.opus"
import PlayerDamageSound1 from "@/assets/sounds/player-damage/488225.opus"
import PlayerDamageSound2 from "@/assets/sounds/player-damage/629664.opus"
import PlayerDeathSound from "@/assets/sounds/player-death/398068.opus"
import PlayerDefendSound1 from "@/assets/sounds/player-defend/364530.opus"
import PlayerDefendSound2 from "@/assets/sounds/player-defend/442769.opus"
import PlayerDefendSound3 from "@/assets/sounds/player-defend/574043.opus"
import PlayerParrySound1 from "@/assets/sounds/player-parry/448009.opus"
import PlayerParrySound2 from "@/assets/sounds/player-parry/591155.opus"
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

const player_shield_selector = ".shield"

class PlayerShield extends GameComponent {
    player: Player
    shield_el: HTMLElement

    player_distance = 20
    offset: Point = {x: 6, y: 12}
    rotation_ref = (90 / 180) * Math.PI

    constructor(game: Game, player: Player) {
        super(game)

        this.player = player
        this.shield_el = get_element(player_shield_selector, player.player_root_el) as HTMLElement
    }

    _update(context: GameUpdateContext) {
        const rotation = this.player.direction
        const _transf_rot = rotation - this.rotation_ref
        const _transf_rot_sin = Math.sin(_transf_rot)
        const _transf_rot_cos = Math.cos(_transf_rot)
        const rot_pinch_limit = (30 / 180) * Math.PI
        const rotation_pinch_factor =
            Math.abs(_transf_rot_sin) ** 9 * Math.sign(_transf_rot_sin) * Math.sign(_transf_rot_cos)
        const rotation_pinch = rot_pinch_limit * rotation_pinch_factor
        const pos = {x: Math.cos(rotation) * this.player_distance, y: Math.sin(rotation) * this.player_distance}
        const shadow_dist = 4
        const shadow_pos = {
            x: (-pos.x / this.player_distance) * shadow_dist,
            y: (-pos.y / this.player_distance) * shadow_dist,
        }

        this.shield_el.classList.toggle("hidden", !(this.game.state === "battle" && this.player.defending))

        this.shield_el.style.top = `calc(50% + ${pos.y + this.offset.y}px)`
        this.shield_el.style.left = `calc(50% + ${pos.x + this.offset.x}px)`
        this.shield_el.style.transform = `
            translate(-50%, -50%)
            rotateX(45deg)
            rotateY(${((rotation - this.rotation_ref - rotation_pinch) * 180) / Math.PI}deg)
        `
        this.shield_el.style.filter = `
            brightness(${1 - 0.3 * Math.abs(_transf_rot_sin) ** 0.5 - 0.5 * (-Math.sign(_transf_rot_cos) / 2 - 0.5)})
            drop-shadow(${shadow_pos.x}px ${shadow_pos.y}px 8px rgba(0, 0, 0, 0.5))
        `
    }

    get pos_abs(): Point {
        const rect = this.shield_el.getBoundingClientRect()
        const game_rect = this.game.rect
        return {x: rect.x - game_rect.x + rect.width / 2, y: rect.y - game_rect.y + rect.height / 2}
    }
}

const player_root_selector = ".player"

class Player extends Character<Player> {
    player_root_el: HTMLDivElement

    shield: PlayerShield

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
                    animation: attack_swing_animation_def(AttackSwing, {
                        base_color: [255, 255, 255],
                        ref_angle_deg: -30,
                        swing_angle_deg: 45,
                    }),
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

    static stars_animation_def = (stars_imgs: Array<string>, params: (player: Player) => ImageAnimationParams) =>
        multi_animation_def(
            stars_imgs.map((img) => image_animation_def(img, (player: Player) => player.game.animations_root_el)),
            {},
            (player: Player, defs) => {
                const _params = params(player)
                return defs.map((def, index) =>
                    def(player, _params, (player, image_el) => {
                        const rot_start = Math.random() * 365
                        const rot_deg = 45 * (2 * (index % 2) - 1)
                        return {
                            update: (progress) => {
                                image_el.style.transform = `
                                    translate(-50%, -50%)
                                    rotate(${rot_start + rot_deg * progress ** 0.125}deg)
                                    scale(${progress ** 0.25})
                                `
                                image_el.style.opacity = (1 - progress ** 2).toString()
                            },
                        }
                    }),
                )
            },
        )
    animations = {
        defend: Player.stars_animation_def([PlayerParryStar1, PlayerParryStar2], (player) => ({
            position: player.shield.pos_abs,
            size: {x: 256, y: 256},
            style: {mixBlendMode: "plus-lighter", filter: "sepia(1) saturation(2) opacity(0.75)"},
        })),
        parry: Player.stars_animation_def(
            [PlayerParryStar1, PlayerParryStar2, PlayerParryStar3, PlayerParryStar4],
            (player) => ({
                position: player.shield.pos_abs,
                size: {x: 512, y: 512},
                style: {mixBlendMode: "plus-lighter"},
            }),
        ),
        damage: blood_splat_animation_def({
            style: {width: "32px", height: "32px", filter: "brightness(0.7) contrast(1.2)"},
        }),
    }
    sounds = {
        defend: [PlayerDefendSound1, PlayerDefendSound2, PlayerDefendSound3],
        parry: [PlayerParrySound1, PlayerParrySound2],
        damage: [PlayerDamageSound1, PlayerDamageSound2],
        death: [PlayerDeathSound],
        cure: [PlayerCureSound1, PlayerCureSound2],
    }

    constructor(game: Game) {
        super(game)

        this.player_root_el = get_element(player_root_selector, this.game.game_root_el) as HTMLDivElement

        this.shield = this.add_component(new PlayerShield(this.game, this))

        this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this))
        this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this))
        this.game.game_root_el.addEventListener("mouseup", this._on_mouseup.bind(this))
        this.game.game_root_el.addEventListener("contextmenu", (e: PointerEvent) => {
            e.preventDefault()
            return false
        })
    }

    get root_el(): HTMLElement {
        return this.player_root_el
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
    attack_defend({
        attack,
        attacking_character,
        context,
    }: {
        attack: Attack<Player>
        attacking_character: Character
        context: GameUpdateContext
    }): number | false {
        const defend = super.attack_defend({
            attack,
            attacking_character,
            context,
        })
        if (typeof defend === "number") {
            this.game.play_animation(this.animations.defend(this), 250)
        }
        return defend
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
            this.game.play_animation(this.animations.parry(this), 100)
        }
        return do_parry
    }
    attack_damage(
        health_damage: number,
        {
            attack,
            attacking_character,
            context,
        }: {attack: Attack<Player>; attacking_character: Character; context: GameUpdateContext},
    ) {
        super.attack_damage(health_damage, {
            attack,
            attacking_character,
            context,
        })
        if (!this.defending)
            this.game.play_animation(this.animations.damage(this, {}, undefined, {attacking_character}))
    }

    use_item(item_name: PlayerItemName): void {
        const item = this.items[item_name]
        if (!item) console.warn(`Player has no item "${item_name}"`)
        if (!this.dead && (!item.consumable || item.owned > 0)) {
            let used = false
            if (item.name === "flask") {
                if (!this.attacking && !this.defending && !this.curing) {
                    this.recover_health(this.max_health * this.flask_health_recover_pct)
                    this.last_cure_ts = this.game.timeref
                    this.game.pick_and_play_sound_effect(this.sounds.cure)
                    used = true
                }
            }
            if (item.consumable && used) {
                item.owned -= 1
            }
        }
    }
}

export default Player
