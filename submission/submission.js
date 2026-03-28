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
  if (el.paused) {
    el.currentTime = 0;
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
function rect_to_shape(rect) {
  return {
    points: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ]
  };
}
function rect_center_dist(rect, angle) {
  return Math.min(rect.width / 2 / Math.abs(Math.cos(angle)), rect.height / 2 / Math.abs(Math.sin(angle)));
}
function shape_bbox(shape) {
  if (!shape.points.length) {
    throw new Error("Shape has no points!");
  }
  let [min_x, max_x, min_y, max_y] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of shape.points) {
    min_x = Math.min(min_x, p.x);
    max_x = Math.max(max_x, p.x);
    min_y = Math.min(min_y, p.y);
    max_y = Math.max(max_y, p.y);
  }
  return {
    x: min_x,
    y: min_y,
    width: max_x - min_x,
    height: max_y - min_y
  };
}
function transform(points, {
  translate,
  rotate,
  scale,
  origin
}) {
  translate = translate ?? { x: 0, y: 0 };
  rotate = rotate ?? 0;
  const rvec = { x: Math.cos(rotate), y: Math.sin(rotate) };
  scale = scale ?? 1;
  scale = typeof scale === "number" ? { x: scale, y: scale } : scale;
  origin = origin ?? { x: 0, y: 0 };
  const result = [];
  for (const p of points) {
    let x = p.x + translate.x - origin.x;
    let y = p.y + translate.y - origin.y;
    const rx = x * rvec.x - y * rvec.y;
    const ry = x * rvec.y + y * rvec.x;
    x = rx;
    y = ry;
    x *= scale.x;
    y *= scale.y;
    x += origin.x;
    y += origin.y;
    result.push({ x, y });
  }
  return result;
}
function transform_shape(shape, {
  translate,
  rotate,
  scale,
  origin
}) {
  return { points: transform(shape.points, { translate, rotate, scale, origin }) };
}
function dist(x, y) {
  return Math.sqrt(x * x + y * y);
}
function dist_pt(p) {
  return dist(p.x, p.y);
}
function rotate_vector_clamped(vector, target, max_angle_delta) {
  const mag = typeof vector === "number" ? 1 : dist(vector.x, vector.y);
  const angle = typeof vector === "number" ? vector : Math.atan2(vector.y, vector.x);
  if (typeof target === "object" && "x" in target && "y" in target) target = Math.atan2(target.y, target.x);
  let delta = target - angle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  else if (delta < -Math.PI) delta += 2 * Math.PI;
  delta = Math.max(-max_angle_delta, Math.min(max_angle_delta, delta));
  const new_angle = angle + delta;
  return [{ x: mag * Math.cos(new_angle), y: mag * Math.sin(new_angle) }, new_angle];
}
function aabb_overlap(a, b) {
  return !(a.x > b.x + b.width || a.x + a.width < b.x || a.y > b.y + b.height || a.y + a.height < b.y);
}
function sat_overlap(a, b) {
  const get_axes = (points) => points.map((p0, i) => {
    const p1 = points[(i + 1) % points.length];
    return { x: -p1.y + p0.y, y: p1.x - p0.x };
  });
  const projected_range = (points, axis) => {
    let [min, max] = [Infinity, -Infinity];
    for (const p of points) {
      const proj = p.x * axis.x + p.y * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }
    return [min, max];
  };
  const axes = [...get_axes(a.points), ...get_axes(b.points)];
  return !axes.some((axis) => {
    const [a_min, a_max] = projected_range(a.points, axis);
    const [b_min, b_max] = projected_range(b.points, axis);
    return a_max < b_min || b_max < a_min;
  });
}
class TargetFollower {
  constructor(pos, target, {
    acceleration,
    velocity = { x: 0, y: 0 },
    direction = -90 / 180 * Math.PI,
    max_vel = null,
    slowing_distance = null,
    vel_max_rotation = Infinity,
    dir_max_rotation = Infinity
  }) {
    __publicField(this, "pos");
    __publicField(this, "pos_target");
    __publicField(this, "dir_target", "pos");
    __publicField(this, "acceleration");
    __publicField(this, "_vel");
    __publicField(this, "_direction");
    __publicField(this, "max_vel");
    __publicField(this, "slowing_distance");
    __publicField(this, "vel_max_rotation");
    __publicField(this, "dir_max_rotation");
    this.pos = pos;
    this.pos_target = target;
    this.acceleration = acceleration;
    this._vel = velocity;
    this._direction = direction;
    this.max_vel = max_vel;
    this.slowing_distance = slowing_distance;
    this.vel_max_rotation = vel_max_rotation;
    this.dir_max_rotation = dir_max_rotation;
  }
  get velocity() {
    return { ...this._vel };
  }
  get direction() {
    return this._direction;
  }
  get direction_vector() {
    return { x: Math.cos(this._direction), y: Math.sin(this._direction) };
  }
  update(timestep, { target } = {}) {
    if (target != null) {
      this.pos_target = target;
    }
    if (!timestep || timestep < 0) {
      return this.pos;
    }
    const secs = timestep / 1e3;
    const dx = this.pos_target.x - this.pos.x;
    const dy = this.pos_target.y - this.pos.y;
    const d = dist(dx, dy);
    if (d > 0) {
      this._vel.x += dx / d * this.acceleration * secs;
      this._vel.y += dy / d * this.acceleration * secs;
    }
    if (this.slowing_distance && d < this.slowing_distance) {
      this._vel.x *= 1 - this.slowing_distance / (d + this.slowing_distance);
      this._vel.y *= 1 - this.slowing_distance / (d + this.slowing_distance);
    }
    let vel = dist(this._vel.x, this._vel.y);
    if (d > 0) {
      [this._vel] = rotate_vector_clamped(this._vel, { x: dx, y: dy }, this.vel_max_rotation * secs);
    }
    if (this.max_vel != null && vel >= this.max_vel) {
      this._vel.x = this.max_vel * (this._vel.x / vel);
      this._vel.y = this.max_vel * (this._vel.y / vel);
    }
    vel = dist(this._vel.x, this._vel.y);
    let dir_target = null;
    if (this.dir_target === "pos") {
      if (vel > 0.1) dir_target = this._vel;
    } else if (this.dir_target != null && "x" in this.dir_target && "y" in this.dir_target) {
      dir_target = { x: this.dir_target.x - this.pos.x, y: this.dir_target.y - this.pos.y };
    }
    if (dir_target) {
      [, this._direction] = rotate_vector_clamped(this._direction, dir_target, this.dir_max_rotation * secs);
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
const ATTACK_PHASES_SEQUENCE = ["anticipation", "hit", "recovery"];
class Character extends Actor {
  constructor(game2) {
    super(game2);
    __publicField(this, "_follower");
    __publicField(this, "base_acceleration", 250);
    __publicField(this, "base_max_vel", 100);
    __publicField(this, "origin", { x: 24, y: 24 });
    // TODO: unused
    __publicField(this, "rotates", false);
    __publicField(this, "health", 100);
    __publicField(this, "max_health", 100);
    // TODO: sanity check
    __publicField(this, "last_damage_ts", -Infinity);
    __publicField(this, "stamina", 100);
    __publicField(this, "max_stamina", 100);
    // TODO: sanity check
    __publicField(this, "stamina_movement_consume_factor", 8);
    __publicField(this, "stamina_movement_vel_min", 40);
    __publicField(this, "stamina_recover", 100);
    __publicField(this, "stamina_recover_delay", 1e3);
    __publicField(this, "last_stamina_consume_ts", -Infinity);
    __publicField(this, "low_stamina_max_vel", 5);
    __publicField(this, "low_stamina_accel", 100);
    __publicField(this, "low_stamina", false);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 100);
    __publicField(this, "attack_requested", false);
    __publicField(this, "current_attack", null);
    __publicField(this, "attack_stamina_consume_multiplier", 1);
    __publicField(this, "last_attack_hits", []);
    __publicField(this, "defend_requested", false);
    __publicField(this, "defend_request_ts", -Infinity);
    __publicField(this, "defend_damage_reduction", 0.75);
    __publicField(this, "defend_stamina_consume_factor", 0.3);
    __publicField(this, "defend_acceleration", 50);
    __publicField(this, "defend_max_vel", 5);
    __publicField(this, "defending", false);
    __publicField(this, "parry_enemy_stamina_consume_factor", 0.1);
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      {
        acceleration: this.base_acceleration,
        max_vel: this.base_max_vel,
        slowing_distance: 25,
        vel_max_rotation: 10 * 360 / 180 * Math.PI,
        dir_max_rotation: 2 * 360 / 180 * Math.PI
      }
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
  get pos_target() {
    return this._follower.pos_target;
  }
  set pos_target(value) {
    this._follower.pos_target = value;
  }
  get dir_target() {
    return this._follower.dir_target;
  }
  set dir_target(value) {
    this._follower.dir_target = value;
  }
  get direction() {
    return this._follower.direction;
  }
  get direction_vector() {
    return this._follower.direction_vector;
  }
  get attacking() {
    return this.current_attack != null;
  }
  get current_attack_phase() {
    if (this.current_attack == null) return null;
    return this.current_attack.phases[this.current_attack.current_phase];
  }
  _transform_shape(rel_shape, {
    rotation_ref = 0,
    rotates = true,
    scale_ref = 1,
    keep_aspect_ratio = false
  } = {}) {
    let shape = rel_shape;
    if (!("points" in shape)) {
      shape = rect_to_shape(shape);
    }
    let scale = { x: this.width / 2, y: this.height / 2 };
    if (keep_aspect_ratio) {
      const uniform_scale = (scale.x + scale.y) / 2;
      scale = { x: uniform_scale, y: uniform_scale };
    }
    shape = transform_shape(shape, {
      rotate: (rotates ? this._follower.direction : 0) - rotation_ref,
      scale: { x: scale.x * scale_ref, y: scale.y * scale_ref }
    });
    return shape;
  }
  get hurtbox() {
    return this._transform_shape(this.hurtbox_def.shape, {
      rotation_ref: this.hurtbox_def.rotation_ref,
      rotates: this.rotates
    });
  }
  get hurtbox_abs() {
    return transform_shape(this.hurtbox, { translate: this.pos });
  }
  get attack_hitbox() {
    if (!this.current_attack) {
      return null;
    }
    return this._transform_shape(this.current_attack.hitbox.shape, {
      rotation_ref: this.current_attack.hitbox.rotation_ref,
      rotates: true,
      scale_ref: this.current_attack.scale,
      keep_aspect_ratio: true
    });
  }
  get attack_hitbox_abs() {
    const attack_hitbox = this.attack_hitbox;
    if (!attack_hitbox) return null;
    return transform_shape(this.attack_hitbox, { translate: this.pos });
  }
  get dead() {
    return this.health <= 0;
  }
  get can_attack() {
    return !this.attacking && !this.low_stamina && !this.dead;
  }
  get can_defend() {
    return !this.attacking && !this.low_stamina && !this.dead;
  }
  get can_parry() {
    return !this.attacking && !this.low_stamina && !this.dead;
  }
  consume_stamina(amount, { context }) {
    this.stamina -= amount;
    if (this.stamina < 0) this.stamina = 0;
    this.last_stamina_consume_ts = context.timeref;
  }
  _update(context) {
    var _a;
    const s_delta = (context.timedelta ?? 0) / 1e3;
    if (context.timedelta != null) {
      this._follower.update(context.timedelta);
    } else {
      this._follower.pos = { ...this._follower.pos_target };
    }
    const vel_mag = dist_pt(this._follower.velocity);
    if (!this.low_stamina && vel_mag > this.stamina_movement_vel_min) {
      this.consume_stamina(vel_mag * this.stamina_movement_consume_factor * s_delta, { context });
    }
    if (this.attack_requested) {
      this.attack_requested = false;
      if (this.can_attack) {
        const attack_def = this.new_attack();
        this.current_attack = {
          ...attack_def,
          start_ts: context.timeref,
          current_phase: ATTACK_PHASES_SEQUENCE[0]
        };
        this.current_attack.phases[this.current_attack.current_phase].start_ts = context.timeref;
        this.consume_stamina(this.current_attack.stamina_consume * this.attack_stamina_consume_multiplier, {
          context
        });
        this.last_attack_hits = [];
        this._attack_start(this.current_attack, { context });
      }
    }
    if (this.current_attack) {
      const current_phase = this.current_attack.phases[this.current_attack.current_phase];
      if (current_phase.start_ts == null) {
        current_phase.start_ts = context.timeref;
      } else if (current_phase.start_ts + current_phase.duration <= context.timeref) {
        const phase_idx = ATTACK_PHASES_SEQUENCE.indexOf(this.current_attack.current_phase);
        if (phase_idx + 1 < ATTACK_PHASES_SEQUENCE.length) {
          const next_phase_name = ATTACK_PHASES_SEQUENCE[phase_idx + 1];
          this.current_attack.current_phase = next_phase_name;
          this.current_attack.phases[next_phase_name].start_ts = context.timeref;
        } else {
          this._attack_end(this.current_attack, { context });
          this.current_attack = null;
        }
      }
      if (((_a = this.current_attack) == null ? void 0 : _a.current_phase) === "hit") {
        this._check_attack_hits(context);
      }
    }
    if (this.defend_requested) {
      if (this.can_defend) {
        this.defending = true;
      }
    }
    if (this.defending) {
      if (!this.defend_requested || !this.can_defend) {
        this.defending = false;
      }
    }
    if (context.timedelta && context.timedelta > 0) {
      if (context.timeref - this.last_stamina_consume_ts >= this.stamina_recover_delay) {
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
    var _a;
    return this.attacking ? ((_a = this.current_attack_phase) == null ? void 0 : _a.acceleration) ?? this.base_acceleration : this.defending ? this.defend_acceleration : this.low_stamina ? this.low_stamina_accel : this.base_acceleration;
  }
  calc_max_vel() {
    var _a;
    return this.dead ? 0 : this.attacking ? ((_a = this.current_attack_phase) == null ? void 0 : _a.max_vel) ?? this.base_max_vel : this.defending ? this.defend_max_vel : this.low_stamina ? this.low_stamina_max_vel : this.base_max_vel;
  }
  _attack_start(attack, { context }) {
  }
  _attack_end(attack, { context }) {
  }
  _check_attack_hits(context) {
    var _a;
    if (((_a = this.current_attack) == null ? void 0 : _a.current_phase) !== "hit") return;
    for (const character of this.game.characters) {
      if (character === this) continue;
      if (this.last_attack_hits.some((c) => c === character)) continue;
      const attack_hitbox_abs = this.attack_hitbox_abs;
      if (attack_hitbox_abs == null) throw new Error("expected attack hitbox with current_attack set");
      const character_hurtbox_abs = character.hurtbox_abs;
      const attack_hitbox_bbox = shape_bbox(attack_hitbox_abs);
      const character_hurtbox_bbox = shape_bbox(character_hurtbox_abs);
      if (aabb_overlap(character_hurtbox_bbox, attack_hitbox_bbox) && sat_overlap(attack_hitbox_abs, character_hurtbox_abs) && character.attack_hit({ attack: this.current_attack, attacking_character: this, context })) {
        this.last_attack_hits.push(character);
      }
    }
  }
  attack_hit({
    attack,
    attacking_character,
    context
  }) {
    console.assert(attack.current_phase === "hit");
    if (this.can_parry) {
      const within_parry_window = Math.abs(
        (this.defending ? this.defend_request_ts : context.timeref) - (attack.phases["hit"].start_ts ?? Infinity)
      ) < attack.parry_window_duration / 2;
      if (within_parry_window) {
        if (!this.defending) {
          return false;
        } else if (this.attack_parry({ attack, attacking_character, context })) {
          return true;
        }
      }
    }
    let health_damage = attack.damage;
    if (this.defending && !this.low_stamina) {
      const stamina_consume = attack.damage * this.defend_stamina_consume_factor;
      this.consume_stamina(stamina_consume, { context });
      health_damage *= 1 - this.defend_damage_reduction;
    }
    if (health_damage >= 0) {
      this.health -= health_damage;
      this.last_damage_ts = context.timeref;
      if (this.health < 0) this.health = 0;
    }
    return true;
  }
  attack_parry({
    attack,
    attacking_character,
    context
  }) {
    attacking_character.consume_stamina(attack.damage * this.parry_enemy_stamina_consume_factor, { context });
    return true;
  }
}
const player_root_selector = ".player";
const parry_audio_selector = ".sound.parry";
const enemy_break_audio_selector = ".sound.enemy-break";
class Player extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "player_root_el");
    __publicField(this, "width", 48);
    __publicField(this, "height", 48);
    __publicField(this, "base_acceleration", 500);
    __publicField(this, "base_max_vel", 100);
    __publicField(this, "health", 1850);
    __publicField(this, "max_health", 1850);
    __publicField(this, "stamina", 200);
    __publicField(this, "max_stamina", 200);
    __publicField(this, "stamina_movement_consume_factor", 14);
    __publicField(this, "stamina_movement_vel_min", 30);
    __publicField(this, "stamina_recover", 100);
    __publicField(this, "stamina_recover_delay", 500);
    __publicField(this, "last_stamina_consume_ts", -Infinity);
    __publicField(this, "low_stamina_max_vel", 1);
    __publicField(this, "low_stamina_accel", 100);
    __publicField(this, "low_stamina", false);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 200);
    // TODO: sanity check
    __publicField(this, "hurtbox_def", { shape: { x: 0, y: 0, width: 0.75, height: 1 }, rotation_ref: 0 });
    __publicField(this, "attacks_defs", {
      fast: {
        phases: {
          anticipation: { duration: 50, acceleration: 20 },
          hit: { duration: 150, acceleration: 10 },
          recovery: { duration: 100, acceleration: 50 }
        },
        damage: 213,
        stamina_consume: 30,
        parry_window_duration: 200,
        scale: 3,
        hitbox: {
          shape: {
            points: [
              { x: -1, y: 0 },
              { x: -0.71, y: -0.71 },
              { x: 0, y: -1 },
              { x: 0.71, y: -0.71 },
              { x: 1, y: 0 },
              { x: 0.25, y: 0.25 },
              { x: -0.25, y: 0.25 }
            ]
          },
          rotation_ref: -90 / 180 * Math.PI
        }
      }
    });
    this.player_root_el = get_element(player_root_selector, this.game.game_root_el);
    this.game.game_root_el.addEventListener("mousemove", this._on_mousemove.bind(this));
    this.game.game_root_el.addEventListener("mousedown", this._on_mousedown.bind(this));
    this.game.game_root_el.addEventListener("mouseup", this._on_mouseup.bind(this));
    this.game.game_root_el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });
  }
  _on_mousemove(event) {
    const rect = this.game.game_root_el.getBoundingClientRect();
    this.pos_target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  _on_mousedown(event) {
    if (event.button === 0) {
      this.attack_requested = true;
    } else if (event.button === 2) {
      this.defend_request_ts = this.game.timeref;
      this.defend_requested = true;
    }
  }
  _on_mouseup(event) {
    if (event.button === 2) {
      this.defend_request_ts = this.game.timeref;
      this.defend_requested = false;
    }
  }
  _update(context) {
    var _a;
    super._update(context);
    if (this.game.state === "battle" && !this.attacking) {
      this.dir_target = { ...this.game.enemy.pos };
    }
    if (this.game.state === "battle" && this.dead) {
      this.game.change_state_soon("defeat");
    }
    this.player_root_el.classList.toggle("hidden", this.game.state === "chill");
    this.player_root_el.style.top = `${this.pos.y - this.player_root_el.clientHeight / 2}px`;
    this.player_root_el.style.left = `${this.pos.x - this.player_root_el.clientWidth / 2}px`;
    this.player_root_el.classList.toggle("attacking", this.attacking);
    for (const phase of ATTACK_PHASES_SEQUENCE) {
      this.player_root_el.classList.toggle(`attack-phase-${phase}`, ((_a = this.current_attack) == null ? void 0 : _a.current_phase) == phase);
    }
    this.player_root_el.classList.toggle("defending", this.defending);
    this.player_root_el.classList.toggle("low-stamina", this.low_stamina);
    this.player_root_el.classList.toggle("hurt", context.timeref - this.last_damage_ts < 500);
  }
  new_attack() {
    return this.attacks_defs["fast"];
  }
  _attack_start(attack, { context }) {
    super._attack_start(attack, { context });
    this.player_root_el.style.setProperty("--attack-scale", attack.scale.toString());
  }
  attack_parry({
    attack,
    attacking_character,
    context
  }) {
    const do_parry = super.attack_parry({ attack, attacking_character, context });
    if (do_parry) {
      this.game.timescale = 0.1;
      setTimeout(() => this.game.timescale = 1, 500);
      if (attacking_character.stamina < attacking_character.low_stamina_enter_threshold) {
        play_audio_element(enemy_break_audio_selector, this.game.game_root_el);
      } else {
        play_audio_element(parry_audio_selector, this.game.game_root_el);
      }
    }
    return do_parry;
  }
}
const enemy_root_selector = ".skip-btn";
class Enemy extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "enemy_root_el");
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "base_acceleration", 10);
    __publicField(this, "base_max_vel", 2);
    __publicField(this, "health", 5e3);
    __publicField(this, "max_health", 5e3);
    __publicField(this, "hurtbox_def", { shape: { x: -1, y: -1, width: 2, height: 2 }, rotation_ref: 0 });
    __publicField(this, "max_stamina", 150);
    // TODO: sanity check
    __publicField(this, "stamina_recover", 25);
    __publicField(this, "stamina_recover_delay", 2e3);
    __publicField(this, "low_stamina_max_vel", 0.1);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 150);
    // TODO: sanity check
    __publicField(this, "attacks_defs", {
      slash: {
        phases: {
          anticipation: { duration: 300, acceleration: 100, max_vel: 100 },
          hit: { duration: 200, acceleration: 20, max_vel: 5 },
          recovery: { duration: 500 }
        },
        damage: 500,
        stamina_consume: 5,
        parry_window_duration: 100,
        scale: 2.5,
        hitbox: {
          shape: {
            points: [
              { x: -1, y: 0 },
              { x: -0.71, y: -0.71 },
              { x: 0, y: -1 },
              { x: 0.71, y: -0.71 },
              { x: 1, y: 0 },
              { x: 0.25, y: 0.25 },
              { x: -0.25, y: 0.25 }
            ]
          },
          rotation_ref: -90 / 180 * Math.PI
        }
      }
    });
    // TODO: aggro: number = 0.0
    // TODO: AI
    __publicField(this, "follow_dist_offset", 5);
    __publicField(this, "next_attack_ts", 1e10);
    __publicField(this, "auto_attack_dist", 400);
    __publicField(this, "auto_attack_interval", [500, 2e3]);
    this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el);
    const rel_rect = this.game.get_relative_rect(this.enemy_root_el);
    this.enemy_root_el.style.top = `${rel_rect.y}px`;
    this.enemy_root_el.style.left = `${rel_rect.x}px`;
    this.enemy_root_el.style.bottom = "unset";
    this.enemy_root_el.style.right = "unset";
    this.pos_target = this.pos = this.display_pos;
    this.width = rel_rect.width;
    this.height = rel_rect.height;
    this.enemy_root_el.addEventListener("click", this._aggro_trigger.bind(this));
  }
  get display_pos() {
    const rel_rect = this.game.get_relative_rect(this.enemy_root_el);
    return { x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2 };
  }
  _update(context) {
    var _a;
    if (this.game.state === "battle" && !this.attacking) {
      this.pos_target = this._get_reach_player_point();
      this.dir_target = { ...this.game.player.pos };
    }
    const low_stamina_before = this.low_stamina;
    super._update(context);
    if (this.game.state === "battle") {
      const player_dist = dist(this.pos.x - this.game.player.pos.x, this.pos.y - this.game.player.pos.y);
      if (this.can_attack && context.timeref > this.next_attack_ts && player_dist <= this.auto_attack_dist) {
        this.attack_requested = true;
      }
      if (!low_stamina_before && this.low_stamina) {
        play_audio_element(enemy_break_audio_selector, this.game.game_root_el);
      }
      if (this.dead) {
        this.game.change_state_soon("victory");
      }
    }
    this.enemy_root_el.style.top = `${this.pos.y - this.enemy_root_el.clientHeight / 2}px`;
    this.enemy_root_el.style.left = `${this.pos.x - this.enemy_root_el.clientWidth / 2}px`;
    this.enemy_root_el.classList.toggle("attacking", this.attacking);
    for (const phase of ATTACK_PHASES_SEQUENCE) {
      this.enemy_root_el.classList.toggle(`attack-phase-${phase}`, ((_a = this.current_attack) == null ? void 0 : _a.current_phase) == phase);
    }
  }
  _get_reach_player_point() {
    const origin_bbox = shape_bbox(this.hurtbox_abs);
    const origin = { x: origin_bbox.x + origin_bbox.width / 2, y: origin_bbox.y + origin_bbox.height / 2 };
    const target_bbox = shape_bbox(this.game.player.hurtbox_abs);
    const target = { x: target_bbox.x + target_bbox.width / 2, y: target_bbox.y + target_bbox.height / 2 };
    const line_vec = { x: target.x - origin.x, y: target.y - origin.y };
    const line_angle = Math.atan2(line_vec.y, line_vec.x);
    const line_dist = dist(line_vec.x, line_vec.y);
    const offset_dist = rect_center_dist(origin_bbox, line_angle) + rect_center_dist(target_bbox, line_angle) + this.follow_dist_offset;
    let reach_dist = line_dist - offset_dist;
    if (reach_dist < 0) {
      reach_dist = 1;
    }
    return {
      x: origin.x + line_vec.x * (reach_dist / line_dist),
      y: origin.y + line_vec.y * (reach_dist / line_dist)
    };
  }
  new_attack() {
    return this.attacks_defs["slash"];
  }
  _attack_start(attack, { context }) {
    super._attack_start(attack, { context });
    this.enemy_root_el.style.setProperty("--attack-scale", attack.scale.toString());
  }
  _attack_end(attack, { context }) {
    super._attack_end(attack, { context });
    this.next_attack_ts = this.calc_next_attack_ts(context.timeref);
  }
  calc_next_attack_ts(now_ts) {
    return now_ts + this.auto_attack_interval[0] + Math.random() * (this.auto_attack_interval[1] - this.auto_attack_interval[0]);
  }
  _aggro_trigger() {
    if (this.game.state === "chill") {
      this.game.change_state_soon("battle");
      const game_rect = this.game.rect;
      this.pos_target = { x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2 };
      this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref);
    }
  }
}
class HudBar extends GameComponent {
  constructor(game2, hud) {
    super(game2);
    __publicField(this, "hud");
    __publicField(this, "value", 0);
    __publicField(this, "max", 0);
    __publicField(this, "max_recent", 0);
    __publicField(this, "max_ts", -Infinity);
    __publicField(this, "recent_delay", 1e3);
    __publicField(this, "decay_pct_speed", 200);
    this.hud = hud;
  }
  _update(context) {
    const { value, max } = this._get_values();
    this.value = value;
    this.max = max;
    if (this.value >= this.max_recent) {
      this.max_recent = this.value;
      this.max_ts = context.timeref;
    } else if (this.max_recent >= value && context.timeref - this.max_ts > this.recent_delay) {
      this.max_recent -= this.max * (this.decay_pct_speed / 100 * ((context.timedelta ?? 0) / 1e3));
    }
    const pct_value = this.value / this.max;
    const pct_diff = (this.max_recent - value) / this.max;
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
const hud_enemy_damage_selector = ".boss-info .damage";
class EnemyHealthBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    __publicField(this, "damage_el");
    __publicField(this, "last_value", 0);
    __publicField(this, "damage_value_max", 0);
    __publicField(this, "last_value_change_ts", -Infinity);
    __publicField(this, "damage_reset_delay", 2e3);
    this.bar_root_el = get_element(hud_enemy_health_bar_selector, this.hud.hud_root_el);
    this.damage_el = get_element(hud_enemy_damage_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.enemy.health, max: this.game.enemy.max_health };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
      if (this.value != this.last_value) {
        this.last_value_change_ts = context.timeref;
      }
      if (this.value < this.damage_value_max && context.timeref - this.last_value_change_ts < this.damage_reset_delay) {
        const diff = this.damage_value_max - this.value;
        this.damage_el.innerText = diff.toFixed(0);
      } else {
        this.damage_value_max = this.value;
        this.damage_el.innerText = "";
      }
      this.last_value = this.value;
    }
  }
}
const hud_enemy_stamina_bar_selector = ".enemy-bar.bar.stamina";
class EnemyStaminaBar extends HudBar {
  constructor(game2, hud) {
    super(game2, hud);
    __publicField(this, "bar_root_el");
    this.bar_root_el = get_element(hud_enemy_stamina_bar_selector, this.hud.hud_root_el);
  }
  _get_values() {
    return { value: this.game.enemy.stamina, max: this.game.enemy.max_stamina };
  }
  _update(context) {
    if (this.hud.should_show) {
      super._update(context);
      this.bar_root_el.classList.toggle("low-stamina", this.game.enemy.low_stamina);
    }
  }
}
const hud_root_selector = ".hud";
const hud_hidden_class = "hidden";
class Hud extends GameComponent {
  // TODO: debug only
  constructor(game2) {
    super(game2);
    __publicField(this, "hud_root_el");
    __publicField(this, "player_health_bar");
    __publicField(this, "player_stamina_bar");
    __publicField(this, "enemy_health_bar");
    __publicField(this, "enemy_stamina_bar");
    __publicField(this, "show_enemy_stamina_bar", true);
    this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el);
    this.player_health_bar = this.add_component(new PlayerHealthBar(game2, this));
    this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game2, this));
    this.enemy_health_bar = this.add_component(new EnemyHealthBar(game2, this));
    this.enemy_stamina_bar = this.add_component(new EnemyStaminaBar(game2, this));
  }
  get should_show() {
    return this.game.state !== "chill";
  }
  _update(context) {
    this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show);
    this.enemy_stamina_bar.bar_root_el.classList.toggle(hud_hidden_class, !this.show_enemy_stamina_bar);
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
    __publicField(this, "_timeref", 0);
    __publicField(this, "_timescale", 1);
    __publicField(this, "_last_step_ts", null);
    __publicField(this, "game_root_el");
    __publicField(this, "player");
    __publicField(this, "enemy");
    __publicField(this, "characters", []);
    __publicField(this, "hud");
    __publicField(this, "defeat_screen");
    __publicField(this, "victory_screen");
    __publicField(this, "debug_hitboxes", true);
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
  get timeref() {
    return this._timeref;
  }
  get timescale() {
    return this._timescale;
  }
  set timescale(value) {
    this._timescale = value;
    send_shell_request({ type: "setPlaybackRate", value });
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
    const last_timeref = this._timeref;
    if (this._last_step_ts != null) {
      this._timeref += (timestamp - this._last_step_ts) * this.timescale;
    }
    const context = {
      timeref: this._timeref,
      timedelta: this._timeref - last_timeref
    };
    if (this._next_state != null) {
      this._state = this._next_state;
      this._next_state = null;
    }
    this.update(context);
    this._debug_hitboxes();
    this._last_state = this._state;
    this._last_step_ts = timestamp;
  }
  get rect() {
    return this.game_root_el.getBoundingClientRect();
  }
  get_relative_rect(el) {
    const { x: game_x, y: game_y } = this.rect;
    const el_rect = el.getBoundingClientRect();
    return new DOMRect(el_rect.x - game_x, el_rect.y - game_y, el_rect.width, el_rect.height);
  }
  _debug_hitboxes() {
    var _a, _b;
    const svg_id = "hitboxes";
    const svg_els = this.game_root_el.querySelectorAll(`#${svg_id}`);
    for (const el of svg_els) {
      (_a = el.parentNode) == null ? void 0 : _a.removeChild(el);
    }
    if (this.debug_hitboxes) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = svg_id;
      svg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${this.rect.width}px;
                height: ${this.rect.height}px;
                pointer-events: none;
            `;
      this.game_root_el.appendChild(svg);
      for (const character of this.characters) {
        const create_path_from_points = (points) => {
          if (points.length === 0) return null;
          const d_parts = [];
          for (let i = 0; i < points.length; i++) {
            const ptyp = i === 0 ? "M" : "L";
            d_parts.push(`${ptyp} ${points[i].x} ${points[i].y}`);
          }
          d_parts.push("Z");
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d_parts.join(" "));
          return path;
        };
        const hurtbox_path = create_path_from_points(character.hurtbox_abs.points);
        if (hurtbox_path) {
          hurtbox_path.style.fill = "hsla(195, 100%, 50%, 0.4)";
          svg.appendChild(hurtbox_path);
        }
        const direction_vec = character.direction_vector;
        const dir_vector_path = create_path_from_points([
          character.pos,
          { x: character.pos.x + direction_vec.x * 20, y: character.pos.y + direction_vec.y * 20 }
        ]);
        if (dir_vector_path) {
          dir_vector_path.style.stroke = "hsla(0, 100%, 50%, 0.4)";
          dir_vector_path.style.strokeWidth = "2px";
          svg.appendChild(dir_vector_path);
        }
        const attack_hitbox_abs = character.attack_hitbox_abs;
        if (attack_hitbox_abs) {
          const attack_hitbox_bbox = shape_bbox(attack_hitbox_abs);
          let attack_would_hit = false;
          for (const other of this.characters) {
            if (other === character) continue;
            const other_hurtbox_abs = other.hurtbox_abs;
            const other_hurtbox_bbox = shape_bbox(other_hurtbox_abs);
            if (aabb_overlap(other_hurtbox_bbox, attack_hitbox_bbox) && sat_overlap(attack_hitbox_abs, other_hurtbox_abs)) {
              attack_would_hit = true;
              break;
            }
          }
          const current_phase = (_b = character.current_attack) == null ? void 0 : _b.current_phase;
          const phase_color = current_phase === "anticipation" ? "hsl(220, 100%, 55%)" : current_phase === "hit" ? "hsl(0, 100%, 50%)" : current_phase === "recovery" ? "hsl(0, 0%, 40%)" : "hsl(322, 81%, 43%)";
          const attack_hitbox_path = create_path_from_points(attack_hitbox_abs.points);
          if (attack_hitbox_path) {
            attack_hitbox_path.style.fill = phase_color;
            attack_hitbox_path.style.opacity = attack_would_hit ? "0.6" : "0.3";
            svg.appendChild(attack_hitbox_path);
          }
        }
      }
    }
  }
}
let game = null;
function handle_shell_event(event) {
  if (event.type === "adStarted" && game == null) {
    game = new Game();
    {
      const request_animation = () => {
        game == null ? void 0 : game.step(performance.now());
        requestAnimationFrame(request_animation);
      };
      request_animation();
    }
  }
  if (game != null) {
    game.handle_shell_event(event);
  }
}
add_shell_events_listener(handle_shell_event);
