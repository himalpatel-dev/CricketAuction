import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
    leaving: boolean;
}

/**
 * App-wide toast notifications (replaces blocking alert() popups).
 * Rendered by <app-toast-container> in the root component.
 */
@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private nextId = 1;
    private timers = new Map<number, ReturnType<typeof setTimeout>>();
    private readonly maxVisible = 4;

    readonly toasts = signal<Toast[]>([]);

    success(message: string, duration = 3500) {
        return this.show('success', message, duration);
    }

    error(message: string, duration = 5000) {
        return this.show('error', message, duration);
    }

    warning(message: string, duration = 4500) {
        return this.show('warning', message, duration);
    }

    info(message: string, duration = 3500) {
        return this.show('info', message, duration);
    }

    show(type: ToastType, message: string, duration = 4000): number {
        // Same message already showing (e.g. a button clicked twice): replace it instead of stacking
        const duplicate = this.toasts().find(t => t.type === type && t.message === message && !t.leaving);
        if (duplicate) this.remove(duplicate.id);

        const id = this.nextId++;
        this.toasts.update(list => [...list, { id, type, message, duration, leaving: false }]);

        // Keep the stack short: drop the oldest beyond the limit
        const overflow = this.toasts().filter(t => !t.leaving).slice(0, -this.maxVisible);
        overflow.forEach(t => this.remove(t.id));

        this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
        return id;
    }

    /** Animate the toast out, then remove it. */
    dismiss(id: number) {
        this.clearTimer(id);
        this.toasts.update(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => this.remove(id), 200);
    }

    private remove(id: number) {
        this.clearTimer(id);
        this.toasts.update(list => list.filter(t => t.id !== id));
    }

    private clearTimer(id: number) {
        const timer = this.timers.get(id);
        if (timer) clearTimeout(timer);
        this.timers.delete(id);
    }
}
