import {get_element} from "@/utils"

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

const hud_root_selector = ".hud"
const hud_hidden_class = "hidden"

export class Hud extends GameComponent {
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
