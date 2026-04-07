import type {Game} from "@/game"
import type {AttackDef, AttackPhaseDef, Character, Enemy, Player} from "@/game/characters"
import type {GestureManager} from "@/game/gestures"

export type CharacterBaseConfig = Pick<
    Character,
    | "base_acceleration"
    | "base_max_vel"
    | "slowing_distance"
    | "max_health"
    | "invicible"
    | "max_stamina"
    | "stamina_movement_consume_factor"
    | "stamina_movement_vel_min"
    | "stamina_recover"
    | "stamina_recover_delay"
    | "low_stamina_max_vel"
    | "low_stamina_accel"
    | "low_stamina_enter_threshold"
    | "low_stamina_exit_threshold"
    | "attack_stamina_consume_multiplier"
    | "defend_damage_reduction"
    | "defend_stamina_consume_factor"
    | "defend_acceleration"
    | "defend_max_vel"
    | "parry_stamina_consume"
    | "parry_enemy_stamina_consume_factor"
    | "cure_duration"
    | "curing_max_vel"
> & {initial_health?: number; initial_stamina?: number}
export type AttackPhaseDefConfig<C extends Character> = Pick<AttackPhaseDef<C>, "duration" | "acceleration" | "max_vel">
export type AttackDefConfig<C extends Character> = Pick<
    AttackDef<C>,
    "damage" | "stamina_consume" | "parry_window_duration" | "scale"
> & {phases: Record<keyof AttackDef<C>["phases"], AttackPhaseDefConfig<C>>}
export type CharacterAttacksConfig<C extends Character, N extends string> = Record<N, AttackDefConfig<C>>
export type MergedCharacterConfig<C extends Character, N extends string> = CharacterBaseConfig & {
    attacks_defs?: Partial<CharacterAttacksConfig<C, N>>
}
export type CharacterConfig<C extends Character, N extends string> = Partial<MergedCharacterConfig<C, N>>

export type PlayerConfig = CharacterConfig<Player, keyof typeof Player.prototype.attacks_defs> &
    Pick<Player, "flask_health_recover_pct">

export type EnemyConfig = CharacterConfig<Enemy, keyof typeof Enemy.prototype.attacks_defs> &
    Pick<Enemy, "attacks_chains_defs" | "follow_dist_offset" | "auto_attack_dist" | "auto_attack_interval">

export type GameConfig = Pick<
    Game,
    "debug_mode" | "debug_enemy_stamina" | "debug_hitboxes" | "debug_attacks" | "debug_noreload"
>

export type GesturesConfig = Pick<GestureManager, "tap_threshold_ms" | "drag_threshold_px" | "tap_pre_delay_ms">

export type Config = {
    characters: {
        defaults: CharacterBaseConfig
        player: PlayerConfig
        enemy: EnemyConfig
    }
    game: GameConfig
    gestures: GesturesConfig
}

export const config: Config = {
    characters: {
        defaults: {
            base_acceleration: 250,
            base_max_vel: 100,
            slowing_distance: 25,
            max_health: 100.0,
            max_stamina: 100.0,
            invicible: false,
            stamina_movement_consume_factor: 8.0,
            stamina_movement_vel_min: 40.0,
            stamina_recover: 100.0,
            stamina_recover_delay: 1000,
            low_stamina_max_vel: 5,
            low_stamina_accel: 100,
            low_stamina_enter_threshold: 1,
            low_stamina_exit_threshold: 100,
            attack_stamina_consume_multiplier: 1.0,
            defend_damage_reduction: 0.75,
            defend_stamina_consume_factor: 0.3,
            defend_acceleration: 50,
            defend_max_vel: 5,
            parry_stamina_consume: 30,
            parry_enemy_stamina_consume_factor: 0.1,
            cure_duration: 500,
            curing_max_vel: 2.0,
        },
        player: {
            base_acceleration: 500,
            base_max_vel: 100,
            max_health: 1850.0,
            max_stamina: 200.0,
            stamina_movement_consume_factor: 5.0,
            stamina_movement_vel_min: 60.0,
            stamina_recover: 100.0,
            stamina_recover_delay: 500,
            low_stamina_max_vel: 1,
            low_stamina_accel: 100,
            low_stamina_enter_threshold: 1,
            low_stamina_exit_threshold: 200,
            flask_health_recover_pct: 0.65,
            attacks_defs: {
                fast: {
                    phases: {
                        anticipation: {
                            duration: 0,
                            acceleration: 20,
                        },
                        hit: {
                            duration: 150,
                            acceleration: 1,
                        },
                        recovery: {
                            duration: 100,
                            acceleration: 50,
                        },
                    },
                    damage: 213,
                    stamina_consume: 20,
                    parry_window_duration: 200,
                    scale: 3.0,
                },
            },
        },
        enemy: {
            base_acceleration: 10,
            base_max_vel: 2,
            max_health: 10000.0,
            max_stamina: 150.0,
            stamina_recover: 25,
            stamina_recover_delay: 2000,
            low_stamina_max_vel: 0,
            low_stamina_enter_threshold: 1,
            low_stamina_exit_threshold: 150,
            attacks_defs: {
                slow: {
                    phases: {
                        anticipation: {
                            duration: 300,
                            acceleration: 100,
                            max_vel: 100,
                        },
                        hit: {
                            duration: 200,
                            acceleration: 5,
                            max_vel: 2,
                        },
                        recovery: {
                            duration: 500,
                            acceleration: 20,
                            max_vel: 4,
                        },
                    },
                    damage: 500,
                    stamina_consume: 6,
                    parry_window_duration: 100,
                    scale: 3.5,
                },
                fast: {
                    phases: {
                        anticipation: {
                            duration: 150,
                            acceleration: 100,
                            max_vel: 100,
                        },
                        hit: {
                            duration: 200,
                            acceleration: 5,
                            max_vel: 2,
                        },
                        recovery: {
                            duration: 250,
                            acceleration: 20,
                            max_vel: 4,
                        },
                    },
                    damage: 250,
                    stamina_consume: 3,
                    parry_window_duration: 100,
                    scale: 3.5,
                },
            },
            attacks_chains_defs: {
                fast_flurry: ["fast", "fast", "fast"],
                fast_slow_flurry: ["fast", "fast", "slow"],
                slow_fast_duplet: ["slow", "fast"],
            },
            follow_dist_offset: 30,
            auto_attack_dist: 400,
            auto_attack_interval: [1500, 3000],
        },
    },
    game: {
        debug_mode: false,
        debug_enemy_stamina: true,
        debug_hitboxes: true,
        debug_attacks: true,
        debug_noreload: true,
    },
    gestures: {
        tap_threshold_ms: 250,
        drag_threshold_px: 10,
        tap_pre_delay_ms: 90,
    },
}
