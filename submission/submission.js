var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { c as config } from "./config.js";
import { B as BloodEffect1AtlasImg, a as BloodEffect1AtlasMeta, b as BloodEffect2AtlasImg, c as BloodEffect2AtlasMeta, d as BloodEffect3AtlasImg, e as BloodEffect3AtlasMeta, f as BloodEffect4AtlasImg, g as BloodEffect4AtlasMeta, F as FlaskUseAtlasImg, h as FlaskUseAtlasMeta, P as PlayerAttackHitSound1, i as PlayerAttackHitSound2, j as PlayerAttackHitSound3, k as PlayerAttackHitSound4, l as PlayerAttackSound1, m as PlayerAttackSound2, S as SwordIcon, n as ShieldIcon, o as FlaskIcon, p as PlayerParryStar1, q as PlayerParryStar2, r as PlayerParryStar3, s as PlayerParryStar4, t as PlayerCureSound1, u as PlayerCureSound2, v as PlayerDeathSound, w as PlayerDamageSound1, x as PlayerDamageSound2, y as PlayerParrySound1, z as PlayerParrySound2, A as PlayerDefendSound1, C as PlayerDefendSound2, D as PlayerDefendSound3, E as PlayerAttackSwing, L as LightningEffect1AtlasImg, G as LightningEffect1AtlasMeta, H as LightningEffect2AtlasImg, I as LightningEffect2AtlasMeta, J as LightningEffect3AtlasImg, K as LightningEffect3AtlasMeta, M as EnemyAttackHitSound1, N as EnemyAttackHitSound2, O as EnemyAttackHitSound3, Q as EnemyAttackFastSound1, R as EnemyAttackFastSound2, T as EnemyAttackFastSound3, U as EnemyAttackFastSound4, V as EnemyAttackFastSound5, W as EnemyAttackSlowSound1, X as EnemyAttackSlowSound2, Y as EnemyAttackSlowSound3, Z as EnemyDeathSound, _ as EnemyBreakSound, $ as EnemyDamageSound1, a0 as EnemyDamageSound2, a1 as EnemyDamageSound3, a2 as EnemyDamageSound4, a3 as EnemyDamageSound5, a4 as EnemyDamageSound6, a5 as EnemyDamageSound7, a6 as EnemyDamageSound8, a7 as EnemyDamageSound9, a8 as EnemyIntroSpeechSound, a9 as ThunderSound1, aa as ThunderSound2, ab as ThunderSound3, ac as EnemyAttackSwing, ad as VineShortImage2, ae as VineShortImage1, af as VineLongImage2, ag as VineLongImage1, ah as BattleVictorySound, ai as BattleDefeatSound } from "./assets.js";
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
const rad2deg = (radians) => radians * 180 / Math.PI;
const deg2rad = (degrees) => degrees * Math.PI / 180;
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
    direction = deg2rad(-90),
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
class ImageSequence {
  constructor(frames_src, fps) {
    __publicField(this, "frames_src");
    __publicField(this, "fps");
    if (!frames_src.length) throw new Error("frames_src must not be empty");
    this.frames_src = frames_src;
    this.fps = fps;
  }
  get duration() {
    return 1e3 / this.fps * this.frames_src.length;
  }
  frame_at_progress(progress) {
    if (progress < 0) {
      return this.frames_src[0];
    } else if (progress < 1) {
      return this.frames_src[Math.floor(progress * this.frames_src.length)];
    } else {
      return this.frames_src.at(-1);
    }
  }
  static from_frames_dir(frames_glob, fps) {
    const files = Object.entries(frames_glob);
    files.sort(([a], [b]) => a.localeCompare(b));
    const frames = files.map(([, mod]) => mod.default);
    return new ImageSequence(frames, fps);
  }
}
class ImageAtlas {
  constructor(atlas_src, atlas_meta, fps) {
    __publicField(this, "FRAME_EL_CLS", "atlas-frame");
    __publicField(this, "atlas_src");
    __publicField(this, "atlas_meta");
    __publicField(this, "fps");
    if (!atlas_meta.frames.length) throw new Error("atlas_meta should have at least one frame");
    this.atlas_src = atlas_src;
    this.atlas_meta = atlas_meta;
    this.fps = fps;
  }
  get duration() {
    return 1e3 / this.fps * this.atlas_meta.frames.length;
  }
  _frame_at_progress(progress) {
    if (progress < 0) {
      return this.atlas_meta.frames[0];
    } else if (progress < 1) {
      return this.atlas_meta.frames[Math.floor(progress * this.atlas_meta.frames.length)];
    } else {
      return this.atlas_meta.frames.at(-1);
    }
  }
  set_frame_at_progress(image_el, progress) {
    let frame_el = image_el.querySelector(`.${this.FRAME_EL_CLS}`);
    if (!frame_el) {
      frame_el = document.createElement("div");
      frame_el.classList.add(this.FRAME_EL_CLS);
      frame_el.style.position = "absolute";
      frame_el.style.top = "50%";
      frame_el.style.left = "50%";
      frame_el.style.backgroundImage = `url("${this.atlas_src}")`;
      image_el.appendChild(frame_el);
    }
    const frame = this._frame_at_progress(progress);
    if (frame_el.dataset.index && parseInt(frame_el.dataset.index) === frame.index) return;
    frame_el.dataset.index = frame.index.toString();
    frame_el.style.width = `${frame.w}px`;
    frame_el.style.height = `${frame.h}px`;
    frame_el.style.backgroundPosition = `${-frame.x}px ${-frame.y}px`;
    const scale = Math.min(image_el.offsetWidth / frame.w, image_el.offsetHeight / frame.h);
    frame_el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}
function delay_anim(callback, delay2) {
  return {
    end: () => callback(),
    duration: delay2
  };
}
function image_animation_def(image_src, element, { duration, remove, position, size, style } = {}, init) {
  function factory(component, params_override, init_override, ...rest) {
    const params = { ...{ duration, remove, position, size, style }, ...params_override ?? {} };
    const randid = "img-" + Math.random().toString(36);
    const _img = typeof image_src === "string" || image_src instanceof ImageSequence || image_src instanceof ImageAtlas ? image_src : random_pick(image_src);
    const _img_src = typeof _img === "string" ? _img : _img instanceof ImageSequence ? _img.frame_at_progress(0) : null;
    const image_el = document.createElement("div");
    image_el.id = randid;
    image_el.style.position = "absolute";
    if (_img_src != null) {
      image_el.style.backgroundImage = `url('${_img_src}')`;
      image_el.style.backgroundSize = "contain";
    }
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
    let sub_update = void 0;
    let sub_end = void 0;
    const _init = init_override ?? init;
    if (_init != null) {
      ({ update: sub_update, end: sub_end } = _init(component, image_el, ...rest));
    }
    const update = (progress) => {
      if (sub_update != null) sub_update(progress);
      if (_img instanceof ImageSequence) {
        image_el.style.backgroundImage = `url('${_img.frame_at_progress(progress)}')`;
      } else if (_img instanceof ImageAtlas) {
        _img.set_frame_at_progress(image_el, progress);
      }
    };
    const end = () => {
      if (sub_end != null) sub_end();
      if (params.remove == null || params.remove === true) image_el.remove();
    };
    update(0);
    const _duration = params.duration ?? (_img instanceof ImageSequence || _img instanceof ImageAtlas ? _img.duration : void 0);
    if (_duration != null) return { duration: _duration, update, end };
    else return { update, end };
  }
  factory.image_src = (Array.isArray(image_src) ? image_src : [image_src]).map((i) => i instanceof ImageSequence ? i.frames_src : i instanceof ImageAtlas ? i.atlas_src : i).flat();
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
    const mouse_pressed_slots = /* @__PURE__ */ new Set();
    for (const slot of slots_elements) {
      const slot_name = slot.dataset.slot;
      if (!slot_name) continue;
      slots_elements_map[slot_name] = slot;
      slot.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        mouse_pressed_slots.add(slot);
        this._use_slot_item(slot);
      });
      slot.addEventListener("mouseup", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (mouse_pressed_slots.delete(slot)) {
          this._release_slot_item(slot);
        }
      });
      slot.addEventListener("mouseleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (mouse_pressed_slots.delete(slot)) {
          this._release_slot_item(slot);
        }
      });
      slot.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._use_slot_item(slot);
      });
      slot.addEventListener("touchend", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._release_slot_item(slot);
      });
      slot.addEventListener("touchcancel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._release_slot_item(slot);
      });
    }
    this.slots_elements = slots_elements_map;
  }
  _use_slot_item(slot) {
    const item_name = slot.dataset.item;
    if (!item_name) return;
    this.game.player.use_item(item_name);
  }
  _release_slot_item(slot) {
    const item_name = slot.dataset.item;
    if (!item_name) return;
    this.game.player.release_item(item_name);
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
    this.hud_root_el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.hud_root_el.addEventListener("touchstart", (e) => e.stopPropagation());
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
const BloodEffect1Atlas = new ImageAtlas(BloodEffect1AtlasImg, BloodEffect1AtlasMeta, 15);
const BloodEffect2Atlas = new ImageAtlas(BloodEffect2AtlasImg, BloodEffect2AtlasMeta, 15);
const BloodEffect3Atlas = new ImageAtlas(BloodEffect3AtlasImg, BloodEffect3AtlasMeta, 15);
const BloodEffect4Atlas = new ImageAtlas(BloodEffect4AtlasImg, BloodEffect4AtlasMeta, 15);
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
      const rotation_base_deg = rad2deg(character.direction - attack.hitbox.rotation_ref);
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
function blood_splat_animation_def(params) {
  return image_animation_def(
    [BloodEffect1Atlas, BloodEffect2Atlas, BloodEffect3Atlas, BloodEffect4Atlas],
    (character) => character.game.animations_root_el,
    params,
    (character, image_el, { attacking_character } = {}) => {
      const hurtbox_bbox = shape_bbox(character.hurtbox_abs);
      const hurtbox_center = {
        x: hurtbox_bbox.x + hurtbox_bbox.width / 2,
        y: hurtbox_bbox.y + hurtbox_bbox.height / 2
      };
      let dist_vector = null;
      let dir_vector;
      if (attacking_character) {
        dist_vector = {
          x: attacking_character.pos.x - hurtbox_center.x,
          y: attacking_character.pos.y - hurtbox_center.y
        };
        const direction = Math.atan2(dist_vector.y, dist_vector.x);
        dir_vector = { x: Math.cos(direction), y: Math.sin(direction) };
      } else {
        dir_vector = { ...character.direction_vector };
      }
      const offset_size = { x: hurtbox_bbox.width / 2, y: hurtbox_bbox.height / 2 };
      if (dist_vector != null) {
        offset_size.x = Math.min(Math.abs(dist_vector.x), offset_size.x);
        offset_size.y = Math.min(Math.abs(dist_vector.y), offset_size.y);
      }
      const relpos = { x: offset_size.x * dir_vector.x, y: offset_size.y * dir_vector.y };
      const pos = {
        x: hurtbox_center.x + relpos.x,
        y: hurtbox_center.y + relpos.y
      };
      image_el.style.top = `${pos.y}px`;
      image_el.style.left = `${pos.x}px`;
      image_el.style.transform = `translate(-50%, -50%) rotate(${rad2deg(character.direction)}deg)`;
      return {};
    }
  );
}
const ATTACK_PHASES_SEQUENCE = ["anticipation", "hit", "recovery"];
const base_cfg = config.characters.defaults;
class Character extends Actor {
  constructor(game2) {
    super(game2);
    __publicField(this, "_follower");
    __publicField(this, "base_acceleration", base_cfg.base_acceleration);
    __publicField(this, "base_max_vel", base_cfg.base_max_vel);
    __publicField(this, "slowing_distance", base_cfg.slowing_distance);
    __publicField(this, "rotates", false);
    __publicField(this, "health", base_cfg.initial_health ?? base_cfg.max_health);
    __publicField(this, "max_health", base_cfg.max_health);
    // TODO: sanity check
    __publicField(this, "last_damage_ts", -Infinity);
    __publicField(this, "invicible", base_cfg.invicible);
    __publicField(this, "stamina", base_cfg.initial_stamina ?? base_cfg.max_stamina);
    __publicField(this, "max_stamina", base_cfg.max_stamina);
    // TODO: sanity check
    __publicField(this, "stamina_movement_consume_factor", base_cfg.stamina_movement_consume_factor);
    __publicField(this, "stamina_movement_vel_min", base_cfg.stamina_movement_vel_min);
    __publicField(this, "stamina_recover", base_cfg.stamina_recover);
    __publicField(this, "stamina_recover_delay", base_cfg.stamina_recover_delay);
    __publicField(this, "last_stamina_consume_ts", -Infinity);
    __publicField(this, "low_stamina_max_vel", base_cfg.low_stamina_max_vel);
    __publicField(this, "low_stamina_accel", base_cfg.low_stamina_accel);
    __publicField(this, "low_stamina", false);
    __publicField(this, "low_stamina_enter_threshold", base_cfg.low_stamina_enter_threshold);
    // TODO: sanity check
    __publicField(this, "low_stamina_exit_threshold", base_cfg.low_stamina_exit_threshold);
    __publicField(this, "attack_requested", false);
    __publicField(this, "current_attack", null);
    __publicField(this, "attack_stamina_consume_multiplier", base_cfg.attack_stamina_consume_multiplier);
    __publicField(this, "last_attack_hits", []);
    __publicField(this, "defend_requested", false);
    __publicField(this, "defend_request_ts", -Infinity);
    __publicField(this, "defend_damage_reduction", base_cfg.defend_damage_reduction);
    __publicField(this, "defend_stamina_consume_factor", base_cfg.defend_stamina_consume_factor);
    __publicField(this, "defend_acceleration", base_cfg.defend_acceleration);
    __publicField(this, "defend_max_vel", base_cfg.defend_max_vel);
    __publicField(this, "defending", false);
    __publicField(this, "parry_stamina_consume", base_cfg.parry_stamina_consume);
    __publicField(this, "parry_enemy_stamina_consume_factor", base_cfg.parry_enemy_stamina_consume_factor);
    __publicField(this, "last_cure_ts", -Infinity);
    __publicField(this, "cure_duration", base_cfg.cure_duration);
    __publicField(this, "curing_max_vel", base_cfg.curing_max_vel);
    __publicField(this, "curing", false);
    __publicField(this, "animations", {});
    __publicField(this, "sounds", {});
    this.apply_config(base_cfg);
    this._follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      {
        acceleration: this.base_acceleration,
        max_vel: this.base_max_vel,
        slowing_distance: this.slowing_distance,
        vel_max_rotation: deg2rad(20 * 360),
        dir_max_rotation: deg2rad(2 * 360)
      }
    );
  }
  apply_config(cfg) {
    const { attacks_defs: attacks_defs_cfg, ...restcfg } = { attacks_defs: void 0, ...cfg };
    Object.assign(this, restcfg);
    this.health = cfg.initial_health ?? cfg.max_health;
    this.stamina = cfg.initial_stamina ?? cfg.max_stamina;
    if (attacks_defs_cfg) {
      for (const [attack_name, attack_cfg] of Object.entries(attacks_defs_cfg)) {
        if (attack_cfg == null) continue;
        const attack_def = this.attacks_defs[attack_name];
        const { phases: phases_cfg, ...restattackcfg } = attack_cfg;
        Object.assign(attack_def, restattackcfg);
        for (const [phase_name, phase_cfg] of Object.entries(phases_cfg)) {
          if (phase_cfg == null) continue;
          const phase_def = attack_def.phases[phase_name];
          Object.assign(phase_def, phase_cfg);
        }
      }
    }
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
    return !this.curing && !this.attacking && !this.low_stamina && !this.dead;
  }
  get can_defend() {
    return !this.curing && !this.attacking && !this.low_stamina && !this.dead;
  }
  get can_parry() {
    return !this.curing && !this.attacking && !this.low_stamina && !this.dead;
  }
  consume_stamina(amount, { context }) {
    this.stamina -= amount;
    if (this.stamina < 0) this.stamina = 0;
    this.last_stamina_consume_ts = context.timeref;
  }
  consume_health(amount, { context }) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
    this.last_damage_ts = context.timeref;
  }
  recover_health(amount) {
    if (this.dead) return;
    this.health += amount;
    if (this.health > this.max_health) this.health = this.max_health;
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
    this.curing = context.timeref < this.last_cure_ts + this.cure_duration;
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
    return this.attacking ? ((_a = this.current_attack_phase) == null ? void 0 : _a.acceleration) ?? this.base_acceleration : this.defending ? this.defend_acceleration : this.curing ? this.curing_max_vel : this.low_stamina ? this.low_stamina_accel : this.base_acceleration;
  }
  calc_max_vel() {
    var _a;
    return this.dead ? 0 : this.attacking ? ((_a = this.current_attack_phase) == null ? void 0 : _a.max_vel) ?? this.base_max_vel : this.defending ? this.defend_max_vel : this.curing ? this.curing_max_vel : this.low_stamina ? this.low_stamina_max_vel : this.base_max_vel;
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
      const defend = this.attack_defend({ attack, attacking_character, context });
      if (typeof defend === "number") {
        health_damage = defend;
        this.game.pick_and_play_sound_effect(this.sounds.defend);
      }
    }
    if (!this.invicible && health_damage >= 0) {
      this.attack_damage(health_damage, { attack, attacking_character, context });
      if (this.health <= 0) {
        this.game.pick_and_play_sound_effect(this.sounds.death);
      } else if (!this.defending) {
        this.game.pick_and_play_sound_effect(this.sounds.damage);
      }
      this.game.pick_and_play_sound_effect(attack.hit_sound);
    }
    return true;
  }
  attack_defend({
    attack,
    attacking_character,
    context
  }) {
    this.consume_stamina(attack.damage * this.defend_stamina_consume_factor, { context });
    return attack.damage * (1 - this.defend_damage_reduction);
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
  attack_damage(health_damage, {
    attack,
    attacking_character,
    context
  }) {
    this.consume_health(health_damage, { context });
  }
}
const gestures_cfg = config.gestures;
class GestureManager {
  constructor(element) {
    __publicField(this, "element");
    __publicField(this, "handlers", /* @__PURE__ */ new Map());
    __publicField(this, "tap_threshold_ms", gestures_cfg.tap_threshold_ms);
    __publicField(this, "drag_threshold_px", gestures_cfg.drag_threshold_px);
    __publicField(this, "tap_pre_delay_ms", gestures_cfg.tap_pre_delay_ms);
    __publicField(this, "start_touches", /* @__PURE__ */ new Map());
    __publicField(this, "current_touches", /* @__PURE__ */ new Map());
    __publicField(this, "is_moving", false);
    __publicField(this, "is_defending", false);
    __publicField(this, "drag_last_pos", null);
    __publicField(this, "two_finger_drag_last_pos", null);
    this.element = element;
    Object.assign(this, gestures_cfg);
    this.element.addEventListener("touchstart", this.handle_touchstart.bind(this), { passive: false });
    this.element.addEventListener("touchmove", this.handle_touchmove.bind(this), { passive: false });
    this.element.addEventListener("touchend", this.handle_touchend.bind(this), { passive: false });
    this.element.addEventListener("touchcancel", this.handle_touchend.bind(this), { passive: false });
    this.element.style.touchAction = "none";
  }
  register_handler(event, callback) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(callback);
  }
  dispatch(event, ...args) {
    const event_handlers = this.handlers.get(event);
    if (event_handlers) {
      for (const handler of event_handlers) {
        handler(...args);
      }
    }
  }
  get_relative_pos(touch) {
    const rect = this.element.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }
  handle_touchstart(event) {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const pos = this.get_relative_pos(touch);
      this.start_touches.set(touch.identifier, { ...pos, time: Date.now() });
      this.current_touches.set(touch.identifier, pos);
    }
    if (this.current_touches.size === 2) {
      if (!this.is_defending) {
        this.is_defending = true;
        this.dispatch("defend_start");
      }
    }
  }
  handle_touchmove(event) {
    event.preventDefault();
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const pos = this.get_relative_pos(touch);
      if (this.current_touches.has(touch.identifier)) {
        this.current_touches.set(touch.identifier, pos);
      }
    }
    if (this.current_touches.size === 1) {
      const id = this.current_touches.keys().next().value;
      const start = this.start_touches.get(id);
      if (start) {
        const pos = this.current_touches.get(id);
        const dx = pos.x - start.x;
        const dy = pos.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > this.drag_threshold_px) {
          if (!this.is_moving) {
            this.is_moving = true;
            this.drag_last_pos = { ...pos };
            this.dispatch("drag_start", pos);
          }
        }
        if (this.is_moving && this.drag_last_pos) {
          this.dispatch("drag", pos, {
            x: pos.x - this.drag_last_pos.x,
            y: pos.y - this.drag_last_pos.y
          });
          this.drag_last_pos = { ...pos };
        }
      }
    } else if (this.current_touches.size === 2) {
      const ids = Array.from(this.current_touches.keys());
      const start1 = this.start_touches.get(ids[0]);
      const start2 = this.start_touches.get(ids[1]);
      if (start1 && start2) {
        const pos1 = this.current_touches.get(ids[0]);
        const pos2 = this.current_touches.get(ids[1]);
        const avg_pos = {
          x: (pos1.x + pos2.x) / 2,
          y: (pos1.y + pos2.y) / 2
        };
        if (!this.is_defending) {
          this.is_defending = true;
          this.dispatch("defend_start");
        }
        const dx1 = pos1.x - start1.x;
        const dy1 = pos1.y - start1.y;
        const dx2 = pos2.x - start2.x;
        const dy2 = pos2.y - start2.y;
        if (Math.sqrt(dx1 * dx1 + dy1 * dy1) > this.drag_threshold_px || Math.sqrt(dx2 * dx2 + dy2 * dy2) > this.drag_threshold_px) {
          if (!this.is_moving) {
            this.is_moving = true;
            this.two_finger_drag_last_pos = { ...avg_pos };
            this.dispatch("two_finger_drag_start", avg_pos);
          }
        }
        if (this.is_moving && this.two_finger_drag_last_pos) {
          this.dispatch("two_finger_drag", avg_pos, {
            x: avg_pos.x - this.two_finger_drag_last_pos.x,
            y: avg_pos.y - this.two_finger_drag_last_pos.y
          });
          this.two_finger_drag_last_pos = { ...avg_pos };
        }
      }
    }
  }
  handle_touchend(event) {
    event.preventDefault();
    const now = Date.now();
    const removed_touches = Array.from(event.changedTouches);
    if (this.start_touches.size === 1 && !this.is_moving && !this.is_defending) {
      const touch = removed_touches[0];
      const start = this.start_touches.get(touch.identifier);
      if (start) {
        const pos = this.get_relative_pos(touch);
        const dx = pos.x - start.x;
        const dy = pos.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) <= this.drag_threshold_px && now - start.time <= this.tap_threshold_ms) {
          setTimeout(() => {
            if (!this.is_defending) {
              this.dispatch("tap", pos);
            }
          }, this.tap_pre_delay_ms);
        }
      }
    }
    for (const touch of removed_touches) {
      this.start_touches.delete(touch.identifier);
      this.current_touches.delete(touch.identifier);
    }
    if (this.current_touches.size === 0) {
      if (this.is_defending) {
        this.is_defending = false;
        this.dispatch("defend_end");
      }
      if (this.is_moving) {
        this.is_moving = false;
        this.drag_last_pos = null;
        this.two_finger_drag_last_pos = null;
        this.dispatch("drag_end");
        this.dispatch("two_finger_drag_end");
      }
    } else if (this.current_touches.size === 1) {
      if (this.is_defending) {
        this.is_defending = false;
        this.dispatch("defend_end");
      }
    }
  }
}
const FlaskUseAtlas = new ImageAtlas(FlaskUseAtlasImg, FlaskUseAtlasMeta, 15);
const player_shield_selector = ".shield";
class PlayerShield extends GameComponent {
  constructor(game2, player) {
    super(game2);
    __publicField(this, "player");
    __publicField(this, "shield_el");
    __publicField(this, "player_distance", 20);
    __publicField(this, "offset", { x: 6, y: 12 });
    __publicField(this, "rotation_ref", deg2rad(90));
    this.player = player;
    this.shield_el = get_element(player_shield_selector, player.player_root_el);
  }
  _update(context) {
    const rotation = this.player.direction;
    const _transf_rot = rotation - this.rotation_ref;
    const _transf_rot_sin = Math.sin(_transf_rot);
    const _transf_rot_cos = Math.cos(_transf_rot);
    const rot_pinch_limit = deg2rad(30);
    const rotation_pinch_factor = Math.abs(_transf_rot_sin) ** 9 * Math.sign(_transf_rot_sin) * Math.sign(_transf_rot_cos);
    const rotation_pinch = rot_pinch_limit * rotation_pinch_factor;
    const pos = { x: Math.cos(rotation) * this.player_distance, y: Math.sin(rotation) * this.player_distance };
    const shadow_dist = 4;
    const shadow_pos = {
      x: -pos.x / this.player_distance * shadow_dist,
      y: -pos.y / this.player_distance * shadow_dist
    };
    this.shield_el.classList.toggle("hidden", !(this.game.state === "battle" && this.player.defending));
    this.shield_el.style.top = `calc(50% + ${pos.y + this.offset.y}px)`;
    this.shield_el.style.left = `calc(50% + ${pos.x + this.offset.x}px)`;
    this.shield_el.style.transform = `
            translate(-50%, -50%)
            rotateX(45deg)
            rotateY(${rad2deg(rotation - this.rotation_ref - rotation_pinch)}deg)
        `;
    this.shield_el.style.filter = `
            brightness(${1 - 0.3 * Math.abs(_transf_rot_sin) ** 0.5 - 0.5 * (-Math.sign(_transf_rot_cos) / 2 - 0.5)})
            drop-shadow(${shadow_pos.x}px ${shadow_pos.y}px 8px rgba(0, 0, 0, 0.5))
        `;
  }
  get pos_abs() {
    const rect = this.shield_el.getBoundingClientRect();
    const game_rect = this.game.rect;
    return { x: rect.x - game_rect.x + rect.width / 2, y: rect.y - game_rect.y + rect.height / 2 };
  }
}
const keybinds_cfg = config.keybinds;
const player_cfg = { ...config.characters.defaults, ...config.characters.player };
const player_root_selector = ".player";
const _Player = class _Player extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "player_root_el");
    __publicField(this, "shield");
    __publicField(this, "gesture_manager");
    __publicField(this, "keys_pressed", /* @__PURE__ */ new Set());
    __publicField(this, "width", 48);
    __publicField(this, "height", 48);
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
            animation: attack_swing_animation_def(PlayerAttackSwing, {
              base_color: [255, 255, 255],
              ref_angle_deg: -30,
              swing_angle_deg: 45
              // eslint-disable-next-line
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
          rotation_ref: deg2rad(-90)
        },
        hit_sound: [PlayerAttackHitSound1, PlayerAttackHitSound2, PlayerAttackHitSound3, PlayerAttackHitSound4]
      }
    });
    __publicField(this, "items", {
      flask: { name: "flask", icon_src: FlaskIcon, owned: 3, consumable: true },
      shield: { name: "shield", icon_src: ShieldIcon, consumable: false, holdable: true },
      sword: { name: "sword", icon_src: SwordIcon, consumable: false }
    });
    __publicField(this, "flask_health_recover_pct", player_cfg.flask_health_recover_pct);
    __publicField(this, "animations", {
      defend: _Player.stars_animation_def([PlayerParryStar1, PlayerParryStar2], (player) => ({
        position: player.shield.pos_abs,
        size: { x: 256, y: 256 },
        style: { mixBlendMode: "plus-lighter", filter: "sepia(1) saturation(2) opacity(0.75)" }
      })),
      parry: _Player.stars_animation_def(
        [PlayerParryStar1, PlayerParryStar2, PlayerParryStar3, PlayerParryStar4],
        (player) => ({
          position: player.shield.pos_abs,
          size: { x: 512, y: 512 },
          style: { mixBlendMode: "plus-lighter" }
        })
      ),
      damage: blood_splat_animation_def({
        style: { width: "32px", height: "32px", filter: "brightness(0.7) contrast(1.2)" }
      }),
      cure: image_animation_def(FlaskUseAtlas, (player) => player.player_root_el, {
        style: {
          top: "65%",
          left: "50%",
          width: "64px",
          height: "64px",
          transform: "translate(-50%, -50%)",
          filter: "hue-rotate(-60deg)"
        }
      })
    });
    __publicField(this, "sounds", {
      defend: [PlayerDefendSound1, PlayerDefendSound2, PlayerDefendSound3],
      parry: [PlayerParrySound1, PlayerParrySound2],
      damage: [PlayerDamageSound1, PlayerDamageSound2],
      death: [PlayerDeathSound],
      cure: [PlayerCureSound1, PlayerCureSound2]
    });
    this.apply_config(player_cfg);
    this.player_root_el = get_element(player_root_selector, this.game.game_root_el);
    this.shield = this.add_component(new PlayerShield(this.game, this));
    this.pos = { x: this.game.rect.width / 2, y: this.game.rect.height / 2 };
    this.game.game_root_el.addEventListener("mousemove", (e) => {
      const rect = this.game.game_root_el.getBoundingClientRect();
      this._input_move({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    });
    this.game.game_root_el.addEventListener("mousedown", (e) => {
      if (e.button === 0) this._input_attack(true);
      if (e.button === 2) this._input_defend(true);
    });
    this.game.game_root_el.addEventListener("mouseup", (e) => {
      if (e.button === 2) this._input_defend(false);
    });
    this.game.game_root_el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });
    this.gesture_manager = new GestureManager(this.game.game_root_el);
    this.gesture_manager.register_handler("drag", (_pos, delta) => this._input_move(delta, { relative: true }));
    this.gesture_manager.register_handler("tap", (_pos) => this._input_attack(true));
    this.gesture_manager.register_handler("defend_start", () => this._input_defend(true));
    this.gesture_manager.register_handler("defend_end", () => this._input_defend(false));
    this.gesture_manager.register_handler(
      "two_finger_drag",
      (_pos, delta) => this._input_move(delta, { relative: true })
    );
    const key_codes_pressed = /* @__PURE__ */ new Set();
    window.addEventListener("keydown", (e) => {
      if (key_codes_pressed.has(e.code)) return;
      if ([keybinds_cfg.attack_key_code].flat().includes(e.code)) {
        this._input_attack(true);
      } else if ([keybinds_cfg.defend_key_code].flat().includes(e.code)) {
        this._input_defend(true);
      } else if ([keybinds_cfg.cure_key_code].flat().includes(e.code)) {
        this.use_item("flask");
      } else if ([keybinds_cfg.move_up_key_code].flat().includes(e.code)) {
        this.keys_pressed.add("up");
      } else if ([keybinds_cfg.move_left_key_code].flat().includes(e.code)) {
        this.keys_pressed.add("left");
      } else if ([keybinds_cfg.move_down_key_code].flat().includes(e.code)) {
        this.keys_pressed.add("down");
      } else if ([keybinds_cfg.move_right_key_code].flat().includes(e.code)) {
        this.keys_pressed.add("right");
      }
      key_codes_pressed.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (key_codes_pressed.has(e.code)) {
        if ([keybinds_cfg.defend_key_code].flat().includes(e.code)) {
          this._input_defend(false);
        } else if ([keybinds_cfg.move_up_key_code].flat().includes(e.code)) {
          this.keys_pressed.delete("up");
        } else if ([keybinds_cfg.move_left_key_code].flat().includes(e.code)) {
          this.keys_pressed.delete("left");
        } else if ([keybinds_cfg.move_down_key_code].flat().includes(e.code)) {
          this.keys_pressed.delete("down");
        } else if ([keybinds_cfg.move_right_key_code].flat().includes(e.code)) {
          this.keys_pressed.delete("right");
        }
      }
      key_codes_pressed.delete(e.code);
    });
  }
  _input_move(pos, { relative = false } = {}) {
    const game_rect = this.game.rect;
    let pos_target;
    if (relative) {
      const _pos_target_before = { ...this.pos_target };
      pos_target = {
        x: _pos_target_before.x + pos.x,
        y: _pos_target_before.y + pos.y
      };
    } else {
      pos_target = pos;
    }
    this.pos_target = {
      x: Math.max(0, Math.min(pos_target.x, game_rect.width)),
      y: Math.max(0, Math.min(pos_target.y, game_rect.height))
    };
  }
  _input_attack(state) {
    if (this.game.state !== "battle") return;
    if (state) {
      this.attack_requested = true;
    }
  }
  _input_defend(state) {
    if (this.game.state !== "battle") return;
    if (state) {
      this.defend_request_ts = this.game.timeref;
      this.defend_requested = true;
    } else {
      this.defend_requested = false;
    }
  }
  get root_el() {
    return this.player_root_el;
  }
  _update(context) {
    var _a;
    const move_dir = { x: 0, y: 0 };
    const move_dir_keys_map = {
      up: { x: 0, y: -1 },
      left: { x: -1, y: 0 },
      down: { x: 0, y: 1 },
      right: { x: 1, y: 0 }
    };
    for (const key of this.keys_pressed.values()) {
      const key_dir = move_dir_keys_map[key];
      if (!key_dir) continue;
      move_dir.x += key_dir.x;
      move_dir.y += key_dir.y;
    }
    if (move_dir.x || move_dir.y) {
      const move_angle = Math.atan2(move_dir.y, move_dir.x);
      const target_vec = {
        x: Math.cos(move_angle) * keybinds_cfg.move_target_dist,
        y: Math.sin(move_angle) * keybinds_cfg.move_target_dist
      };
      this._input_move(target_vec, { relative: true });
    }
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
    this.player_root_el.classList.toggle("dead", this.dead);
  }
  new_attack() {
    return this.attacks_defs["fast"];
  }
  _attack_start(attack, { context }) {
    super._attack_start(attack, { context });
    this.player_root_el.style.setProperty("--attack-scale", attack.scale.toString());
  }
  attack_defend({
    attack,
    attacking_character,
    context
  }) {
    const defend = super.attack_defend({
      attack,
      attacking_character,
      context
    });
    if (typeof defend === "number") {
      this.game.play_animation(this.animations.defend(this), 250);
    }
    return defend;
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
      this.game.play_animation(this.animations.parry(this), 100);
    }
    return do_parry;
  }
  attack_damage(health_damage, {
    attack,
    attacking_character,
    context
  }) {
    super.attack_damage(health_damage, {
      attack,
      attacking_character,
      context
    });
    if (!this.defending)
      this.game.play_animation(this.animations.damage(this, {}, void 0, { attacking_character }));
  }
  use_item(item_name) {
    const item = this.items[item_name];
    if (!item) console.warn(`Player has no item "${item_name}"`);
    if (!this.dead && (!item.consumable || item.owned > 0)) {
      let used = false;
      if (item.name === "flask") {
        if (!this.attacking && !this.defending && !this.curing) {
          this.recover_health(this.max_health * this.flask_health_recover_pct);
          this.last_cure_ts = this.game.timeref;
          this.game.pick_and_play_sound_effect(this.sounds.cure);
          this.game.play_animation(this.animations.cure(this));
          used = true;
        }
      } else if (item.name === "sword") {
        this._input_attack(true);
      } else if (item.name === "shield") {
        this._input_defend(true);
      }
      if (item.consumable && used) {
        item.owned -= 1;
      }
    }
  }
  release_item(item_name) {
    const item = this.items[item_name];
    if (!item) return;
    if (!item.consumable && item.holdable) {
      if (item.name === "shield") {
        this._input_defend(false);
      }
    }
  }
};
__publicField(_Player, "stars_animation_def", (stars_imgs, params) => multi_animation_def(
  stars_imgs.map((img) => image_animation_def(img, (player) => player.game.animations_root_el)),
  {},
  (player, defs) => {
    const _params = params(player);
    return defs.map(
      (def, index) => def(player, _params, (player2, image_el) => {
        const rot_start = Math.random() * 365;
        const rot_deg = 45 * (2 * (index % 2) - 1);
        return {
          update: (progress) => {
            image_el.style.transform = `
                                    translate(-50%, -50%)
                                    rotate(${rot_start + rot_deg * progress ** 0.125}deg)
                                    scale(${progress ** 0.25})
                                `;
            image_el.style.opacity = (1 - progress ** 2).toString();
          }
        };
      })
    );
  }
));
let Player = _Player;
const LightningEffect1Atlas = new ImageAtlas(LightningEffect1AtlasImg, LightningEffect1AtlasMeta, 15);
const LightningEffect2Atlas = new ImageAtlas(LightningEffect2AtlasImg, LightningEffect2AtlasMeta, 15);
const LightningEffect3Atlas = new ImageAtlas(LightningEffect3AtlasImg, LightningEffect3AtlasMeta, 15);
const enemy_weapon_selector = ".weapon";
const _EnemyWeapon = class _EnemyWeapon extends GameComponent {
  constructor(game2, enemy) {
    super(game2);
    __publicField(this, "enemy");
    __publicField(this, "weapon_el");
    __publicField(this, "follower");
    __publicField(this, "base_offset", { x: 0, y: 24 });
    __publicField(this, "base_rotation", deg2rad(-150));
    __publicField(this, "rotation_ref", deg2rad(-135));
    __publicField(this, "velocity_drift_factor", 3);
    this.enemy = enemy;
    this.weapon_el = get_element(enemy_weapon_selector, enemy.enemy_root_el);
    this.follower = new TargetFollower(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      {
        acceleration: 200,
        slowing_distance: 10,
        dir_max_rotation: deg2rad(20 * 360)
      }
    );
  }
  _update(context) {
    if (this.enemy.current_attack == null) {
      if (this.enemy.low_stamina || this.enemy.dead) this.base_rotation = deg2rad(-190);
    }
    const offset = {
      x: this.base_offset.x - this.enemy.velocity.x * this.velocity_drift_factor,
      y: this.base_offset.y - this.enemy.velocity.y * this.velocity_drift_factor
    };
    const rotation = this.base_rotation - this.rotation_ref + deg2rad(Math.max(-30, Math.min(-this.enemy.velocity.x * 1.5, 30)));
    this.follower.pos_target = offset;
    this.follower.dir_target = rotation;
    if (context.timedelta) this.follower.update(context.timedelta);
    this.weapon_el.style.transform = `
            translate(calc(${this.follower.pos.x}px - 50%), calc(${this.follower.pos.y}px - 50%))
            rotate(${rad2deg(this.follower.direction)}deg)
        `;
  }
};
__publicField(_EnemyWeapon, "initial_offset", { x: 0, y: 24 });
__publicField(_EnemyWeapon, "initial_rotation", deg2rad(-150));
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
      return deg2rad(-90) + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    }
  }),
  swing_fast_hit: _EnemyWeapon.animation_base_def({
    position: { x: 24, y: 0 },
    rotation: (enemy) => {
      var _a, _b;
      return deg2rad(-355) + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    },
    params: { shortest_angle: false, ease_fn: (progress) => progress ** 0.5 }
  }),
  swing_slow_anticipation: _EnemyWeapon.animation_base_def({
    position: { x: -32, y: -24 },
    rotation: (enemy) => {
      var _a, _b;
      return deg2rad(-60) + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    }
  }),
  swing_slow_hit: _EnemyWeapon.animation_base_def({
    position: { x: 24, y: 0 },
    rotation: (enemy) => {
      var _a, _b;
      return deg2rad(-355) + enemy.direction - (((_b = (_a = enemy.current_attack) == null ? void 0 : _a.hitbox) == null ? void 0 : _b.rotation_ref) ?? 0);
    },
    params: { shortest_angle: false, ease_fn: (progress) => progress ** 0.5 }
  }),
  swing_recover: _EnemyWeapon.animation_base_def({
    position: _EnemyWeapon.initial_offset,
    rotation: _EnemyWeapon.initial_rotation
  })
});
let EnemyWeapon = _EnemyWeapon;
const enemy_cfg = { ...config.characters.defaults, ...config.characters.enemy };
const enemy_root_selector = ".enemy";
const skip_btn_selector = ".skip-btn";
const vines_root_selector = ".vines";
const eyes_selector = ".eye";
class Enemy extends Character {
  constructor(game2) {
    super(game2);
    __publicField(this, "enemy_root_el");
    __publicField(this, "skip_btn_el");
    __publicField(this, "vines_root_el");
    __publicField(this, "weapon");
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "hurtbox_def", { shape: { x: -1, y: -1, width: 2, height: 2 }, rotation_ref: 0 });
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
                EnemyAttackSwing,
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
          rotation_ref: deg2rad(-90)
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
                EnemyAttackSwing,
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
          rotation_ref: deg2rad(-90)
        },
        hit_sound: [EnemyAttackHitSound1, EnemyAttackHitSound2, EnemyAttackHitSound3]
      }
    });
    __publicField(this, "attacks_chains_defs", enemy_cfg.attacks_chains_defs);
    __publicField(this, "current_attack_chain", null);
    // TODO: aggro: number = 0.0
    // TODO: AI
    __publicField(this, "_phase", "rest");
    __publicField(this, "phases_ts", {});
    __publicField(this, "follow_dist_offset", enemy_cfg.follow_dist_offset);
    __publicField(this, "next_attack_ts", Infinity);
    __publicField(this, "auto_attack_dist", enemy_cfg.auto_attack_dist);
    __publicField(this, "auto_attack_interval", enemy_cfg.auto_attack_interval);
    __publicField(this, "animations", {
      lightning_strike: image_animation_def(
        [LightningEffect1Atlas, LightningEffect2Atlas, LightningEffect3Atlas],
        (enemy) => enemy.game.animations_root_el,
        {
          style: {
            width: "100%",
            height: "90%",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            mixBlendMode: "plus-lighter"
          }
        }
      ),
      lightning_backdrop: (enemy) => {
        const el = document.createElement("div");
        el.style = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: white;
                mix-blend-mode: plus-lighter;
            `;
        enemy.game.animations_root_el.appendChild(el);
        return {
          update: (progress) => {
            const opacity = Math.sin(Math.max(0, progress - 0.025) ** 0.2 * Math.PI) ** 4;
            el.style.opacity = opacity.toString();
          },
          end: () => el.remove()
        };
      },
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
                    const rotation_deg = rad2deg(
                      Math.atan2(
                        image_el.offsetTop - btn_rect.height / 2,
                        image_el.offsetLeft - btn_rect.width / 2
                      )
                    ) + rotation_offset_deg;
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
      ),
      damage: blood_splat_animation_def({
        style: { width: "54px", height: "54px", filter: "hue-rotate(90deg) brightness(1.5) contrast(1.4)" }
      })
    });
    __publicField(this, "sounds", {
      intro_thunder: [ThunderSound1, ThunderSound2, ThunderSound3],
      intro_speech: [EnemyIntroSpeechSound],
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
      [5, 11, "Such divine display rabidly spurn'd..."],
      [11, 15, "Oblivion awaits thy gaze!"]
    ]);
    __publicField(this, "intro_thunder_enabled", enemy_cfg.intro_thunder_enabled);
    this.apply_config(enemy_cfg);
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
    this.enemy_root_el.addEventListener("click", (e) => {
      e.preventDefault();
      this._aggro_trigger();
    });
    this.enemy_root_el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._aggro_trigger();
    });
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
        this.defending = true;
        this.base_acceleration = 0.033;
        if (this.game.changed_state) {
          if (this.intro_thunder_enabled) {
            this.game.pick_and_play_sound_effect(this.sounds.intro_thunder);
            this.game.play_animation(this.animations.lightning_strike(this));
            this.game.play_animation(this.animations.lightning_backdrop(this), 8e3);
          }
          this.enemy_root_el.querySelectorAll(eyes_selector).forEach((e) => e.classList.remove("hidden"));
          this.game.play_animation(
            delay_anim(() => {
              this.game.pick_and_play_sound_effect(this.sounds.intro_speech);
              this.game.play_animation(subs_anim(this.game, this.intro_speech_subs));
              this.game.play_animation(this.animations.grow_vines(this), 5e3);
              this.game.play_animation(
                delay_anim(() => this.weapon.weapon_el.classList.remove("hidden"), 5e3)
              );
            }, 2e3)
          );
        }
        if (context.timeref - (this.phases_ts[this.phase] ?? context.timeref) > 12e3) {
          this.phase = "fight";
          this.defending = false;
          this.base_acceleration = enemy_cfg.base_acceleration;
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
    this.enemy_root_el.classList.toggle("hidden", !this.game.loaded);
    this.enemy_root_el.classList.toggle("attacking", this.attacking);
    this.enemy_root_el.classList.toggle("defending", this.defending);
    this.enemy_root_el.classList.toggle("low-stamina", this.low_stamina);
    this.enemy_root_el.classList.toggle("dead", this.dead);
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
  attack_damage(health_damage, {
    attack,
    attacking_character,
    context
  }) {
    super.attack_damage(health_damage, {
      attack,
      attacking_character,
      context
    });
    this.game.play_animation(this.animations.damage(this, {}, void 0, { attacking_character }));
  }
  calc_next_attack_ts(now_ts) {
    return now_ts + this.auto_attack_interval[0] + Math.random() * (this.auto_attack_interval[1] - this.auto_attack_interval[0]);
  }
  _aggro_trigger() {
    if (this.game.state === "chill" && this.game.loaded) {
      this.game.change_state_soon("battle");
      this.phase = "fight-start";
      const game_rect = this.game.rect;
      this.pos_target = { x: game_rect.x + game_rect.width / 2, y: game_rect.y + game_rect.height / 2 };
      this.next_attack_ts = this.calc_next_attack_ts(this.game.timeref);
    }
  }
}
const BattleMusicIntroSound = "" + new URL("assets/cinema-blockbuster-trailer-21-by-ende-intro-CfLWT77A.opus", import.meta.url).href;
const BattleMusicSound = "" + new URL("assets/cinema-blockbuster-trailer-21-by-ende-loop1-mUQc17UH.opus", import.meta.url).href;
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
const game_cfg = config.game;
const game_root_selector = "#game-root";
const attacks_indicators_selector = ".attack-indicator, .defend-indicator";
const animations_root_selector = ".animations";
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
    __publicField(this, "animations_root_el");
    __publicField(this, "animations", {});
    __publicField(this, "pending_assets", /* @__PURE__ */ new Set());
    __publicField(this, "sound_effects", {});
    __publicField(this, "player");
    __publicField(this, "enemy");
    __publicField(this, "characters", []);
    __publicField(this, "hud");
    __publicField(this, "defeat_screen");
    __publicField(this, "victory_screen");
    __publicField(this, "subs_root_el");
    __publicField(this, "debug_mode", game_cfg.debug_mode);
    __publicField(this, "debug_enemy_stamina", game_cfg.debug_enemy_stamina);
    __publicField(this, "debug_hitboxes", game_cfg.debug_hitboxes);
    __publicField(this, "debug_attacks", game_cfg.debug_attacks);
    __publicField(this, "debug_noreload", game_cfg.debug_noreload);
    __publicField(this, "sounds", {
      battle_music_intro: [BattleMusicIntroSound],
      battle_music: [BattleMusicSound],
      battle_defeat: [BattleDefeatSound],
      battle_victory: [BattleVictorySound]
    });
    __publicField(this, "battle_music_audio", null);
    this.game_root_el = get_element(game_root_selector);
    this.game_root_el.classList.toggle("hidden", false);
    this.animations_root_el = get_element(animations_root_selector, this.game_root_el);
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
  get loaded() {
    return !this.pending_assets.size;
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
        send_shell_request({ type: "setVideoFilter", value: "blur(3px) brightness(0.65)" });
        send_shell_request({ type: "setVolume", value: 0.3 });
        this.battle_music_audio = this.pick_and_play_sound_effect(this.sounds.battle_music_intro, {
          volume: 0.125
        });
        if (this.battle_music_audio) {
          fade_audio(this.battle_music_audio, { duration: 15e3, volume: 1 });
          this.battle_music_audio.addEventListener("ended", () => {
            if (this.state === "battle")
              this.battle_music_audio = this.pick_and_play_sound_effect(this.sounds.battle_music, {
                loop: true
              });
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
    this.game_root_el.querySelectorAll(attacks_indicators_selector).forEach((e) => e.classList.toggle("hidden", !(this.debug_mode && this.debug_attacks)));
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
    this.pending_assets.add(src);
    audio.addEventListener("canplaythrough", () => this.pending_assets.delete(src));
    audio.addEventListener("error", () => this.pending_assets.delete(src));
    return audio;
  }
  preload_sounds(...srcs) {
    for (const src of srcs) {
      if (src.startsWith("data:")) continue;
      this.load_sound_effect(src);
    }
  }
  play_sound_effect(src, { volume = 1, loop = false } = {}) {
    let audio;
    if (src in this.sound_effects) {
      audio = this.sound_effects[src];
    } else {
      audio = this.load_sound_effect(src);
    }
    audio.currentTime = 0;
    audio.volume = volume;
    audio.loop = loop;
    audio.play();
    return audio;
  }
  pick_and_play_sound_effect(sounds, { volume = 1, loop = false } = {}) {
    if (sounds == null || !sounds.length) return null;
    const sound = random_pick(sounds);
    return this.play_sound_effect(sound, { volume, loop });
  }
  preload_images(...srcs) {
    for (const src of srcs) {
      if (src.startsWith("data:")) continue;
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
