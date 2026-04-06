var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
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
  preload() {
  }
}
class Actor extends GameComponent {
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
function random_pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}
function interpolate(a, b, alpha) {
  return a * (1 - alpha) + b * alpha;
}
function interpolate_point(a, b, alpha) {
  return { x: interpolate(a.x, b.x, alpha), y: interpolate(a.y, b.y, alpha) };
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
function shortest_delta_angle(a, b) {
  a = typeof a === "number" ? a : Math.atan2(a.y, a.x);
  b = typeof b === "number" ? b : Math.atan2(b.y, b.x);
  let delta = b - a;
  delta = delta % (2 * Math.PI);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  else if (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}
function rotate_vector_clamped(vector, target, max_angle_delta) {
  const mag = typeof vector === "number" ? 1 : dist(vector.x, vector.y);
  const angle = typeof vector === "number" ? vector : Math.atan2(vector.y, vector.x);
  if (typeof target === "object" && "x" in target && "y" in target) target = Math.atan2(target.y, target.x);
  let delta = shortest_delta_angle(vector, target);
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
function smooth_ema(v0, v1, sf) {
  return (1 - sf) * v0 + sf * v1;
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
    } else if (typeof this.dir_target === "number") {
      dir_target = this.dir_target;
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
function image_animation_def(image_src, element, { duration, remove, position, size, image_size = "contain", style } = {}, init) {
  function factory(component, params_override, init_override) {
    const params = { ...{ duration, remove, position, size, image_size, style }, ...params_override ?? {} };
    const randid = "img-" + Math.random().toString(36);
    const image_el = document.createElement("div");
    image_el.id = randid;
    image_el.style = `
            position: absolute;
            background-image: url('${image_src}');
            background-size: ${params.image_size};
        `;
    if (params.position) {
      image_el.style.top = `${params.position.y}px`;
      image_el.style.left = `${params.position.x}px`;
    }
    if (params.size) {
      image_el.style.width = `${params.size.x}px`;
      image_el.style.height = `${params.size.y}px`;
    }
    if (params.style) {
      Object.assign(image_el.style, params.style);
    }
    const el = element instanceof HTMLElement ? element : element(component);
    el.appendChild(image_el);
    let sub_update, sub_end = void 0;
    const _init = init_override ?? init;
    if (_init != null) {
      ({ update: sub_update, end: sub_end } = _init(component, image_el));
    }
    const update = sub_update;
    const end = () => {
      if (sub_end != null) sub_end();
      if (params.remove == null || params.remove === true) image_el.remove();
    };
    if (update != null) {
      update(0);
    }
    if (params.duration != null) return { duration: params.duration, update, end };
    else return { update, end };
  }
  factory.image_src = image_src;
  return factory;
}
function multi_animation_def(defs, { duration } = {}, init) {
  const defs_array = Array.isArray(defs) ? defs : [...Object.values(defs)];
  function factory(component, ...rest) {
    let animations;
    if (init != null) {
      animations = init(component, defs);
    } else {
      animations = defs_array.map((def) => def(component, ...rest));
    }
    const update = (progress) => animations.forEach((anim) => {
      if (anim.update) anim.update(progress);
    });
    const end = () => animations.forEach((anim) => {
      if (anim.end) anim.end();
    });
    if (duration != null) return { duration, update, end };
    else return { update, end };
  }
  const image_src_set = new Set(
    defs_array.filter((def) => "image_src" in def).map((img_def) => img_def.image_src).flat()
  );
  if (image_src_set.size > 0) factory.image_src = [...image_src_set.values()];
  return factory;
}
function interpolate_anim_def(start, target, set, { duration, shortest_angle = true, ease_fn } = {}) {
  return (component) => {
    const _start = typeof start === "function" ? start(component) : start;
    const _target = typeof target === "function" ? target(component) : target;
    const update = (progress) => {
      const _progress = ease_fn != null ? ease_fn(progress) : progress;
      const state = {};
      if (_start.position != null && _target.position != null)
        state.position = interpolate_point(_start.position, _target.position, _progress);
      if (_start.rotation != null && _target.rotation != null) {
        if (shortest_angle)
          state.rotation = _start.rotation + _progress * shortest_delta_angle(_start.rotation, _target.rotation);
        else state.rotation = interpolate(_start.rotation, _target.rotation, _progress);
      }
      if (_start.scale != null && _target.scale != null)
        state.scale = interpolate(_start.scale, _target.scale, _progress);
      set(component, state);
    };
    const end = () => set(component, _target);
    if (duration != null) return { duration, update, end };
    else return { update, end };
  };
}
function subs_anim(game2, subs) {
  if (!subs.length) return { duration: 0 };
  const duration = Math.max(...subs.map(([, end_s]) => end_s)) * 1e3;
  const lines = subs.map(([start, end, text]) => {
    const line_el = document.createElement("div");
    line_el.classList.add("sub-line");
    line_el.textContent = text;
    return [start, end, line_el];
  });
  return {
    duration,
    update: (progress) => {
      const reltime = progress * duration;
      for (const [start_s, end_s, line_el] of lines) {
        if (reltime < start_s * 1e3) continue;
        const in_dom = game2.subs_root_el.contains(line_el);
        if (reltime < end_s * 1e3) {
          if (!in_dom) game2.subs_root_el.appendChild(line_el);
        } else {
          if (in_dom) line_el.remove();
        }
      }
    },
    end: () => {
      for (const [, , line_el] of lines) {
        line_el.remove();
      }
    }
  };
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
const hud_equipped_selector = ".equipped";
const hud_equip_slot_amount_el_class = "amount";
class EquippedItemsHud extends GameComponent {
  constructor(game2, hud) {
    super(game2);
    __publicField(this, "hud");
    __publicField(this, "equip_root_el");
    __publicField(this, "slots_elements");
    __publicField(this, "slots_items", {
      bottom: "flask",
      right: "sword",
      left: "shield"
    });
    this.hud = hud;
    this.equip_root_el = get_element(hud_equipped_selector, this.hud.hud_root_el);
    const slots_elements = this.equip_root_el.querySelectorAll(".slot");
    const slots_elements_map = {};
    for (const slot of slots_elements) {
      const slot_name = slot.dataset.slot;
      if (!slot_name) continue;
      slots_elements_map[slot_name] = slot;
      slot.addEventListener("click", () => this._use_slot_item(slot));
    }
    this.slots_elements = slots_elements_map;
  }
  _use_slot_item(slot) {
    const item_name = slot.dataset.item;
    if (!item_name) return;
    this.game.player.use_item(item_name);
  }
  _update(context) {
    for (const [slot_name, slot] of Object.entries(this.slots_elements)) {
      const item_name = this.slots_items[slot_name];
      const item = this.game.player.items[item_name];
      if (!item_name || !item) {
        slot.replaceChildren();
        slot.dataset.item = void 0;
        continue;
      }
      if (slot.dataset.item != item_name) {
        slot.replaceChildren();
        slot.dataset.item = item_name;
        const icon_img = document.createElement("img");
        icon_img.classList.add("item");
        icon_img.src = item.icon_src;
        slot.appendChild(icon_img);
        if (item.consumable) {
          const amount_el = document.createElement("div");
          amount_el.classList.add(hud_equip_slot_amount_el_class);
          slot.appendChild(amount_el);
        }
      }
      if (item.consumable) {
        const amount_el = get_element(`.${hud_equip_slot_amount_el_class}`, slot);
        amount_el.textContent = item.owned.toFixed(0);
      }
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
    __publicField(this, "enemy_stamina_bar");
    __publicField(this, "equipped_items");
    this.hud_root_el = get_element(hud_root_selector, this.game.game_root_el);
    this.player_health_bar = this.add_component(new PlayerHealthBar(game2, this));
    this.player_stamina_bar = this.add_component(new PlayerStaminaBar(game2, this));
    this.enemy_health_bar = this.add_component(new EnemyHealthBar(game2, this));
    this.enemy_stamina_bar = this.add_component(new EnemyStaminaBar(game2, this));
    this.equipped_items = this.add_component(new EquippedItemsHud(game2, this));
  }
  get should_show() {
    return this.game.state !== "chill";
  }
  _update(context) {
    this.hud_root_el.classList.toggle(hud_hidden_class, !this.should_show);
    this.enemy_stamina_bar.bar_root_el.classList.toggle(
      hud_hidden_class,
      !(this.game.debug_mode && this.game.debug_enemy_stamina)
    );
  }
}
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
function attack_image_animation_def(image_src, params, init) {
  const image_factory = image_animation_def(image_src, (character) => character.root_el);
  const factory = (character, attack, phase) => {
    const uniform_scale = (character.width + character.height) / 2;
    return image_factory(
      character,
      {
        ...{
          position: { x: 0, y: 0 },
          size: { x: uniform_scale, y: uniform_scale }
        },
        ...params ?? {}
      },
      (character2, image_el) => init != null ? init(character2, attack, image_el) : {}
    );
  };
  factory.image_src = image_factory.image_src;
  return factory;
}
function attack_swing_animation_def(image_src, {
  base_color,
  ref_angle_deg = 0,
  swing_angle_deg = 30,
  swing_ease_fn
}, params) {
  return attack_image_animation_def(
    image_src,
    { ...{ style: { mixBlendMode: "plus-lighter", ...(params == null ? void 0 : params.style) ?? {} } }, ...params ?? {} },
    (character, attack, image_el) => {
      const rotation_base_deg = (character.direction - attack.hitbox.rotation_ref) * 180 / Math.PI;
      const update = (progress) => {
        const _progress = typeof swing_ease_fn === "function" ? swing_ease_fn(progress) : progress ** 0.25;
        const rotation_offset_deg = -ref_angle_deg - swing_angle_deg * _progress;
        image_el.style.transform = `
                    scale(${attack.scale})
                    rotate(${rotation_base_deg + rotation_offset_deg}deg)
                `;
        const overblend = 1 - progress;
        image_el.style.filter = `
                    drop-shadow(0 0 0 rgba(${base_color[0]}, ${base_color[1]}, ${base_color[2]}, ${overblend}))
                    drop-shadow(0 0 0 rgba(${base_color[0]}, ${base_color[1]}, ${base_color[2]}, ${overblend}))
                `;
        image_el.style.opacity = ((1 - progress) ** 0.125).toString();
      };
      return { update };
    }
  );
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
    __publicField(this, "invicible", false);
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
    __publicField(this, "parry_stamina_consume", 30);
    __publicField(this, "parry_enemy_stamina_consume_factor", 0.1);
    __publicField(this, "animations", {});
    __publicField(this, "sounds", {});
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      {
        acceleration: this.base_acceleration,
        max_vel: this.base_max_vel,
        slowing_distance: 25,
        vel_max_rotation: 20 * 360 / 180 * Math.PI,
        dir_max_rotation: 2 * 360 / 180 * Math.PI
      }
    );
  }
  preload() {
    super.preload();
    for (const attack_def of Object.values(this.attacks_defs)) {
      this.game.preload_sounds(...attack_def.hit_sound ?? []);
      for (const attack_phase_def of Object.values(attack_def.phases)) {
        if (attack_phase_def.animation && "image_src" in attack_phase_def.animation) {
          const images = attack_phase_def.animation.image_src;
          this.game.preload_images(...typeof images === "string" ? [images] : images);
        }
        this.game.preload_sounds(...attack_phase_def.sound ?? []);
      }
    }
    for (const animation of Object.values(this.animations)) {
      if (animation && "image_src" in animation) {
        const images = animation.image_src;
        this.game.preload_images(...typeof images === "string" ? [images] : images);
      }
    }
    for (const sound of Object.values(this.sounds)) {
      this.game.preload_sounds(...sound ?? []);
    }
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
  get velocity() {
    return this._follower.velocity;
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
    origin_ref,
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
    if (origin_ref) shape = transform_shape(shape, { translate: origin_ref });
    return shape;
  }
  get hurtbox() {
    return this._transform_shape(this.hurtbox_def.shape, {
      origin_ref: this.hurtbox_def.origin_ref,
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
      origin_ref: this.current_attack.hitbox.origin_ref,
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
        this._attack_phase_start(this.current_attack, ATTACK_PHASES_SEQUENCE[0], { context });
        this.consume_stamina(this.current_attack.stamina_consume * this.attack_stamina_consume_multiplier, {
          context
        });
        this.last_attack_hits = [];
        this._attack_start(this.current_attack, { context });
      }
    }
    if (this.current_attack) {
      const current_phase = this.current_attack.phases[this.current_attack.current_phase];
      if (current_phase.start_ts == null) current_phase.start_ts = context.timeref;
      const phase_end_ts = current_phase.start_ts + current_phase.duration;
      if (context.timeref <= phase_end_ts)
        this._attack_phase_update(this.current_attack, current_phase, { context });
      if (context.timeref >= phase_end_ts) {
        this._attack_phase_end(this.current_attack, current_phase, { context });
        const phase_idx = ATTACK_PHASES_SEQUENCE.indexOf(this.current_attack.current_phase);
        if (phase_idx + 1 < ATTACK_PHASES_SEQUENCE.length) {
          const next_phase_name = ATTACK_PHASES_SEQUENCE[phase_idx + 1];
          this.current_attack.current_phase = next_phase_name;
          this._attack_phase_start(this.current_attack, next_phase_name, { context });
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
  _attack_phase_start(attack, phase_name, { context }) {
    const phase = attack.phases[phase_name];
    phase.start_ts = context.timeref;
    if (phase.animation != null) {
      phase.animation_handle = phase.animation(this, attack, phase);
    }
    this.game.pick_and_play_sound_effect(phase.sound);
  }
  _attack_phase_update(attack, phase, { context }) {
    var _a;
    if (phase.start_ts == null) phase.start_ts = context.timeref;
    const progress = (context.timeref - phase.start_ts) / phase.duration;
    if (((_a = phase.animation_handle) == null ? void 0 : _a.update) != null) phase.animation_handle.update(Math.max(0, Math.min(progress, 1)));
  }
  _attack_phase_end(attack, phase, { context }) {
    var _a;
    if (((_a = phase.animation_handle) == null ? void 0 : _a.end) != null) phase.animation_handle.end();
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
          const stamina_break = attacking_character.stamina < attacking_character.low_stamina_enter_threshold;
          const break_sound = attacking_character.sounds.break;
          if (stamina_break && (break_sound == null ? void 0 : break_sound.length)) {
            this.game.pick_and_play_sound_effect(break_sound);
          } else {
            this.game.pick_and_play_sound_effect(this.sounds.parry);
          }
          return true;
        }
      }
    }
    let health_damage = attack.damage;
    if (this.defending && !this.low_stamina) {
      const stamina_consume = attack.damage * this.defend_stamina_consume_factor;
      this.consume_stamina(stamina_consume, { context });
      health_damage *= 1 - this.defend_damage_reduction;
      this.game.pick_and_play_sound_effect(this.sounds.defend);
    }
    if (!this.invicible && health_damage >= 0) {
      this.health -= health_damage;
      this.last_damage_ts = context.timeref;
      if (this.health <= 0) {
        this.health = 0;
        this.game.pick_and_play_sound_effect(this.sounds.death);
      } else {
        this.game.pick_and_play_sound_effect(this.sounds.damage);
      }
      this.game.pick_and_play_sound_effect(attack.hit_sound);
    }
    return true;
  }
  attack_parry({
    attack,
    attacking_character,
    context
  }) {
    attacking_character.consume_stamina(attack.damage * this.parry_enemy_stamina_consume_factor, { context });
    this.consume_stamina(this.parry_stamina_consume, { context });
    return true;
  }
}
const FlaskIcon = "" + new URL("assets/flask.webp", import.meta.url).href;
const AttackSwing$1 = "" + new URL("assets/attack-swing.png", import.meta.url).href;
const ShieldIcon = "" + new URL("assets/shield.webp", import.meta.url).href;
const PlayerAttackHitSound1 = "" + new URL("assets/442903.opus", import.meta.url).href;
const PlayerAttackHitSound2 = "" + new URL("assets/547042.opus", import.meta.url).href;
const PlayerAttackHitSound3 = "" + new URL("assets/574820.opus", import.meta.url).href;
const PlayerAttackHitSound4 = "" + new URL("assets/574821.opus", import.meta.url).href;
const PlayerAttackSound1 = "" + new URL("assets/268227.opus", import.meta.url).href;
const PlayerAttackSound2 = "" + new URL("assets/724716.opus", import.meta.url).href;
const PlayerCureSound = "" + new URL("assets/er-cure.opus", import.meta.url).href;
const PlayerDamageSound1 = "" + new URL("assets/488225.opus", import.meta.url).href;
const PlayerDamageSound2 = "" + new URL("assets/629664.opus", import.meta.url).href;
const PlayerDeathSound = "" + new URL("assets/398068.opus", import.meta.url).href;
const PlayerDefendSound1 = "" + new URL("assets/364530.opus", import.meta.url).href;
const PlayerDefendSound2 = "" + new URL("assets/442769.opus", import.meta.url).href;
const PlayerDefendSound3 = "" + new URL("assets/574043.opus", import.meta.url).href;
const PlayerParrySound = "" + new URL("assets/er-parry.opus", import.meta.url).href;
const SwordIcon = "" + new URL("assets/sword.svg", import.meta.url).href;
const player_root_selector = ".player";
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
    __publicField(this, "stamina_movement_consume_factor", 5);
    __publicField(this, "stamina_movement_vel_min", 60);
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
          anticipation: {
            duration: 0,
            acceleration: 20,
            sound: [PlayerAttackSound1, PlayerAttackSound2]
          },
          hit: {
            duration: 150,
            acceleration: 1,
            animation: attack_swing_animation_def(AttackSwing$1, {
              base_color: [255, 255, 255],
              ref_angle_deg: -30,
              swing_angle_deg: 45
            })
          },
          recovery: { duration: 100, acceleration: 50 }
        },
        damage: 213,
        stamina_consume: 20,
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
        },
        hit_sound: [PlayerAttackHitSound1, PlayerAttackHitSound2, PlayerAttackHitSound3, PlayerAttackHitSound4]
      }
    });
    __publicField(this, "items", {
      flask: { name: "flask", icon_src: FlaskIcon, owned: 3, consumable: true },
      shield: { name: "shield", icon_src: ShieldIcon, consumable: false },
      sword: { name: "sword", icon_src: SwordIcon, consumable: false }
    });
    __publicField(this, "flask_health_recover_pct", 0.65);
    __publicField(this, "sounds", {
      defend: [PlayerDefendSound1, PlayerDefendSound2, PlayerDefendSound3],
      parry: [PlayerParrySound],
      damage: [PlayerDamageSound1, PlayerDamageSound2],
      death: [PlayerDeathSound],
      cure: [PlayerCureSound]
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
  get root_el() {
    return this.player_root_el;
  }
  _on_mousemove(event) {
    const rect = this.game.game_root_el.getBoundingClientRect();
    this.pos_target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  _on_mousedown(event) {
    if (this.game.state === "battle") {
      if (event.button === 0) {
        this.attack_requested = true;
      } else if (event.button === 2) {
        this.defend_request_ts = this.game.timeref;
        this.defend_requested = true;
      }
    }
  }
  _on_mouseup(event) {
    if (this.game.state === "battle") {
      if (event.button === 2) {
        this.defend_request_ts = this.game.timeref;
        this.defend_requested = false;
      }
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
    }
    return do_parry;
  }
  use_item(item_name) {
    const item = this.items[item_name];
    if (!item) console.warn(`Player has no item "${item_name}"`);
    if (!this.dead && (!item.consumable || item.owned > 0)) {
      if (item.name === "flask") {
        this.health += this.max_health * this.flask_health_recover_pct;
        if (this.health > this.max_health) {
          this.health = this.max_health;
        }
        this.game.pick_and_play_sound_effect(this.sounds.cure);
      }
      if (item.consumable) {
        item.owned -= 1;
      }
    }
  }
}
const AttackSwing = "" + new URL("assets/attack-swing2.png", import.meta.url).href;
const VineLongImage1 = "" + new URL("assets/vine_long1.png", import.meta.url).href;
const VineLongImage2 = "" + new URL("assets/vine_long2.png", import.meta.url).href;
const VineShortImage1 = "" + new URL("assets/vine_short1.png", import.meta.url).href;
const VineShortImage2 = "" + new URL("assets/vine_short2.png", import.meta.url).href;
const EnemyAttackHitSound1 = "" + new URL("assets/420674.opus", import.meta.url).href;
const EnemyAttackHitSound2 = "" + new URL("assets/474575.opus", import.meta.url).href;
const EnemyAttackHitSound3 = "" + new URL("assets/536258.opus", import.meta.url).href;
const EnemyAttackFastSound1 = "" + new URL("assets/380488_fast1.opus", import.meta.url).href;
const EnemyAttackFastSound2 = "" + new URL("assets/380488_fast2.opus", import.meta.url).href;
const EnemyAttackFastSound3 = "" + new URL("assets/380488_fast3.opus", import.meta.url).href;
const EnemyAttackFastSound4 = "" + new URL("assets/380488_fast4.opus", import.meta.url).href;
const EnemyAttackFastSound5 = "" + new URL("assets/380488_fast5.opus", import.meta.url).href;
const EnemyAttackSlowSound1 = "" + new URL("assets/380488_slow1.opus", import.meta.url).href;
const EnemyAttackSlowSound2 = "" + new URL("assets/380488_slow2.opus", import.meta.url).href;
const EnemyAttackSlowSound3 = "" + new URL("assets/542017_slow3.opus", import.meta.url).href;
const EnemyBreakSound = "" + new URL("assets/er-break.opus", import.meta.url).href;
const EnemyDamageSound1 = "" + new URL("assets/404109.opus", import.meta.url).href;
const EnemyDamageSound2 = "" + new URL("assets/515624.opus", import.meta.url).href;
const EnemyDamageSound3 = "" + new URL("assets/770124_1.opus", import.meta.url).href;
const EnemyDamageSound4 = "" + new URL("assets/770124_2.opus", import.meta.url).href;
const EnemyDamageSound5 = "" + new URL("assets/770124_3.opus", import.meta.url).href;
const EnemyDamageSound6 = "" + new URL("assets/770124_4.opus", import.meta.url).href;
const EnemyDamageSound7 = "" + new URL("assets/770124_5.opus", import.meta.url).href;
const EnemyDamageSound8 = "" + new URL("assets/770124_6.opus", import.meta.url).href;
const EnemyDamageSound9 = "" + new URL("assets/770124_7.opus", import.meta.url).href;
const EnemyDeathSound = "" + new URL("assets/369005.opus", import.meta.url).href;
const enemy_weapon_selector = ".weapon";
const _EnemyWeapon = class _EnemyWeapon extends GameComponent {
  constructor(game2, enemy) {
    super(game2);
    __publicField(this, "enemy");
    __publicField(this, "weapon_el");
    __publicField(this, "follower");
    __publicField(this, "base_offset", { x: 0, y: 24 });
    __publicField(this, "base_rotation", -150 / 180 * Math.PI);
    __publicField(this, "rotation_ref", -135 / 180 * Math.PI);
    __publicField(this, "velocity_drift_factor", 3);
    this.enemy = enemy;
    this.weapon_el = get_element(enemy_weapon_selector, enemy.enemy_root_el);
    this.follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      {
        acceleration: 200,
        slowing_distance: 10,
        dir_max_rotation: 20 * 360 / 180 * Math.PI
      }
    );
  }
  _update(context) {
    if (this.enemy.current_attack == null) {
      if (this.enemy.low_stamina) this.base_rotation = -190 / 180 * Math.PI;
    }
    const offset = {
      x: this.base_offset.x - this.enemy.velocity.x * this.velocity_drift_factor,
      y: this.base_offset.y - this.enemy.velocity.y * this.velocity_drift_factor
    };
    const rotation = this.base_rotation - this.rotation_ref + Math.max(-30, Math.min(-this.enemy.velocity.x * 1.5, 30)) / 180 * Math.PI;
    this.follower.pos_target = offset;
    this.follower.dir_target = rotation;
    if (context.timedelta) this.follower.update(context.timedelta);
    this.weapon_el.style.transform = `
            translate(calc(${this.follower.pos.x}px - 50%), calc(${this.follower.pos.y}px - 50%))
            rotate(${this.follower.direction * 180 / Math.PI}deg)
        `;
  }
};
__publicField(_EnemyWeapon, "initial_offset", { x: 0, y: 24 });
__publicField(_EnemyWeapon, "initial_rotation", -150 / 180 * Math.PI);
__publicField(_EnemyWeapon, "animation_base_def", ({
  position,
  rotation,
  params
}) => interpolate_anim_def(
  (enemy) => ({ position: enemy.weapon.base_offset, rotation: enemy.weapon.base_rotation }),
  (enemy) => ({
    position: typeof position === "function" ? position(enemy) : position,
    rotation: typeof rotation === "function" ? rotation(enemy) : rotation
  }),
  (enemy, state) => {
    enemy.weapon.base_offset = state.position;
    enemy.weapon.base_rotation = state.rotation;
  },
  params
));
__publicField(_EnemyWeapon, "animations", {
  swing_fast_anticipation: _EnemyWeapon.animation_base_def({
    position: { x: -24, y: -16 },
    rotation: (enemy) => {
      var _a, _b;
      return -90 / 180 * Math.PI + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    }
  }),
  swing_fast_hit: _EnemyWeapon.animation_base_def({
    position: { x: 24, y: 0 },
    rotation: (enemy) => {
      var _a, _b;
      return -355 / 180 * Math.PI + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    },
    params: { shortest_angle: false, ease_fn: (progress) => progress ** 0.5 }
  }),
  swing_slow_anticipation: _EnemyWeapon.animation_base_def({
    position: { x: -32, y: -24 },
    rotation: (enemy) => {
      var _a, _b;
      return -60 / 180 * Math.PI + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    }
  }),
  swing_slow_hit: _EnemyWeapon.animation_base_def({
    position: { x: 24, y: 0 },
    rotation: (enemy) => {
      var _a, _b;
      return -355 / 180 * Math.PI + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    },
    params: { shortest_angle: false, ease_fn: (progress) => progress ** 0.5 }
  }),
  swing_recover: _EnemyWeapon.animation_base_def({
    position: _EnemyWeapon.initial_offset,
    rotation: _EnemyWeapon.initial_rotation
  })
});
let EnemyWeapon = _EnemyWeapon;
const enemy_root_selector = ".enemy";
const skip_btn_selector = ".skip-btn";
const vines_root_selector = ".vines";
class Enemy extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "enemy_root_el");
    __publicField(this, "skip_btn_el");
    __publicField(this, "vines_root_el");
    __publicField(this, "weapon");
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "base_acceleration", 10);
    __publicField(this, "base_max_vel", 2);
    __publicField(this, "health", 1e4);
    __publicField(this, "max_health", 1e4);
    __publicField(this, "hurtbox_def", { shape: { x: -1, y: -1, width: 2, height: 2 }, rotation_ref: 0 });
    __publicField(this, "max_stamina", 150);
    // TODO: sanity check
    __publicField(this, "stamina_recover", 25);
    __publicField(this, "stamina_recover_delay", 2e3);
    __publicField(this, "low_stamina_max_vel", 0);
    __publicField(this, "low_stamina_enter_threshold", 1);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", 150);
    // TODO: sanity check
    __publicField(this, "attacks_defs", {
      slow: {
        phases: {
          anticipation: {
            duration: 300,
            acceleration: 100,
            max_vel: 100,
            animation: EnemyWeapon.animations.swing_slow_anticipation
          },
          hit: {
            duration: 200,
            acceleration: 5,
            max_vel: 2,
            sound: [EnemyAttackSlowSound1, EnemyAttackSlowSound2, EnemyAttackSlowSound3],
            animation: multi_animation_def([
              EnemyWeapon.animations.swing_slow_hit,
              attack_swing_animation_def(
                AttackSwing,
                { base_color: [255, 227, 85], ref_angle_deg: -210, swing_angle_deg: 50 },
                {
                  style: { backgroundRepeat: "no-repeat", backgroundPosition: "center" }
                }
              )
            ])
          },
          recovery: {
            duration: 500,
            acceleration: 20,
            max_vel: 4,
            animation: EnemyWeapon.animations.swing_recover
          }
        },
        damage: 500,
        stamina_consume: 6,
        parry_window_duration: 100,
        scale: 3.5,
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
          origin_ref: { x: 0, y: 24 },
          rotation_ref: -90 / 180 * Math.PI
        },
        hit_sound: [EnemyAttackHitSound1, EnemyAttackHitSound2, EnemyAttackHitSound3]
      },
      fast: {
        phases: {
          anticipation: {
            duration: 150,
            acceleration: 100,
            max_vel: 100,
            animation: EnemyWeapon.animations.swing_fast_anticipation
          },
          hit: {
            duration: 200,
            acceleration: 5,
            max_vel: 2,
            sound: [
              EnemyAttackFastSound1,
              EnemyAttackFastSound2,
              EnemyAttackFastSound3,
              EnemyAttackFastSound4,
              EnemyAttackFastSound5
            ],
            animation: multi_animation_def([
              EnemyWeapon.animations.swing_fast_hit,
              attack_swing_animation_def(
                AttackSwing,
                { base_color: [255, 227, 85], ref_angle_deg: -210, swing_angle_deg: 60 },
                {
                  style: { backgroundRepeat: "no-repeat", backgroundPosition: "center" }
                }
              )
            ])
          },
          recovery: {
            duration: 250,
            acceleration: 20,
            max_vel: 4,
            animation: EnemyWeapon.animations.swing_recover
          }
        },
        damage: 250,
        stamina_consume: 3,
        parry_window_duration: 100,
        scale: 3.5,
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
          origin_ref: { x: 0, y: 24 },
          rotation_ref: -90 / 180 * Math.PI
        },
        hit_sound: [EnemyAttackHitSound1, EnemyAttackHitSound2, EnemyAttackHitSound3]
      }
    });
    __publicField(this, "attacks_chains_defs", {
      fast_flurry: ["fast", "fast", "fast"],
      fast_slow_flurry: ["fast", "fast", "slow"],
      slow_fast_duplet: ["slow", "fast"]
    });
    __publicField(this, "current_attack_chain", null);
    // TODO: aggro: number = 0.0
    // TODO: AI
    __publicField(this, "_phase", "rest");
    __publicField(this, "phases_ts", {});
    __publicField(this, "follow_dist_offset", 30);
    __publicField(this, "next_attack_ts", 1e10);
    __publicField(this, "auto_attack_dist", 400);
    __publicField(this, "auto_attack_interval", [1500, 3e3]);
    __publicField(this, "animations", {
      grow_vines: multi_animation_def(
        {
          long1: image_animation_def(VineLongImage1, (enemy) => enemy.vines_root_el, { remove: false }),
          long2: image_animation_def(VineLongImage2, (enemy) => enemy.vines_root_el, { remove: false }),
          short1: image_animation_def(VineShortImage1, (enemy) => enemy.vines_root_el, { remove: false }),
          short2: image_animation_def(VineShortImage2, (enemy) => enemy.vines_root_el, { remove: false })
        },
        {},
        (enemy, defs) => {
          const avg_dist = 14;
          const rand_jitter = 5;
          const size_rand = [1, 2];
          const rot_rand = 10;
          const btn_rect = enemy.skip_btn_el.getBoundingClientRect();
          const handles = [];
          const axes = [
            ["width", "left", ["top", "0%"], [defs.short1, defs.short2], 48],
            ["width", "left", ["top", "100%"], [defs.short1, defs.short2], 48],
            ["height", "top", ["left", "0%"], [defs.long1, defs.long2], 48],
            ["height", "top", ["left", "100%"], [defs.long1, defs.long2], 48]
          ];
          axes.forEach(([dim, mov_side, [fix_side, fix_pos], anim_pool, size_ref]) => {
            let pos = (avg_dist + (2 * Math.random() - 1) * rand_jitter) / 2;
            while (pos < btn_rect[dim]) {
              const vine_def = random_pick(anim_pool);
              const size = size_ref * (size_rand[0] + Math.random() * (size_rand[1] - size_rand[0]));
              const handle = vine_def(enemy, { size: { x: size, y: size } }, (_, image_el) => {
                const rotation_offset_deg = 180 + (2 * Math.random() - 1) * rot_rand;
                image_el.style[fix_side] = fix_pos;
                image_el.style[mov_side] = `${pos}px`;
                image_el.style.filter = "drop-shadow(0 0 2px black)";
                return {
                  update: (progress) => {
                    const rotation_deg = Math.atan2(
                      image_el.offsetTop - btn_rect.height / 2,
                      image_el.offsetLeft - btn_rect.width / 2
                    ) * 180 / Math.PI + rotation_offset_deg;
                    image_el.style.transform = `
                                        translate(-50%, -50%)
                                        rotate(${rotation_deg}deg)
                                        scale(${progress})
                                    `;
                  }
                };
              });
              handles.push(handle);
              pos += avg_dist + (2 * Math.random() - 1) * rand_jitter;
            }
          });
          return handles;
        }
      )
    });
    __publicField(this, "sounds", {
      damage: [
        EnemyDamageSound1,
        EnemyDamageSound2,
        EnemyDamageSound3,
        EnemyDamageSound4,
        EnemyDamageSound5,
        EnemyDamageSound6,
        EnemyDamageSound7,
        EnemyDamageSound8,
        EnemyDamageSound9
      ],
      break: [EnemyBreakSound],
      death: [EnemyDeathSound]
    });
    __publicField(this, "intro_speech_subs", [
      [0, 5, "Thou darest ravage my hallowed slumber!"],
      [5, 9.5, "Such divine display rabidly spurn'd..."],
      [9.5, 13.5, "Oblivion awaits thy gaze!"]
    ]);
    this.enemy_root_el = get_element(enemy_root_selector, this.game.game_root_el);
    this.skip_btn_el = get_element(skip_btn_selector, this.enemy_root_el);
    this.vines_root_el = get_element(vines_root_selector, this.enemy_root_el);
    this.weapon = this.add_component(new EnemyWeapon(this.game, this));
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
  get root_el() {
    return this.enemy_root_el;
  }
  get phase() {
    return this._phase;
  }
  set phase(value) {
    this._phase = value;
    this.phases_ts[value] = this.game.timeref;
  }
  get display_pos() {
    const rel_rect = this.game.get_relative_rect(this.enemy_root_el);
    return { x: rel_rect.x + rel_rect.width / 2, y: rel_rect.y + rel_rect.height / 2 };
  }
  _update(context) {
    var _a;
    if (this.game.state === "battle") {
      if (this.phase === "rest") {
        this.phase = "fight-start";
      }
      if (this.phase === "fight") {
        if (!this.attacking) {
          this.pos_target = this._get_reach_player_point();
          this.dir_target = { ...this.game.player.pos };
        }
      }
    }
    this.low_stamina;
    super._update(context);
    if (this.game.state === "battle") {
      if (this.phase === "fight-start") {
        this.invicible = true;
        this.base_max_vel = 1;
        if (this.game.changed_state) {
          this.game.play_animation(this.animations.grow_vines(this), 3e3);
          this.game.play_animation(subs_anim(this.game, this.intro_speech_subs));
          this.game.play_animation({ end: () => this.weapon.weapon_el.classList.remove("hidden") }, 5e3);
        }
        if (context.timeref - (this.phases_ts[this.phase] ?? context.timeref) > 1e4) {
          this.phase = "fight";
          this.invicible = false;
          this.base_max_vel = Enemy.prototype.base_max_vel;
        }
      } else if (this.phase === "fight") {
        const player_dist = dist(this.pos.x - this.game.player.pos.x, this.pos.y - this.game.player.pos.y);
        if (this.can_attack && (this.current_attack_chain || context.timeref > this.next_attack_ts && player_dist <= this.auto_attack_dist)) {
          this.attack_requested = true;
        } else if (!this.attacking && !this.can_attack) {
          if (this.current_attack_chain != null) this.current_attack_chain = null;
        }
        if (this.dead) {
          this.game.change_state_soon("victory");
        }
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
    if (this.current_attack_chain == null || this.current_attack_chain.index >= this.current_attack_chain.def.length - 1) {
      const chain_def = random_pick(Object.values(this.attacks_chains_defs));
      this.current_attack_chain = { def: chain_def, index: 0 };
    } else {
      this.current_attack_chain.index += 1;
    }
    const next_attack = this.current_attack_chain.def[this.current_attack_chain.index];
    return this.attacks_defs[next_attack];
  }
  _attack_start(attack, { context }) {
    super._attack_start(attack, { context });
    this.enemy_root_el.style.setProperty("--attack-scale", attack.scale.toString());
  }
  _attack_end(attack, { context }) {
    super._attack_end(attack, { context });
    if (this.current_attack_chain != null && this.current_attack_chain.index >= this.current_attack_chain.def.length - 1)
      this.current_attack_chain = null;
    this.next_attack_ts = this.calc_next_attack_ts(context.timeref);
  }
  calc_next_attack_ts(now_ts) {
    return now_ts + this.auto_attack_interval[0] + Math.random() * (this.auto_attack_interval[1] - this.auto_attack_interval[0]);
  }
  _aggro_trigger() {
    if (this.game.state === "chill") {
      this.game.change_state_soon("battle");
      this.phase = "fight-start";
      const game_rect = this.game.rect;
      this.pos_target = { x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2 };
      this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref);
    }
  }
}
const BattleDefeatSound = "" + new URL("assets/er-death.opus", import.meta.url).href;
const BattleMusicIntroSound = "" + new URL("assets/cinema-blockbuster-trailer-21-by-ende-intro.opus", import.meta.url).href;
const BattleMusicSound = "" + new URL("assets/cinema-blockbuster-trailer-21-by-ende-loop1.opus", import.meta.url).href;
const BattleVictorySound = "" + new URL("assets/er-victory.opus", import.meta.url).href;
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
const subs_root_selector = ".subs";
class Game extends Component {
  constructor() {
    super();
    __publicField(this, "_state", "chill");
    __publicField(this, "_last_state", "chill");
    __publicField(this, "_next_state", null);
    __publicField(this, "_timeref", 0);
    __publicField(this, "_timescale", 1);
    __publicField(this, "_last_step_ts", null);
    __publicField(this, "_video_playback_rate_base", 1);
    __publicField(this, "game_root_el");
    __publicField(this, "animations", {});
    __publicField(this, "sound_effects", {});
    __publicField(this, "player");
    __publicField(this, "enemy");
    __publicField(this, "characters", []);
    __publicField(this, "hud");
    __publicField(this, "defeat_screen");
    __publicField(this, "victory_screen");
    __publicField(this, "subs_root_el");
    __publicField(this, "debug_mode", false);
    __publicField(this, "debug_enemy_stamina", true);
    __publicField(this, "debug_hitboxes", true);
    __publicField(this, "debug_noreload", true);
    __publicField(this, "sounds", {
      battle_music_intro: [BattleMusicIntroSound],
      battle_music: [BattleMusicSound],
      battle_defeat: [BattleDefeatSound],
      battle_victory: [BattleVictorySound]
    });
    __publicField(this, "battle_music_audio", null);
    this.game_root_el = get_element(game_root_selector);
    this.game_root_el.classList.toggle("hidden", false);
    this.player = this.add_character(this.add_component(new Player(this)));
    this.enemy = this.add_character(this.add_component(new Enemy(this)));
    this.hud = this.add_component(new Hud(this));
    this.defeat_screen = this.add_component(new DefeatScreen(this));
    this.victory_screen = this.add_component(new VictoryScreen(this));
    this.subs_root_el = get_element(subs_root_selector, this.game_root_el);
    this.preload();
  }
  preload() {
    for (const sound of Object.values(this.sounds)) {
      this.preload_sounds(...sound ?? []);
    }
    for (const component of this._children) {
      if (component instanceof GameComponent) {
        component.preload();
      }
    }
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
    this._update_video_playback_rate();
  }
  get video_playback_rate_base() {
    return this._video_playback_rate_base;
  }
  set video_playback_rate_base(value) {
    this._video_playback_rate_base = value;
    this._update_video_playback_rate();
  }
  _update_video_playback_rate() {
    send_shell_request({ type: "setPlaybackRate", value: this._timescale * this._video_playback_rate_base });
  }
  handle_shell_event(event) {
    if (!event || typeof event !== "object" || !("type" in event)) {
      console.warn("Received unknown event object", event);
      return;
    }
    if (event.type === "adFinished") {
      send_shell_request({ type: "seekTo", value: 0 });
      send_shell_request({ type: "play" });
    }
  }
  _update(context) {
    this.game_root_el.classList.toggle("hide-mouse", this.state !== "chill");
    if (this.changed_state) {
      if (this.state === "battle") {
        send_shell_request({ type: "setVideoFilter", value: "blur(3px) brightness(0.75)" });
        send_shell_request({ type: "setVolume", value: 0.5 });
        this.battle_music_audio = this.pick_and_play_sound_effect(this.sounds.battle_music_intro);
        if (this.battle_music_audio) {
          this.battle_music_audio.addEventListener("ended", () => {
            if (this.state === "battle")
              this.battle_music_audio = this.pick_and_play_sound_effect(this.sounds.battle_music);
          });
        }
      } else if (this.state === "defeat") {
        this.pick_and_play_sound_effect(this.sounds.battle_defeat);
        if (!(this.debug_mode && this.debug_noreload))
          setTimeout(() => send_shell_request({ type: "fail" }), 8e3);
        if (this.battle_music_audio) fade_audio(this.battle_music_audio, { duration: 3e3, volume: 0 });
      } else if (this.state === "victory") {
        this.pick_and_play_sound_effect(this.sounds.battle_victory);
        if (!(this.debug_mode && this.debug_noreload))
          setTimeout(() => send_shell_request({ type: "success" }), 8e3);
        if (this.battle_music_audio) fade_audio(this.battle_music_audio, { duration: 3e3, volume: 0 });
      }
    }
    if (["defeat", "victory"].includes(this.state)) {
      this.video_playback_rate_base = smooth_ema(
        this.video_playback_rate_base,
        0.1,
        0.5 * (context.timedelta ?? 0) / 1e3
      );
    }
    this._update_animations(context);
  }
  play_animation(handle, duration) {
    if ("duration" in handle) duration = handle.duration;
    if (duration == null) throw new Error("Cannot play animation without duration!");
    const id = Math.random().toString(36);
    this.animations[id] = { start_ts: this.timeref, duration, handle };
  }
  _update_animations(context) {
    for (const [id, anim_info] of [...Object.entries(this.animations)]) {
      const progress = (context.timeref - anim_info.start_ts) / anim_info.duration;
      if (anim_info.handle.update) anim_info.handle.update(Math.max(0, Math.min(progress, 1)));
      if (progress >= 1) {
        if (anim_info.handle.end) anim_info.handle.end();
        delete this.animations[id];
      }
    }
  }
  load_sound_effect(src) {
    const audio = new Audio(src);
    this.sound_effects[src] = audio;
    return audio;
  }
  preload_sounds(...srcs) {
    for (const src of srcs) {
      this.load_sound_effect(src);
    }
  }
  play_sound_effect(src, { volume = 1 } = {}) {
    let audio;
    if (src in this.sound_effects) {
      audio = this.sound_effects[src];
    } else {
      audio = this.load_sound_effect(src);
    }
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play();
    return audio;
  }
  pick_and_play_sound_effect(sounds, { volume = 1 } = {}) {
    if (sounds == null || !sounds.length) return null;
    const sound = random_pick(sounds);
    return this.play_sound_effect(sound, { volume });
  }
  preload_images(...srcs) {
    for (const src of srcs) {
      const existing_link = document.querySelector(`link[href="${src}"]`);
      if (existing_link != null) continue;
      const preload_link = document.createElement("link");
      preload_link.href = src;
      preload_link.rel = "preload";
      preload_link.as = "image";
      document.head.appendChild(preload_link);
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
    if (this.debug_mode && this.debug_hitboxes) {
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
