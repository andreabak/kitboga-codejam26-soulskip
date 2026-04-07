import {get_element} from "@/utils"

import {PlayerItemName} from "./characters/player"
import {GameComponent, GameUpdateContext} from "./core"
import type {Game} from "./game"

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

type EquipmentSlot = "left" | "right" | "top" | "bottom"

const hud_equipped_selector = ".equipped"
const hud_equip_slot_amount_el_class = "amount"

class EquippedItemsHud extends GameComponent {
    hud: Hud
    equip_root_el: HTMLDivElement
    slots_elements: Record<EquipmentSlot, HTMLDivElement>

    slots_items: Partial<Record<EquipmentSlot, PlayerItemName | null>> = {
        bottom: "flask",
        right: "sword",
        left: "shield",
    }

    constructor(game: Game, hud: Hud) {
        super(game)
        this.hud = hud

        this.equip_root_el = get_element(hud_equipped_selector, this.hud.hud_root_el) as HTMLDivElement

        const slots_elements = this.equip_root_el.querySelectorAll(".slot") as NodeListOf<HTMLDivElement>
        const slots_elements_map: Record<string, HTMLDivElement> = {}
        const mouse_pressed_slots = new Set<HTMLDivElement>()
        for (const slot of slots_elements) {
            const slot_name = slot.dataset.slot
            if (!slot_name) continue
            slots_elements_map[slot_name] = slot
            slot.addEventListener("mousedown", (e) => {
                e.preventDefault()
                e.stopPropagation()
                mouse_pressed_slots.add(slot)
                this._use_slot_item(slot)
            })
            slot.addEventListener("mouseup", (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (mouse_pressed_slots.delete(slot)) {
                    this._release_slot_item(slot)
                }
            })
            slot.addEventListener("mouseleave", (e) => {
                e.preventDefault()
                e.stopPropagation()
                if (mouse_pressed_slots.delete(slot)) {
                    this._release_slot_item(slot)
                }
            })
            slot.addEventListener("touchstart", (e) => {
                e.preventDefault()
                e.stopPropagation()
                this._use_slot_item(slot)
            })
            slot.addEventListener("touchend", (e) => {
                e.preventDefault()
                e.stopPropagation()
                this._release_slot_item(slot)
            })
            slot.addEventListener("touchcancel", (e) => {
                e.preventDefault()
                e.stopPropagation()
                this._release_slot_item(slot)
            })
        }
        this.slots_elements = slots_elements_map as Record<EquipmentSlot, HTMLDivElement>
    }

    _use_slot_item(slot: HTMLDivElement) {
        const item_name = slot.dataset.item
        if (!item_name) return
        this.game.player.use_item(item_name as PlayerItemName)
    }

    _release_slot_item(slot: HTMLDivElement) {
        const item_name = slot.dataset.item
        if (!item_name) return
        this.game.player.release_item(item_name as PlayerItemName)
    }

    _update(context: GameUpdateContext) {
        for (const [slot_name, slot] of Object.entries(this.slots_elements)) {
            const item_name = this.slots_items[slot_name as EquipmentSlot]
            const item = this.game.player.items[item_name as PlayerItemName]
            if (!item_name || !item) {
                slot.replaceChildren()
                slot.dataset.item = undefined
                continue
            }
            if (slot.dataset.item != item_name) {
                slot.replaceChildren()
                slot.dataset.item = item_name
                const icon_img = document.createElement("img")
                icon_img.classList.add("item")
                icon_img.src = item.icon_src
                slot.appendChild(icon_img)
                if (item.consumable) {
                    const amount_el = document.createElement("div")
                    amount_el.classList.add(hud_equip_slot_amount_el_class)
                    slot.appendChild(amount_el)
                }
            }
            if (item.consumable) {
                const amount_el = get_element(`.${hud_equip_slot_amount_el_class}`, slot)
                amount_el.textContent = item.owned.toFixed(0)
            }
        }
    }
}

const hud_root_selector = ".hud"
const hud_hidden_class = "hidden"

export class Hud extends GameComponent {
    hud_root_el: HTMLDivElement

    player_health_bar: PlayerHealthBar
    player_stamina_bar: PlayerStaminaBar
    enemy_health_bar: EnemyHealthBar
    enemy_stamina_bar: EnemyStaminaBar

    equipped_items: EquippedItemsHud

    constructor(game: Game) {
        super(game)

        this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el) as HTMLDivElement

        this.hud_root_el.addEventListener("mousedown", (e) => e.stopPropagation())
        this.hud_root_el.addEventListener("touchstart", (e) => e.stopPropagation())

        this.player_health_bar = this.add_component(new PlayerHealthBar(game, this))
        this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game, this))
        this.enemy_health_bar = this.add_component(new EnemyHealthBar(game, this))
        this.enemy_stamina_bar = this.add_component(new EnemyStaminaBar(game, this))

        this.equipped_items = this.add_component(new EquippedItemsHud(game, this))
    }

    get should_show(): boolean {
        return this.game.state !== "chill"
    }

    _update(context: GameUpdateContext): void {
        this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show)
        this.enemy_stamina_bar.bar_root_el.classList.toggle(
            hud_hidden_class,
            !(this.game.debug_mode && this.game.debug_enemy_stamina),
        )
    }
}
