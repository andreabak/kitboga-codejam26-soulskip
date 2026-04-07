import {config} from "@/config"
import {Point} from "@/utils"

const gestures_cfg = config.gestures

export type GestureEventMap = {
    drag_start: (pos: Point) => void
    drag: (pos: Point, delta: Point) => void
    drag_end: () => void
    tap: (pos: Point) => void
    two_finger_drag_start: (pos: Point) => void
    two_finger_drag: (pos: Point, delta: Point) => void
    two_finger_drag_end: () => void
    defend_start: () => void
    defend_end: () => void
}

export type GestureEventName = keyof GestureEventMap

export class GestureManager {
    private element: HTMLElement
    private handlers: Map<GestureEventName, GestureEventMap[GestureEventName][]> = new Map()

    tap_threshold_ms: number = gestures_cfg.tap_threshold_ms
    drag_threshold_px: number = gestures_cfg.drag_threshold_px
    tap_pre_delay_ms: number = gestures_cfg.tap_pre_delay_ms

    private start_touches: Map<number, {x: number; y: number; time: number}> = new Map()
    private current_touches: Map<number, {x: number; y: number}> = new Map()
    private is_moving = false
    private is_defending = false

    private drag_last_pos: Point | null = null
    private two_finger_drag_last_pos: Point | null = null

    constructor(element: HTMLElement) {
        this.element = element

        Object.assign(this, gestures_cfg)

        this.element.addEventListener("touchstart", this.handle_touchstart.bind(this), {passive: false})
        this.element.addEventListener("touchmove", this.handle_touchmove.bind(this), {passive: false})
        this.element.addEventListener("touchend", this.handle_touchend.bind(this), {passive: false})
        this.element.addEventListener("touchcancel", this.handle_touchend.bind(this), {passive: false})

        // Prevent default on the whole element to avoid systemic gestures (like pull-to-refresh)
        this.element.style.touchAction = "none"
    }

    register_handler<E extends GestureEventName>(event: E, callback: GestureEventMap[E]) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, [])
        }
        ;(this.handlers.get(event) as GestureEventMap[E][]).push(callback)
    }

    private dispatch<E extends GestureEventName>(event: E, ...args: Parameters<GestureEventMap[E]>) {
        const event_handlers = this.handlers.get(event)
        if (event_handlers) {
            for (const handler of event_handlers) {
                ;(handler as (...args: Parameters<GestureEventMap[E]>) => void)(...args)
            }
        }
    }

    private get_relative_pos(touch: Touch): Point {
        const rect = this.element.getBoundingClientRect()
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        }
    }

    private handle_touchstart(event: TouchEvent) {
        event.preventDefault()
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i]
            const pos = this.get_relative_pos(touch)
            this.start_touches.set(touch.identifier, {...pos, time: Date.now()})
            this.current_touches.set(touch.identifier, pos)
        }

        if (this.current_touches.size === 2) {
            if (!this.is_defending) {
                this.is_defending = true
                this.dispatch("defend_start")
            }
        }
    }

    private handle_touchmove(event: TouchEvent) {
        event.preventDefault()
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i]
            const pos = this.get_relative_pos(touch)
            if (this.current_touches.has(touch.identifier)) {
                this.current_touches.set(touch.identifier, pos)
            }
        }

        if (this.current_touches.size === 1) {
            const id = this.current_touches.keys().next().value as number
            const start = this.start_touches.get(id)
            if (start) {
                const pos = this.current_touches.get(id)!
                const dx = pos.x - start.x
                const dy = pos.y - start.y
                if (Math.sqrt(dx * dx + dy * dy) > this.drag_threshold_px) {
                    if (!this.is_moving) {
                        this.is_moving = true
                        this.drag_last_pos = {...pos}
                        this.dispatch("drag_start", pos)
                    }
                }
                if (this.is_moving && this.drag_last_pos) {
                    this.dispatch("drag", pos, {
                        x: pos.x - this.drag_last_pos.x,
                        y: pos.y - this.drag_last_pos.y,
                    })
                    this.drag_last_pos = {...pos}
                }
            }
        } else if (this.current_touches.size === 2) {
            const ids = Array.from(this.current_touches.keys())
            const start1 = this.start_touches.get(ids[0])
            const start2 = this.start_touches.get(ids[1])

            if (start1 && start2) {
                const pos1 = this.current_touches.get(ids[0])!
                const pos2 = this.current_touches.get(ids[1])!
                const avg_pos = {
                    x: (pos1.x + pos2.x) / 2,
                    y: (pos1.y + pos2.y) / 2,
                }

                if (!this.is_defending) {
                    this.is_defending = true
                    this.dispatch("defend_start")
                }

                const dx1 = pos1.x - start1.x
                const dy1 = pos1.y - start1.y
                const dx2 = pos2.x - start2.x
                const dy2 = pos2.y - start2.y

                if (
                    Math.sqrt(dx1 * dx1 + dy1 * dy1) > this.drag_threshold_px ||
                    Math.sqrt(dx2 * dx2 + dy2 * dy2) > this.drag_threshold_px
                ) {
                    if (!this.is_moving) {
                        this.is_moving = true
                        this.two_finger_drag_last_pos = {...avg_pos}
                        this.dispatch("two_finger_drag_start", avg_pos)
                    }
                }

                if (this.is_moving && this.two_finger_drag_last_pos) {
                    this.dispatch("two_finger_drag", avg_pos, {
                        x: avg_pos.x - this.two_finger_drag_last_pos.x,
                        y: avg_pos.y - this.two_finger_drag_last_pos.y,
                    })
                    this.two_finger_drag_last_pos = {...avg_pos}
                }
            }
        }
    }

    private handle_touchend(event: TouchEvent) {
        event.preventDefault()
        const now = Date.now()

        const removed_touches = Array.from(event.changedTouches)

        // If we only have 1 finger and it was a tap
        if (this.start_touches.size === 1 && !this.is_moving && !this.is_defending) {
            const touch = removed_touches[0]
            const start = this.start_touches.get(touch.identifier)
            if (start) {
                const pos = this.get_relative_pos(touch)
                const dx = pos.x - start.x
                const dy = pos.y - start.y
                if (
                    Math.sqrt(dx * dx + dy * dy) <= this.drag_threshold_px &&
                    now - start.time <= this.tap_threshold_ms
                ) {
                    // Wait a bit to see if another finger comes down
                    setTimeout(() => {
                        if (!this.is_defending) {
                            this.dispatch("tap", pos)
                        }
                    }, this.tap_pre_delay_ms)
                }
            }
        }

        for (const touch of removed_touches) {
            this.start_touches.delete(touch.identifier)
            this.current_touches.delete(touch.identifier)
        }

        if (this.current_touches.size === 0) {
            if (this.is_defending) {
                this.is_defending = false
                this.dispatch("defend_end")
            }
            if (this.is_moving) {
                this.is_moving = false
                this.drag_last_pos = null
                this.two_finger_drag_last_pos = null
                this.dispatch("drag_end")
                this.dispatch("two_finger_drag_end")
            }
        } else if (this.current_touches.size === 1) {
            // If we were defending with 2 and now have 1, stop defending
            if (this.is_defending) {
                this.is_defending = false
                this.dispatch("defend_end")
            }
        }
    }
}
