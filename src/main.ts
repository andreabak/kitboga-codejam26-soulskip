import {Game} from "./game"
import {add_shell_events_listener, ShellEvent} from "./shell"

let game: Game | null = null
let game_frame_req_id: number | null = null

function handle_shell_event(event: ShellEvent) {
    if (event.type === "adStarted" && game == null) {
        game = new Game()
        game_frame_req_id = setInterval(() => game?.step(performance.now()), 1000 / 60)
    }

    // TODO: handle ad finished

    if (game != null) {
        game.handle_shell_event(event)
    }
}

add_shell_events_listener(handle_shell_event)

// TODO: manage Game + loop with requestAnimationFrame / cancelAnimationFrame when destroying
