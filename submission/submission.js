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
function get_element(selector, root) {
  root = root ?? document;
  const el = root.querySelector(selector);
  if (!el) throw new Error(`Could not find element with selector "${selector}"`);
  return el;
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
const player_root_selector = ".player";
class PlayerActor extends Actor {
  constructor(game2) {
    super(game2);
    __publicField(this, "player_root_el");
    __publicField(this, "_follower");
    __publicField(this, "acceleration", 500);
    __publicField(this, "max_vel", 200);
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
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { acceleration: this.acceleration, max_vel: this.max_vel, slowing_distance: 50 }
    );
    this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this));
    this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this));
  }
  _on_mousemove(event) {
    const rect = this.game.game_root_el.getBoundingClientRect();
    this._follower.target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  _on_mousedown(event) {
    this.attack_requested = true;
  }
  _update(context) {
    this.player_root_el.classList.toggle("hidden", this.game.state === "chill");
    const s_delta = (context.timedelta ?? 0) / 1e3;
    let stamina_consume = 0;
    if (context.timedelta != null) {
      this._follower.update(context.timedelta);
    } else {
      this._follower.pos = { ...this._follower.target };
    }
    this.player_root_el.style.top = `${this._follower.pos.y - this.player_root_el.clientHeight / 2}px`;
    this.player_root_el.style.left = `${this._follower.pos.x - this.player_root_el.clientWidth / 2}px`;
    const vel_mag = dist_pt(this._follower.velocity);
    if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
      stamina_consume += vel_mag * this.stamina_movement_consume_factor * s_delta;
    }
    if (this.attack_requested) {
      this.attack_requested = false;
      if (!this.attacking && !this.low_stamina) {
        this.attacking = true;
        this.last_attack_ts = context.timestamp;
        stamina_consume += this.attack_stamina_consume;
        this.player_root_el.style.setProperty("--attack-duration", `${this.attack_duration / 1e3}s`);
      }
    }
    if (this.attacking && context.timestamp - this.last_attack_ts >= this.attack_duration) {
      this.attacking = false;
    }
    this.player_root_el.classList.toggle("attacking", this.attacking);
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
      this._follower.max_vel = this.low_stamina ? this.low_stamina_max_vel : this.max_vel;
      this._follower.acceleration = this.low_stamina ? this.low_stamina_accel : this.acceleration;
      this.player_root_el.classList.toggle("low-stamina", this.low_stamina);
    }
  }
}
const enemy_root_selector = ".skip-btn";
class EnemyActor extends Actor {
  // TODO: aggro: number = 0.0
  constructor(game2) {
    super(game2);
    __publicField(this, "enemy_root_el");
    this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el);
    this.enemy_root_el.addEventListener("click", () => this.game.state = "battle");
  }
  _update(context) {
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
        this.max_recent = smooth_ema(this.max_recent, value, 0.5);
      }
    }
    const pct_value = value / max;
    const pct_diff = (this.max_recent - value) / max;
    this.bar_root_el.style.setProperty("--bar-fill", pct_value.toFixed(3));
    this.bar_root_el.style.setProperty("--bar-diff", pct_diff.toFixed(3));
  }
}
const hud_health_bar_selector = ".bar.health";
class HealthBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_health_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.player_actor.health, max: this.game.player_actor.max_health };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
    }
  }
}
const hud_stamina_bar_selector = ".bar.stamina";
class StaminaBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_stamina_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.player_actor.stamina, max: this.game.player_actor.max_stamina };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
      this.bar_root_el.classList.toggle("low-stamina", this.game.player_actor.low_stamina);
    }
  }
}
const hud_root_selector = ".hud";
const hud_hidden_class = "hidden";
class Hud extends GameComponent {
  constructor(game2) {
    super(game2);
    __publicField(this, "hud_root_el");
    __publicField(this, "health_bar");
    __publicField(this, "stamina_bar");
    this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el);
    this.health_bar = this.add_component(new HealthBar(game2, this));
    this.stamina_bar = this.add_component(new StaminaBar(game2, this));
  }
  get should_show() {
    return this.game.state !== "chill";
  }
  _update(context) {
    this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show);
  }
}
const game_root_selector = "#game-root";
class Game extends Component {
  constructor() {
    super();
    __publicField(this, "state", "chill");
    __publicField(this, "last_state", "chill");
    __publicField(this, "game_root_el");
    __publicField(this, "_last_timestamp", null);
    __publicField(this, "player_actor");
    __publicField(this, "enemy_actor");
    __publicField(this, "hud");
    this.game_root_el = get_element(game_root_selector);
    this.game_root_el.classList.toggle("hidden", false);
    this.player_actor = this.add_component(new PlayerActor(this));
    this.enemy_actor = this.add_component(new EnemyActor(this));
    this.hud = this.add_component(new Hud(this));
  }
  get changed_state() {
    return this.state !== this.last_state;
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
    if (this.changed_state && this.last_state === "chill") {
      send_shell_request({ type: "setVideoFilter", value: "blur(3px) brightness(0.8)" });
    }
  }
  step(timestamp) {
    const context = {
      timestamp,
      timedelta: this._last_timestamp != null ? timestamp - this._last_timestamp : null
    };
    this.update(context);
    this._last_timestamp = timestamp;
    this.last_state = this.state;
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
