import {send_shell_request, ShellEvent} from "@/shell"
import {
    aabb_overlap,
    delay,
    fade_audio,
    get_element,
    Point,
    random_pick,
    sat_overlap,
    shape_bbox,
    smooth_ema,
} from "@/utils"

import {Character, Enemy, Player} from "./characters"
import {AnimationHandle, Component, GameComponent, GameState, GameUpdateContext, TimedAnimationHandle} from "./core"
import {Hud} from "./hud"

import BattleDefeatSound from "@/assets/sounds/battle-defeat/er-death.opus"
import BattleMusicSound from "@/assets/sounds/battle-music/er-boss.opus"
import BattleVictorySound from "@/assets/sounds/battle-victory/er-victory.opus"

const defeat_screen_selector = ".defeat-screen"

class DefeatScreen extends GameComponent {
    defeat_screen_el: HTMLDivElement

    constructor(game: Game) {
        super(game)

        this.defeat_screen_el = get_element(defeat_screen_selector, this.game.game_root_el) as HTMLDivElement
    }

    _update(context: GameUpdateContext) {
        this.defeat_screen_el.classList.toggle("hidden", this.game.state !== "defeat")
    }
}

const victory_screen_selector = ".victory-screen"

class VictoryScreen extends GameComponent {
    victory_screen_el: HTMLDivElement

    constructor(game: Game) {
        super(game)

        this.victory_screen_el = get_element(victory_screen_selector, this.game.game_root_el) as HTMLDivElement
    }

    _update(context: GameUpdateContext) {
        this.victory_screen_el.classList.toggle("hidden", this.game.state !== "victory")
    }
}

const game_root_selector = "#game-root"

export class Game extends Component<GameUpdateContext> {
    private _state: GameState = "chill"
    private _last_state: GameState = "chill"
    private _next_state: GameState | null = null

    private _timeref: number = 0.0
    _timescale: number = 1.0
    private _last_step_ts: number | null = null

    private _video_playback_rate_base: number = 1.0

    game_root_el: HTMLDivElement

    animations: Record<string, {start_ts: number; duration: number; handle: AnimationHandle}> = {}

    sound_effects: Record<string, HTMLAudioElement> = {}

    player: Player
    enemy: Enemy
    characters: Array<Character> = []

    hud: Hud

    defeat_screen: DefeatScreen
    victory_screen: VictoryScreen

    debug_mode: boolean = false
    debug_enemy_stamina: boolean = true
    debug_hitboxes: boolean = true

    sounds = {
        battle_music: [BattleMusicSound],
        battle_defeat: [BattleDefeatSound],
        battle_victory: [BattleVictorySound],
    }

    constructor() {
        super()

        this.game_root_el = get_element(game_root_selector) as HTMLDivElement
        this.game_root_el.classList.toggle("hidden", false)

        this.player = this.add_character(this.add_component(new Player(this)))
        this.enemy = this.add_character(this.add_component(new Enemy(this)))

        this.hud = this.add_component(new Hud(this))

        this.defeat_screen = this.add_component(new DefeatScreen(this))
        this.victory_screen = this.add_component(new VictoryScreen(this))

        this.preload()
    }

    preload() {
        for (const sound of Object.values(this.sounds)) {
            this.preload_sounds(...(sound ?? []))
        }
        for (const component of this._children) {
            if (component instanceof GameComponent) {
                component.preload()
            }
        }
    }

    add_character<C extends Character>(character: C): C {
        this.characters.push(character)
        return character
    }

    get changed_state(): boolean {
        return this.state !== this._last_state
    }
    get state(): GameState {
        return this._state
    }
    change_state_soon(new_state: GameState): void {
        this._next_state = new_state
    }

    get timeref(): number {
        return this._timeref
    }
    get timescale(): number {
        return this._timescale
    }
    set timescale(value: number) {
        this._timescale = value
        this._update_video_playback_rate()
    }
    get video_playback_rate_base(): number {
        return this._video_playback_rate_base
    }
    set video_playback_rate_base(value: number) {
        this._video_playback_rate_base = value
        this._update_video_playback_rate()
    }
    _update_video_playback_rate() {
        send_shell_request({type: "setPlaybackRate", value: this._timescale * this._video_playback_rate_base})
    }

    handle_shell_event(event: ShellEvent | unknown): void {
        if (!event || typeof event !== "object" || !("type" in event)) {
            console.warn("Received unknown event object", event)
            return
        }
        // repeat ad forever
        if (event.type === "adFinished") {
            send_shell_request({type: "seekTo", value: 0})
            send_shell_request({type: "play"})
        }
    }

    _update(context: GameUpdateContext): void {
        this.game_root_el.classList.toggle("hide-mouse", this.state !== "chill")
        if (this.changed_state) {
            if (this.state === "battle") {
                send_shell_request({type: "setVideoFilter", value: "blur(3px) brightness(0.8)"})
                const battle_music_audio = this.pick_and_play_sound_effect(this.sounds.battle_music)
                if (battle_music_audio) {
                    battle_music_audio.addEventListener("play", async () => {
                        await delay(3500)
                        await fade_audio(battle_music_audio, {duration: 15000, volume: 0, stop_after: true})
                    })
                }
            } else if (this.state === "defeat") {
                this.pick_and_play_sound_effect(this.sounds.battle_defeat)
                setTimeout(() => send_shell_request({type: "fail"}), 8000)
            } else if (this.state === "victory") {
                this.pick_and_play_sound_effect(this.sounds.battle_victory)
                setTimeout(() => send_shell_request({type: "success"}), 8000)
            }
        }
        if (["defeat", "victory"].includes(this.state)) {
            this.video_playback_rate_base = smooth_ema(
                this.video_playback_rate_base,
                0.1,
                (0.5 * (context.timedelta ?? 0)) / 1000,
            )
        }
        this._update_animations(context)
    }

    play_animation(handle: TimedAnimationHandle): void
    play_animation(handle: AnimationHandle, duration: number): void
    play_animation(handle: AnimationHandle | TimedAnimationHandle, duration?: number): void {
        if ("duration" in handle) duration = handle.duration
        if (duration == null) throw new Error("Cannot play animation without duration!")
        const id = Math.random().toString(36)
        this.animations[id] = {start_ts: this.timeref, duration, handle}
    }
    _update_animations(context: GameUpdateContext): void {
        for (const [id, anim_info] of [...Object.entries(this.animations)]) {
            const progress = (context.timeref - anim_info.start_ts) / anim_info.duration
            if (anim_info.handle.update) anim_info.handle.update(Math.max(0, Math.min(progress, 1)))
            if (progress >= 1) {
                if (anim_info.handle.end) anim_info.handle.end()
                delete this.animations[id]
            }
        }
    }

    load_sound_effect(src: string): HTMLAudioElement {
        const audio = new Audio(src)
        this.sound_effects[src] = audio
        return audio
    }
    preload_sounds(...srcs: Array<string>) {
        for (const src of srcs) {
            this.load_sound_effect(src)
        }
    }
    play_sound_effect(src: string, {volume = 1.0}: {volume?: number} = {}): HTMLAudioElement {
        let audio: HTMLAudioElement
        if (src in this.sound_effects) {
            audio = this.sound_effects[src]
        } else {
            audio = this.load_sound_effect(src)
        }
        audio.currentTime = 0
        audio.volume = volume
        audio.play()
        return audio
    }
    pick_and_play_sound_effect(
        sounds?: Array<string> | null,
        {volume = 1.0}: {volume?: number} = {},
    ): HTMLAudioElement | null {
        if (sounds == null || !sounds.length) return null
        const sound = random_pick(sounds)
        return this.play_sound_effect(sound, {volume})
    }

    step(timestamp: number): void {
        const last_timeref = this._timeref
        if (this._last_step_ts != null) {
            this._timeref += (timestamp - this._last_step_ts) * this.timescale
        }
        const context = {
            timeref: this._timeref,
            timedelta: this._timeref - last_timeref,
        } as GameUpdateContext
        if (this._next_state != null) {
            this._state = this._next_state
            this._next_state = null
        }
        this.update(context)
        this._debug_hitboxes()
        this._last_state = this._state
        this._last_step_ts = timestamp
    }

    get rect(): DOMRect {
        return this.game_root_el.getBoundingClientRect()
    }

    get_relative_rect(el: HTMLElement): DOMRect {
        const {x: game_x, y: game_y} = this.rect
        const el_rect = el.getBoundingClientRect()
        return new DOMRect(el_rect.x - game_x, el_rect.y - game_y, el_rect.width, el_rect.height)
    }

    _debug_hitboxes() {
        const svg_id = "hitboxes"
        const svg_els = this.game_root_el.querySelectorAll(`#${svg_id}`)
        for (const el of svg_els) {
            el.parentNode?.removeChild(el)
        }
        if (this.debug_mode && this.debug_hitboxes) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
            svg.id = svg_id
            svg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${this.rect.width}px;
                height: ${this.rect.height}px;
                pointer-events: none;
            `
            this.game_root_el.appendChild(svg)

            for (const character of this.characters) {
                const create_path_from_points = (points: Array<Point>): SVGPathElement | null => {
                    if (points.length === 0) return null

                    const d_parts = []
                    for (let i = 0; i < points.length; i++) {
                        const ptyp = i === 0 ? "M" : "L"
                        d_parts.push(`${ptyp} ${points[i].x} ${points[i].y}`)
                    }
                    d_parts.push("Z")

                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
                    path.setAttribute("d", d_parts.join(" "))

                    return path
                }

                const hurtbox_path = create_path_from_points(character.hurtbox_abs.points)
                if (hurtbox_path) {
                    hurtbox_path.style.fill = "hsla(195, 100%, 50%, 0.4)"
                    svg.appendChild(hurtbox_path)
                }

                const direction_vec = character.direction_vector
                const dir_vector_path = create_path_from_points([
                    character.pos,
                    {x: character.pos.x + direction_vec.x * 20, y: character.pos.y + direction_vec.y * 20},
                ])
                if (dir_vector_path) {
                    dir_vector_path.style.stroke = "hsla(0, 100%, 50%, 0.4)"
                    dir_vector_path.style.strokeWidth = "2px"
                    svg.appendChild(dir_vector_path)
                }

                const attack_hitbox_abs = character.attack_hitbox_abs
                if (attack_hitbox_abs) {
                    const attack_hitbox_bbox = shape_bbox(attack_hitbox_abs)
                    let attack_would_hit = false
                    for (const other of this.characters) {
                        if (other === character) continue
                        const other_hurtbox_abs = other.hurtbox_abs
                        const other_hurtbox_bbox = shape_bbox(other_hurtbox_abs)
                        if (
                            aabb_overlap(other_hurtbox_bbox, attack_hitbox_bbox) &&
                            sat_overlap(attack_hitbox_abs, other_hurtbox_abs)
                        ) {
                            attack_would_hit = true
                            break
                        }
                    }
                    const current_phase = character.current_attack?.current_phase
                    const phase_color =
                        current_phase === "anticipation"
                            ? "hsl(220, 100%, 55%)"
                            : current_phase === "hit"
                              ? "hsl(0, 100%, 50%)"
                              : current_phase === "recovery"
                                ? "hsl(0, 0%, 40%)"
                                : "hsl(322, 81%, 43%)"
                    const attack_hitbox_path = create_path_from_points(attack_hitbox_abs.points)
                    if (attack_hitbox_path) {
                        attack_hitbox_path.style.fill = phase_color
                        attack_hitbox_path.style.opacity = attack_would_hit ? "0.6" : "0.3"
                        svg.appendChild(attack_hitbox_path)
                    }
                }
            }
        }
    }
}
