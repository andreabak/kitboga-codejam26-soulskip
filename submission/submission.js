var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function add_shell_events_listener(listener) {
  window.addEventListener("message", (event) => {
    var _a;
    if (!event || typeof event !== "object" || !((_a = event == null ? void 0 : event.data) == null ? void 0 : _a.type)) return;
    listener(event.data);
  });
}
function send_shell_request(request) {
  window.top.postMessage(request, "*");
}
async function delay(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}
function get_element(selector, root) {
  root = root ?? document;
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Could not find element with selector "${selector}"`);
  return el;
}
function play_audio_element(selector, root) {
  const el = get_element(selector, root);
  if (!(el instanceof HTMLMediaElement)) {
    throw new Error(`Element with selector "${selector}" doesn't look like an audio element.`);
  }
  return el.play();
}
async function fade_audio(audio_el, {
  duration,
  volume,
  fps = 60,
  exponential = true,
  stop_after = false
}) {
  const start_volume = audio_el.volume;
  const step_delay = 1e3 / fps;
  const steps = Math.ceil(duration / step_delay);
  for (let i = 0; i < steps; i++) {
    const progress = (i + 1) / steps;
    audio_el.volume = Math.max(
      0,
      Math.min(start_volume + (volume - start_volume) * (exponential ? Math.pow(progress, 0.5) : progress), 1)
    );
    await delay(step_delay);
  }
  audio_el.volume = volume;
  if (stop_after) audio_el.pause();
}
function dist(x, y) {
  return Math.sqrt(x * x + y * y);
}
function dist_pt(p) {
  return dist(p.x, p.y);
}
function smooth_ema(v0, v1, sf) {
  return (1 - sf) * v0 + sf * v1;
}
class TargetFollower {
  constructor(pos, target, {
    acceleration,
    max_vel = null,
    slowing_distance = null
  }) {
    __publicField(this, "pos");
    __publicField(this, "target");
    __publicField(this, "acceleration");
    __publicField(this, "_vel", { x: 0, y: 0 });
    __publicField(this, "max_vel");
    __publicField(this, "slowing_distance");
    this.pos = pos;
    this.target = target;
    this.acceleration = acceleration;
    this.max_vel = max_vel;
    this.slowing_distance = slowing_distance;
  }
  get velocity() {
    return { ...this._vel };
  }
  update(timestep, { target } = {}) {
    if (target != null) {
      this.target = target;
    }
    if (!timestep || timestep < 0) {
      return this.pos;
    }
    const secs = timestep / 1e3;
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const d = dist(dx, dy);
    if (d > 0) {
      this._vel.x += dx / d * this.acceleration * secs;
      this._vel.y += dy / d * this.acceleration * secs;
    }
    if (this.slowing_distance && d < this.slowing_distance) {
      this._vel.x *= 1 - this.slowing_distance / (d + this.slowing_distance);
      this._vel.y *= 1 - this.slowing_distance / (d + this.slowing_distance);
    }
    const vel = dist(this._vel.x, this._vel.y);
    if (d > 0) {
      this._vel.x = vel * (dx / d);
      this._vel.y = vel * (dy / d);
    }
    if (this.max_vel != null && vel >= this.max_vel) {
      this._vel.x = this.max_vel * (this._vel.x / vel);
      this._vel.y = this.max_vel * (this._vel.y / vel);
    }
    this.pos.x += this._vel.x;
    this.pos.y += this._vel.y;
    return this.pos;
  }
}
class Component {
  constructor() {
    __publicField(this, "_children", []);
  }
  add_component(component) {
    this._children.push(component);
    return component;
  }
  update(context) {
    this._update(context);
    for (const component of this._children) {
      component.update(context);
    }
  }
}
class GameComponent extends Component {
  constructor(game2) {
    super();
    __publicField(this, "game");
    this.game = game2;
  }
}
class Actor extends GameComponent {
}
class Character extends Actor {
  constructor(game2) {
    super(game2);
    __publicField(this, "_follower");
    __publicField(this, "base_acceleration", 250);
    __publicField(this, "base_max_vel", 100);
    __publicField(this, "health", 100);
    __publicField(this, "max_health", 100);
    // TODO: sanity check
    __publicField(this, "stamina", 100);
    __publicField(this, "max_stamina", 100);
    // TODO: sanity check
    __publicField(this, "stamina_movement_consume_factor", 8);
    __publicField(this, "stamina_movement_vel_min", 40);
    __publicField(this, "stamina_recover", 100);
    __publicField(this, "stamina_recover_delay", 500);
    __publicField(this, "last_stamina_consume_ts", 0);
    __publicField(this, "low_stamina_max_vel", 5);
    __publicField(this, "low_stamina_accel", 100);
    __publicField(this, "low_stamina", false);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 200);
    // TODO: sanity check
    __publicField(this, "attack_characters", []);
    __publicField(this, "attack_requested", false);
    __publicField(this, "attacking", false);
    __publicField(this, "attack_stamina_consume", 30);
    __publicField(this, "attack_duration", 150);
    __publicField(this, "attack_radius", 100);
    __publicField(this, "attack_damage", 20);
    __publicField(this, "last_attack_hits", []);
    __publicField(this, "last_attack_ts", 0);
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { acceleration: this.base_acceleration, max_vel: this.base_max_vel, slowing_distance: 50 }
    );
  }
  get acceleration() {
    return this._follower.acceleration;
  }
  set acceleration(value) {
    this._follower.acceleration = value;
  }
  get max_vel() {
    return this._follower.max_vel;
  }
  set max_vel(value) {
    this._follower.max_vel = value;
  }
  get pos() {
    return this._follower.pos;
  }
  set pos(value) {
    this._follower.pos = value;
  }
  get target() {
    return this._follower.target;
  }
  set target(value) {
    this._follower.target = value;
  }
  get dead() {
    return this.health <= 0;
  }
  get can_attack() {
    return !this.attacking && !this.low_stamina && !this.dead;
  }
  _update(context) {
    const s_delta = (context.timedelta ?? 0) / 1e3;
    let stamina_consume = 0;
    if (context.timedelta != null) {
      this._follower.update(context.timedelta);
    } else {
      this._follower.pos = { ...this._follower.target };
    }
    const vel_mag = dist_pt(this._follower.velocity);
    if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
      stamina_consume += vel_mag * this.stamina_movement_consume_factor * s_delta;
    }
    if (this.attack_requested) {
      this.attack_requested = false;
      if (this.can_attack) {
        this.attacking = true;
        this.last_attack_ts = context.timestamp;
        stamina_consume += this.attack_stamina_consume;
        this._attack_start(context);
      }
    }
    if (this.attacking) {
      if (context.timestamp - this.last_attack_ts >= this.attack_duration) {
        this.attacking = false;
        this._attack_end(context);
      } else {
        this._check_attack_hits(context);
      }
    }
    if (context.timedelta && context.timedelta > 0) {
      if (stamina_consume > 0) {
        this.stamina -= stamina_consume;
        this.last_stamina_consume_ts = context.timestamp;
      } else if (!this.last_stamina_consume_ts || context.timestamp - this.last_stamina_consume_ts >= this.stamina_recover_delay) {
        this.stamina += this.stamina_recover * s_delta;
      }
      this.stamina = Math.max(0, Math.min(this.stamina, this.max_stamina));
      if (!this.low_stamina && this.stamina < this.low_stamina_enter_threshold) {
        this.low_stamina = true;
      } else if (this.low_stamina && this.stamina >= this.low_stamina_exit_threshold) {
        this.low_stamina = false;
      }
    }
    this.max_vel = this.calc_max_vel();
    this.acceleration = this.calc_acceleration();
  }
  calc_acceleration() {
    return this.low_stamina ? this.low_stamina_accel : this.base_acceleration;
  }
  calc_max_vel() {
    return this.dead ? 0 : this.low_stamina ? this.low_stamina_max_vel : this.base_max_vel;
  }
  _check_attack_hits(context) {
    for (const character of this.game.characters) {
      if (character === this) continue;
      if (this.last_attack_hits.some((c) => c === character)) continue;
      const distance = dist(this.pos.x - character.pos.x, this.pos.y - character.pos.y);
      if (distance < this.attack_radius) {
        character.attack_hit({ attacking_character: this, damage: this.attack_damage, distance });
        this.last_attack_hits.push(character);
      }
    }
  }
  _attack_start(context) {
    this.last_attack_hits = [];
  }
  _attack_end(context) {
  }
  attack_hit({
    attacking_character,
    damage,
    distance
  }) {
    this.health -= damage;
    if (this.health < 0) this.health = 0;
  }
}
const player_root_selector = ".player";
class Player extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "player_root_el");
    __publicField(this, "base_acceleration", 500);
    __publicField(this, "base_max_vel", 200);
    __publicField(this, "health", 300);
    __publicField(this, "max_health", 300);
    __publicField(this, "stamina", 200);
    __publicField(this, "max_stamina", 200);
    __publicField(this, "stamina_movement_consume_factor", 8);
    __publicField(this, "stamina_movement_vel_min", 40);
    __publicField(this, "stamina_recover", 100);
    __publicField(this, "stamina_recover_delay", 500);
    __publicField(this, "last_stamina_consume_ts", 0);
    __publicField(this, "low_stamina_max_vel", 5);
    __publicField(this, "low_stamina_accel", 100);
    __publicField(this, "low_stamina", false);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 200);
    // TODO: sanity check
    __publicField(this, "attack_requested", false);
    __publicField(this, "attacking", false);
    __publicField(this, "attack_stamina_consume", 30);
    __publicField(this, "attack_duration", 150);
    __publicField(this, "last_attack_ts", 0);
    this.player_root_el = get_element(player_root_selector, this.game.game_root_el);
    this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this));
    this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this));
  }
  _on_mousemove(event) {
    const rect = this.game.game_root_el.getBoundingClientRect();
    this.target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  _on_mousedown(event) {
    this.attack_requested = true;
  }
  _update(context) {
    super._update(context);
    if (this.game.state === "battle" && this.dead) {
      this.game.change_state_soon("defeat");
    }
    this.player_root_el.classList.toggle("hidden", this.game.state === "chill");
    this.player_root_el.style.top = `${this.pos.y - this.player_root_el.clientHeight / 2}px`;
    this.player_root_el.style.left = `${this.pos.x - this.player_root_el.clientWidth / 2}px`;
    this.player_root_el.classList.toggle("attacking", this.attacking);
    this.player_root_el.classList.toggle("low-stamina", this.low_stamina);
  }
  _attack_start(context) {
    super._attack_start(context);
    this.player_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1e3}s`);
    this.player_root_el.style.setProperty("--attack-radius", `${this.attack_radius}px`);
  }
}
const enemy_root_selector = ".skip-btn";
class Enemy extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "enemy_root_el");
    __publicField(this, "base_acceleration", 10);
    __publicField(this, "base_max_vel", 2);
    __publicField(this, "health", 500);
    __publicField(this, "max_health", 500);
    __publicField(this, "attacking_acceleration", 100);
    __publicField(this, "attacking_max_vel", 200);
    __publicField(this, "attack_damage", 50);
    __publicField(this, "attack_duration", 500);
    // TODO: aggro: number = 0.0
    // TODO: AI
    __publicField(this, "next_attack_ts", 1e10);
    __publicField(this, "auto_attack_dist", 200);
    __publicField(this, "auto_attack_interval", [2e3, 4e3]);
    this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el);
    const rel_rect = this.game.get_relative_rect(this.enemy_root_el);
    this.enemy_root_el.style.top = `${rel_rect.y}px`;
    this.enemy_root_el.style.left = `${rel_rect.x}px`;
    this.enemy_root_el.style.bottom = "unset";
    this.enemy_root_el.style.right = "unset";
    this.target = this.pos = this.display_pos;
    this.enemy_root_el.addEventListener("click", this._aggro_trigger.bind(this));
  }
  get display_pos() {
    const rel_rect = this.game.get_relative_rect(this.enemy_root_el);
    return { x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2 };
  }
  _update(context) {
    if (this.game.state === "battle" && !this.attacking) {
      this.target = { ...this.game.player.pos };
    }
    super._update(context);
    if (this.game.state === "battle") {
      const player_dist = dist(this.pos.x - this.game.player.pos.x, this.pos.y - this.game.player.pos.y);
      if (this.can_attack && context.timestamp > this.next_attack_ts && player_dist <= this.auto_attack_dist) {
        this.attack_requested = true;
      }
      if (this.dead) {
        this.game.change_state_soon("victory");
      }
    }
    this.enemy_root_el.style.top = `${this.pos.y - this.enemy_root_el.clientHeight / 2}px`;
    this.enemy_root_el.style.left = `${this.pos.x - this.enemy_root_el.clientWidth / 2}px`;
    this.enemy_root_el.classList.toggle("attacking", this.attacking);
  }
  calc_acceleration() {
    return this.attacking ? this.attacking_acceleration : super.calc_acceleration();
  }
  calc_max_vel() {
    return this.attacking ? this.attacking_max_vel : super.calc_max_vel();
  }
  _attack_start(context) {
    super._attack_start(context);
    this.enemy_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1e3}s`);
    this.enemy_root_el.style.setProperty("--attack-radius", `${this.attack_radius}px`);
  }
  _attack_end(context) {
    super._attack_end(context);
    this.next_attack_ts = this.calc_next_attack_ts(context.timestamp);
  }
  calc_next_attack_ts(now_ts) {
    return now_ts + this.auto_attack_interval[0] + Math.random() * (this.auto_attack_interval[1] - this.auto_attack_interval[0]);
  }
  _aggro_trigger() {
    if (this.game.state === "chill") {
      this.game.change_state_soon("battle");
      const game_rect = this.game.rect;
      this.target = { x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2 };
      this.next_attack_ts = this.calc_next_attack_ts(performance.now());
    }
  }
}
class HudBar extends GameComponent {
  constructor(game2, hud) {
    super(game2);
    __publicField(this, "hud");
    __publicField(this, "max_recent", 0);
    __publicField(this, "max_ts", 0);
    __publicField(this, "recent_delay", 1e3);
    this.hud = hud;
  }
  _update(context) {
    const { value, max } = this._get_values();
    if (value >= this.max_recent) {
      this.max_recent = value;
      this.max_ts = context.timestamp;
    } else {
      if (context.timestamp - this.max_ts > this.recent_delay) {
        this.max_recent = smooth_ema(this.max_recent, value, 0.25);
      }
    }
    const pct_value = value / max;
    const pct_diff = (this.max_recent - value) / max;
    this.bar_root_el.style.setProperty("--bar-fill", pct_value.toFixed(3));
    this.bar_root_el.style.setProperty("--bar-diff", pct_diff.toFixed(3));
  }
}
const hud_player_health_bar_selector = ".player-bar.bar.health";
class PlayerHealthBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_player_health_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.player.health, max: this.game.player.max_health };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
    }
  }
}
const hud_player_stamina_bar_selector = ".player-bar.bar.stamina";
class PlayerStaminaBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_player_stamina_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.player.stamina, max: this.game.player.max_stamina };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
      this.bar_root_el.classList.toggle("low-stamina", this.game.player.low_stamina);
    }
  }
}
const hud_enemy_health_bar_selector = ".enemy-bar.bar.health";
class EnemyHealthBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_enemy_health_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.enemy.health, max: this.game.enemy.max_health };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
    }
  }
}
const hud_root_selector = ".hud";
const hud_hidden_class = "hidden";
class Hud extends GameComponent {
  constructor(game2) {
    super(game2);
    __publicField(this, "hud_root_el");
    __publicField(this, "player_health_bar");
    __publicField(this, "player_stamina_bar");
    __publicField(this, "enemy_health_bar");
    this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el);
    this.player_health_bar = this.add_component(new PlayerHealthBar(game2, this));
    this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game2, this));
    this.enemy_health_bar = this.add_component(new EnemyHealthBar(game2, this));
  }
  get should_show() {
    return this.game.state !== "chill";
  }
  _update(context) {
    this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show);
  }
}
const defeat_screen_selector = ".defeat-screen";
class DefeatScreen extends GameComponent {
  constructor(game2) {
    super(game2);
    __publicField(this, "defeat_screen_el");
    this.defeat_screen_el = get_element(defeat_screen_selector, this.game.game_root_el);
  }
  _update(context) {
    this.defeat_screen_el.classList.toggle("hidden", this.game.state !== "defeat");
  }
}
const victory_screen_selector = ".victory-screen";
class VictoryScreen extends GameComponent {
  constructor(game2) {
    super(game2);
    __publicField(this, "victory_screen_el");
    this.victory_screen_el = get_element(victory_screen_selector, this.game.game_root_el);
  }
  _update(context) {
    this.victory_screen_el.classList.toggle("hidden", this.game.state !== "victory");
  }
}
const game_root_selector = "#game-root";
const battle_start_audio_selector = ".sound.battle-start";
const defeat_audio_selector = ".sound.defeat";
const victory_audio_selector = ".sound.victory";
class Game extends Component {
  constructor() {
    super();
    __publicField(this, "_state", "chill");
    __publicField(this, "_last_state", "chill");
    __publicField(this, "_next_state", null);
    __publicField(this, "game_root_el");
    __publicField(this, "_last_timestamp", null);
    __publicField(this, "player");
    __publicField(this, "enemy");
    __publicField(this, "characters", []);
    __publicField(this, "hud");
    __publicField(this, "defeat_screen");
    __publicField(this, "victory_screen");
    this.game_root_el = get_element(game_root_selector);
    this.game_root_el.classList.toggle("hidden", false);
    this.player = this.add_character(this.add_component(new Player(this)));
    this.enemy = this.add_character(this.add_component(new Enemy(this)));
    this.hud = this.add_component(new Hud(this));
    this.defeat_screen = this.add_component(new DefeatScreen(this));
    this.victory_screen = this.add_component(new VictoryScreen(this));
  }
  add_character(character) {
    this.characters.push(character);
    return character;
  }
  get changed_state() {
    return this.state !== this._last_state;
  }
  get state() {
    return this._state;
  }
  change_state_soon(new_state) {
    this._next_state = new_state;
  }
  handle_shell_event(event) {
    if (!event || typeof event !== "object" || !("type" in event)) {
      console.warn("Received unknown event object", event);
      return;
    }
    if (event.type === "adStarted") ;
  }
  _update(context) {
    this.game_root_el.classList.toggle("hide-mouse", this.state !== "chill");
    if (this.changed_state) {
      if (this.state === "battle") {
        send_shell_request({ type: "setVideoFilter", value: "blur(3px) brightness(0.8)" });
        play_audio_element(battle_start_audio_selector, this.game_root_el).then(async () => {
          await delay(3500);
          const battle_start_audio_el = get_element(
            battle_start_audio_selector,
            this.game_root_el
          );
          await fade_audio(battle_start_audio_el, { duration: 15e3, volume: 0, stop_after: true });
        });
      } else if (this.state === "defeat") {
        play_audio_element(defeat_audio_selector, this.game_root_el);
        setTimeout(() => send_shell_request({ type: "fail" }), 7e3);
      } else if (this.state === "victory") {
        play_audio_element(victory_audio_selector, this.game_root_el);
        setTimeout(() => send_shell_request({ type: "success" }), 7e3);
      }
    }
  }
  step(timestamp) {
    const context = {
      timestamp,
      timedelta: this._last_timestamp != null ? timestamp - this._last_timestamp : null
    };
    if (this._next_state != null) {
      this._state = this._next_state;
      this._next_state = null;
    }
    this.update(context);
    this._last_timestamp = timestamp;
    this._last_state = this._state;
  }
  get rect() {
    return this.game_root_el.getBoundingClientRect();
  }
  get_relative_rect(el) {
    const { x: game_x, y: game_y } = this.rect;
    const el_rect = el.getBoundingClientRect();
    return new DOMRect(el_rect.x - game_x, el_rect.y - game_y, el_rect.width, el_rect.height);
  }
}
let game = null;
function handle_shell_event(event) {
  if (event.type === "adStarted" && game == null) {
    game = new Game();
    setInterval(() => game == null ? void 0 : game.step(performance.now()), 1e3 / 60);
  }
  if (game != null) {
    game.handle_shell_event(event);
  }
}
add_shell_events_listener(handle_shell_event);
