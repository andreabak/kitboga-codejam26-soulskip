var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
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
const player_root_selector = ".player-pointer";
class PlayerActor extends Actor {
  constructor(game2) {
    super(game2);
    __publicField(this, "player_root_el");
    __publicField(this, "_follower");
    __publicField(this, "acceleration", 400);
    __publicField(this, "max_vel", 100);
    __publicField(this, "stamina", 200);
    __publicField(this, "max_stamina", 200);
    __publicField(this, "stamina_consume_factor", 4);
    __publicField(this, "stamina_consume_min", 21);
    __publicField(this, "stamina_recover", 100);
    __publicField(this, "stamina_recover_delay", 500);
    __publicField(this, "last_stamina_consume_ts", 0);
    __publicField(this, "low_stamina_max_vel", 5);
    __publicField(this, "low_stamina_accel", 100);
    this.player_root_el = get_element(player_root_selector, this.game.game_root_el);
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { acceleration: this.acceleration, max_vel: this.max_vel, slowing_distance: 50 }
    );
    this._on_mousemove = this._on_mousemove.bind(this);
    this.game.game_root_el.addEventListener("mousemove", this._on_mousemove);
  }
  _on_mousemove(event) {
    const rect = this.game.game_root_el.getBoundingClientRect();
    this._follower.target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  _update(context) {
    if (context.timedelta != null) {
      this._follower.update(context.timedelta);
    } else {
      this._follower.pos = { ...this._follower.target };
    }
    this.player_root_el.style.top = `${this._follower.pos.y - this.player_root_el.clientHeight / 2}px`;
    this.player_root_el.style.left = `${this._follower.pos.x - this.player_root_el.clientWidth / 2}px`;
    if (context.timedelta && context.timedelta > 0) {
      const s_delta = context.timedelta / 1e3;
      const stamina_consume = dist_pt(this._follower.velocity) * this.stamina_consume_factor * s_delta;
      if (stamina_consume / s_delta > this.stamina_consume_min) {
        this.stamina -= stamina_consume;
        this.last_stamina_consume_ts = context.timestamp;
      } else if (!this.last_stamina_consume_ts || context.timestamp - this.last_stamina_consume_ts >= this.stamina_recover_delay) {
        this.stamina += this.stamina_recover * s_delta;
      }
      this.stamina = Math.max(0, Math.min(this.stamina, this.max_stamina));
      const low_stamina = this.stamina < 1;
      this._follower.max_vel = low_stamina ? this.low_stamina_max_vel : this.max_vel;
      this._follower.acceleration = low_stamina ? this.low_stamina_accel : this.acceleration;
      this.player_root_el.classList.toggle("low-stamina", low_stamina);
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
const hud_root_selector = ".hud";
const hud_stamina_bar_selector = ".bar.stamina";
const hud_hidden_class = "hidden";
class Hud extends GameComponent {
  constructor(game2) {
    super(game2);
    __publicField(this, "hud_root_el");
    __publicField(this, "stamina_bar_el");
    __publicField(this, "player_stamina_max_recent", 0);
    __publicField(this, "player_stamina_max_ts", 0);
    __publicField(this, "bar_recent_delay", 1e3);
    this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el);
    this.stamina_bar_el = get_element(hud_stamina_bar_selector, this.hud_root_el);
  }
  _update(context) {
    const should_show = this.game.state !== "chill";
    this.hud_root_el.classList.toggle(hud_hidden_class, !should_show);
    if (should_show) {
      const stamina = this.game.player_actor.stamina;
      if (stamina >= this.player_stamina_max_recent) {
        this.player_stamina_max_recent = stamina;
        this.player_stamina_max_ts = context.timestamp;
      } else {
        if (context.timestamp - this.player_stamina_max_ts > this.bar_recent_delay) {
          this.player_stamina_max_recent = smooth_ema(this.player_stamina_max_recent, stamina, 0.5);
        }
      }
      const pct_stamina = stamina / this.game.player_actor.max_stamina;
      const pct_diff = (this.player_stamina_max_recent - stamina) / this.game.player_actor.max_stamina;
      this.stamina_bar_el.style.setProperty("--bar-fill", pct_stamina.toFixed(3));
      this.stamina_bar_el.style.setProperty("--bar-diff", pct_diff.toFixed(3));
    }
  }
}
const game_root_selector = "#game-root";
class Game extends Component {
  constructor() {
    super();
    __publicField(this, "state", "chill");
    __publicField(this, "game_root_el");
    __publicField(this, "_last_timestamp", null);
    __publicField(this, "player_actor");
    __publicField(this, "enemy_actor");
    __publicField(this, "_hud");
    this.game_root_el = get_element(game_root_selector);
    this.game_root_el.classList.toggle("hidden", false);
    this.player_actor = this.add_component(new PlayerActor(this));
    this.enemy_actor = this.add_component(new EnemyActor(this));
    this._hud = this.add_component(new Hud(this));
  }
  handle_shell_event(event) {
    if (!event || typeof event !== "object" || !("type" in event)) {
      console.warn("Received unknown event object", event);
      return;
    }
    if (event.type === "adStarted") ;
  }
  _update(context) {
  }
  step(timestamp) {
    const context = {
      timestamp,
      timedelta: this._last_timestamp != null ? timestamp - this._last_timestamp : null
    };
    this.update(context);
    this._last_timestamp = timestamp;
  }
}
function add_shell_events_listener(listener) {
  window.addEventListener("message", (event) => {
    var _a;
    if (!event || typeof event !== "object" || !((_a = event == null ? void 0 : event.data) == null ? void 0 : _a.type)) return;
    listener(event.data);
  });
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
