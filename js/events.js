// ─── EventBus ───────────────────────────────────────────────
//
// Pub/sub event system. Coexists with Kernel.driver.checkTriggers()
// — new code subscribes via EventBus.on(), existing triggers
// continue working unchanged.
//
// Depends on: nothing (loads before kernel.js)

const EventBus = {

    _listeners: {},   // { eventType: [{ fn, once, id }] }
    _idCounter: 0,

    // Subscribe to an event type. Returns a listener ID for removal.
    on(type, fn) {
        if (!this._listeners[type]) this._listeners[type] = [];
        const id = ++this._idCounter;
        this._listeners[type].push({ fn, once: false, id });
        return id;
    },

    // Subscribe once — auto-removes after first fire.
    once(type, fn) {
        if (!this._listeners[type]) this._listeners[type] = [];
        const id = ++this._idCounter;
        this._listeners[type].push({ fn, once: true, id });
        return id;
    },

    // Remove a listener by its ID.
    off(id) {
        for (const type in this._listeners) {
            const arr = this._listeners[type];
            const idx = arr.findIndex(l => l.id === id);
            if (idx !== -1) {
                arr.splice(idx, 1);
                if (arr.length === 0) delete this._listeners[type];
                return true;
            }
        }
        return false;
    },

    // Fire all listeners for the given event type.
    // Each listener is wrapped in try/catch so one failure
    // doesn't break the rest.
    emit(type, detail) {
        const arr = this._listeners[type];
        if (!arr) return;
        const toRemove = [];
        for (let i = 0; i < arr.length; i++) {
            const listener = arr[i];
            try {
                listener.fn(detail);
            } catch (e) {
                console.error(`[EventBus] Error in ${type} listener:`, e);
            }
            if (listener.once) toRemove.push(i);
        }
        // Remove once-listeners in reverse order to preserve indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
            arr.splice(toRemove[i], 1);
        }
        if (arr.length === 0) delete this._listeners[type];
    },

    // Clear all listeners. Called during version reset.
    reset() {
        for (const type in this._listeners) delete this._listeners[type];
        this._idCounter = 0;
    },
};
