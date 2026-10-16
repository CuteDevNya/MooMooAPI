/*!
 * MooMooAPI v0.7.0
 * A modular, client-side helper library for MooMoo.io userscripts.
 * https://github.com/CuteDevNya/MooMooAPI
 */
(function (window, document) {
    "use strict";

    const API_NAME = "MooMooAPI";
    const VERSION = "0.7.0";

    if (window[API_NAME] && window[API_NAME].__isMooMooAPI) {
        console.warn("[MooMooAPI] The library is already loaded.");
        return;
    }

    const api = {
        version: VERSION,
        modules: Object.create(null),

        /**
         * Resolves with the API after the library has been loaded.
         * This does not mean that the game has exposed any specific internal data.
         */
        ready() {
            return Promise.resolve(api);
        },

        /**
         * Register a feature module.
         *
         * Example:
         * MooMooAPI.registerModule("example", (api) => ({
         *     hello() {
         *         return "Hello from an extension!";
         *     }
         * }));
         * // Then call MooMooAPI.example.hello()
         */
        registerModule(name, factory) {
            if (typeof name !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
                throw new TypeError("[MooMooAPI] Module names must be valid JavaScript identifiers.");
            }

            if (typeof factory !== "function") {
                throw new TypeError("[MooMooAPI] A module factory function is required.");
            }

            if (Object.prototype.hasOwnProperty.call(api, name) ||
                Object.prototype.hasOwnProperty.call(api.modules, name)) {
                throw new Error("[MooMooAPI] A property or module named '" + name + "' already exists.");
            }

            const moduleValue = factory(api);

            if (!moduleValue || (typeof moduleValue !== "object" && typeof moduleValue !== "function")) {
                throw new TypeError("[MooMooAPI] Module factory '" + name + "' must return an object or function.");
            }

            api.modules[name] = moduleValue;
            api[name] = moduleValue;

            console.info("[MooMooAPI] Registered module: " + name);
            return moduleValue;
        },

        hasModule(name) {
            return Object.prototype.hasOwnProperty.call(api.modules, name);
        },

        getInfo() {
            return {
                name: API_NAME,
                version: VERSION,
                modules: Object.keys(api.modules)
            };
        }
    };

    Object.defineProperty(api, "__isMooMooAPI", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });

    // Track the last real mouse position so click helpers can restore it after
    // dispatching their synthetic input events. Synthetic events are ignored here.
    const pointerState = {
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2)
    };

    window.addEventListener("mousemove", function (event) {
        if (!event.isTrusted) return;
        pointerState.x = event.clientX;
        pointerState.y = event.clientY;
    }, true);

    function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    function numberOrNull(value) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim() !== "") {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        }
        return null;
    }

    // Optional integration with a compatible MooMoo.js runtime.
    function getMooMooClient() {
        try {
            const candidate = window.MooMoo;
            return candidate && typeof candidate === "object" ? candidate : null;
        } catch (_) {
            return null;
        }
    }

    function getButtonNumber(button) {
        if (button === undefined || button === "left") return 0;
        if (button === "middle") return 1;
        if (button === "right") return 2;

        if (button === 0 || button === 1 || button === 2) return button;

        throw new TypeError("[MooMooAPI] button must be 'left', 'middle', 'right', 0, 1, or 2.");
    }

    function getButtonsMask(button) {
        if (button === 0) return 1; // Left button
        if (button === 1) return 4; // Middle button
        if (button === 2) return 2; // Right button
        return 0;
    }

    const inputModule = api.registerModule("input", function () {
        let defaultTarget = "#touch-controls-fullscreen";

        function resolveTarget(targetOverride) {
            const target = targetOverride === undefined ? defaultTarget : targetOverride;

            if (target && typeof target.dispatchEvent === "function") {
                return target;
            }

            if (typeof target === "string" && target.length > 0) {
                try {
                    return document.querySelector(target);
                } catch (error) {
                    console.error("[MooMooAPI] Invalid click target selector:", target, error);
                    return null;
                }
            }

            return null;
        }

        function resolveOrigin(origin) {
            if (origin === undefined || origin === null || origin === "center") {
                return {
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2
                };
            }

            if (origin === "mouse") {
                return {
                    x: pointerState.x,
                    y: pointerState.y
                };
            }

            if (typeof origin === "object" &&
                isFiniteNumber(origin.x) &&
                isFiniteNumber(origin.y)) {
                return { x: origin.x, y: origin.y };
            }

            throw new TypeError("[MooMooAPI] origin must be 'center', 'mouse', or an object with numeric x and y.");
        }

        function dispatchMouse(target, type, x, y, button, buttons) {
            const event = new window.MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y,
                button: button,
                buttons: buttons
            });

            return target.dispatchEvent(event);
        }

        /**
         * Dispatch a click at viewport coordinates (CSS pixels).
         * This uses synthetic MouseEvents, like the original working script.
         * Some game versions may ignore synthetic events.
         */
        function clickAt(x, y, options) {
            let settings = options || {};

            // Also accept clickAt({ x, y }, options).
            if (x && typeof x === "object") {
                settings = y || {};
                y = x.y;
                x = x.x;
            }

            if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
                throw new TypeError("[MooMooAPI] clickAt requires numeric x and y coordinates.");
            }

            const target = resolveTarget(settings.target);
            if (!target) {
                return {
                    success: false,
                    reason: "target-not-found",
                    message: "The click target was not found. Set input.setDefaultTarget(...) or pass options.target."
                };
            }

            const button = getButtonNumber(settings.button);
            const mask = getButtonsMask(button);
            const pointX = Math.round(x);
            const pointY = Math.round(y);
            const restore = settings.restoreMouse !== false;
            const restoreX = pointerState.x;
            const restoreY = pointerState.y;

            dispatchMouse(target, "mousemove", pointX, pointY, 0, 0);
            dispatchMouse(target, "mousedown", pointX, pointY, button, mask);
            dispatchMouse(target, "mouseup", pointX, pointY, button, 0);

            if (restore) {
                dispatchMouse(target, "mousemove", restoreX, restoreY, 0, 0);
            }

            return {
                success: true,
                x: pointX,
                y: pointY,
                button: button,
                restoredMouse: restore
            };
        }

        /**
         * Click using either explicit coordinates or an angle and distance.
         *
         * Angle convention follows screen coordinates:
         *   0 degrees = right, 90 = down, 180 = left, 270 = up.
         *
         * Defaults to 80 pixels above the center, matching the supplied script.
         */
        function getMouseDirection(origin) {
            const resolvedOrigin = resolveOrigin(origin);
            const dx = pointerState.x - resolvedOrigin.x;
            const dy = pointerState.y - resolvedOrigin.y;

            // If the pointer is exactly at the origin, use upward as a stable fallback.
            if (Math.hypot(dx, dy) < 1) {
                return {
                    angle: 270,
                    dx: 0,
                    dy: 0,
                    mouseX: pointerState.x,
                    mouseY: pointerState.y,
                    originX: resolvedOrigin.x,
                    originY: resolvedOrigin.y
                };
            }

            return {
                angle: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360,
                dx: dx,
                dy: dy,
                mouseX: pointerState.x,
                mouseY: pointerState.y,
                originX: resolvedOrigin.x,
                originY: resolvedOrigin.y
            };
        }

        function click(configuration, distance, extraOptions) {
            let settings;

            if (typeof configuration === "number") {
                settings = Object.assign({}, extraOptions || {}, {
                    angle: configuration,
                    distance: distance
                });
            } else {
                settings = Object.assign({}, configuration || {});
            }

            if (isFiniteNumber(settings.x) && isFiniteNumber(settings.y)) {
                return clickAt(settings.x, settings.y, settings);
            }

            const origin = resolveOrigin(settings.origin);
            // With no explicit angle, aim toward the current real mouse pointer.
            const mouseDirection = getMouseDirection(settings.origin);
            const angle = isFiniteNumber(settings.angle) ? settings.angle : mouseDirection.angle;
            const radius = isFiniteNumber(settings.distance) ? settings.distance : 80;
            const radians = angle * Math.PI / 180;
            const x = origin.x + Math.cos(radians) * radius;
            const y = origin.y + Math.sin(radians) * radius;

            const result = clickAt(x, y, settings);
            result.angle = angle;
            result.distance = radius;
            result.directionSource = isFiniteNumber(settings.angle) ? "explicit-angle" : "mouse";
            return result;
        }

        function clickAtAngle(angle, distance, options) {
            if (!isFiniteNumber(angle)) {
                throw new TypeError("[MooMooAPI] clickAtAngle requires a numeric angle.");
            }

            const settings = Object.assign({}, options || {}, {
                angle: angle,
                distance: isFiniteNumber(distance) ? distance : 80
            });

            return click(settings);
        }

        function clickAtOffset(offsetX, offsetY, options) {
            if (!isFiniteNumber(offsetX) || !isFiniteNumber(offsetY)) {
                throw new TypeError("[MooMooAPI] clickAtOffset requires numeric offsets.");
            }

            const settings = Object.assign({}, options || {});
            const origin = resolveOrigin(settings.origin);
            return clickAt(origin.x + offsetX, origin.y + offsetY, settings);
        }

        function clickCenter(options) {
            return clickAt(window.innerWidth / 2, window.innerHeight / 2, options || {});
        }

        function setDefaultTarget(target) {
            if (typeof target !== "string" && !(target && typeof target.dispatchEvent === "function")) {
                throw new TypeError("[MooMooAPI] The default target must be a selector or an EventTarget.");
            }

            const previousTarget = defaultTarget;
            defaultTarget = target;
            return previousTarget;
        }

        function getMousePosition() {
            return { x: pointerState.x, y: pointerState.y };
        }

        /**
         * Add an optional keyboard shortcut. Nothing is bound automatically.
         * Returns an unbind function.
         */
        function bindClickHotkey(code, clickOptions, hotkeyOptions) {
            if (typeof code !== "string" || !code) {
                throw new TypeError("[MooMooAPI] A KeyboardEvent.code string is required.");
            }

            const clickSettings = Object.assign({}, clickOptions || {});
            const hotkeySettings = Object.assign({
                preventDefault: true,
                ignoreInputs: true,
                ignoreRepeat: true
            }, hotkeyOptions || {});

            function isEditableTarget(target) {
                if (!(target instanceof window.HTMLElement)) return false;

                return target.isContentEditable ||
                    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
            }

            function onKeyDown(event) {
                if (event.code !== code) return;
                if (hotkeySettings.ignoreRepeat && event.repeat) return;
                if (hotkeySettings.ignoreInputs && isEditableTarget(event.target)) return;

                if (hotkeySettings.preventDefault) event.preventDefault();
                click(clickSettings);
            }

            window.addEventListener("keydown", onKeyDown);

            return function unbindClickHotkey() {
                window.removeEventListener("keydown", onKeyDown);
            };
        }

        /**
         * Repeat a callback while a key remains held. Async callbacks are awaited
         * so slow work does not overlap. Keyup and window blur always stop the loop.
         */
        function bindRepeatHotkey(code, callback, options) {
            if (typeof code !== "string" || !code) {
                throw new TypeError("[MooMooAPI] bindRepeatHotkey requires a KeyboardEvent.code string.");
            }
            if (typeof callback !== "function") {
                throw new TypeError("[MooMooAPI] bindRepeatHotkey requires a callback function.");
            }

            const settings = Object.assign({
                intervalMs: 111,
                minIntervalMs: 40,
                immediate: true,
                preventDefault: true,
                stopPropagation: false,
                ignoreInputs: true,
                ignoreModifiers: true
            }, options || {});

            if (!Number.isFinite(settings.intervalMs) || settings.intervalMs < 0 ||
                !Number.isFinite(settings.minIntervalMs) || settings.minIntervalMs < 0) {
                throw new TypeError("[MooMooAPI] Repeat intervals must be non-negative finite numbers.");
            }
            const intervalMs = Math.max(settings.intervalMs, settings.minIntervalMs);
            let held = false;
            let running = false;
            let timerId = null;
            let lastEvent = null;

            function stop() {
                held = false;
                if (timerId !== null) {
                    window.clearTimeout(timerId);
                    timerId = null;
                }
            }

            async function runOnce() {
                if (!held || running) return;
                running = true;
                try {
                    const result = await callback(lastEvent);
                    if (result === false) {
                        stop();
                        return;
                    }
                } catch (error) {
                    console.error("[MooMooAPI] Repeat-hotkey callback failed:", error);
                } finally {
                    running = false;
                    if (held) timerId = window.setTimeout(runOnce, intervalMs);
                }
            }

            function onKeyDown(event) {
                if (event.code !== code || held || event.repeat) return;
                if (settings.ignoreModifiers && (event.ctrlKey || event.altKey || event.metaKey)) return;
                if (settings.ignoreInputs && isEditableTarget(event.target)) return;
                held = true;
                lastEvent = event;
                if (settings.preventDefault) event.preventDefault();
                if (settings.stopPropagation) event.stopPropagation();
                if (settings.immediate) runOnce();
                else timerId = window.setTimeout(runOnce, intervalMs);
            }

            function onKeyUp(event) {
                if (event.code === code) stop();
            }

            window.addEventListener("keydown", onKeyDown, true);
            window.addEventListener("keyup", onKeyUp, true);
            window.addEventListener("blur", stop);
            return function unbindRepeatHotkey() {
                stop();
                window.removeEventListener("keydown", onKeyDown, true);
                window.removeEventListener("keyup", onKeyUp, true);
                window.removeEventListener("blur", stop);
            };
        }

        return {
            clickAt: clickAt,
            clickAtScreenPoint: clickAt,
            click: click,
            clickAtAngle: clickAtAngle,
            clickDirection: clickAtAngle,
            clickAtOffset: clickAtOffset,
            clickCenter: clickCenter,
            setDefaultTarget: setDefaultTarget,
            getMousePosition: getMousePosition,
            getMouseDirection: getMouseDirection,
            bindClickHotkey: bindClickHotkey,
            bindRepeatHotkey: bindRepeatHotkey
        };
    });


    // --------------------------------------------------
    // ITEM CATALOG AND AVAILABILITY
    // --------------------------------------------------

    const ITEM_NAMES = {
        0: "Tool Hammer",
        1: "Hand Axe",
        2: "Great Axe",
        3: "Short Sword",
        4: "Katana",
        5: "Polearm",
        6: "Bat",
        7: "Daggers",
        8: "Stick",
        9: "Hunting Bow",
        10: "Great Hammer",
        11: "Wooden Shield",
        12: "Crossbow",
        13: "Repeater Crossbow",
        14: "Mc Grabby",
        15: "Musket",
        16: "Apple",
        17: "Cookie",
        18: "Cheese",
        19: "Wood Wall",
        20: "Stone Wall",
        21: "Castle Wall",
        22: "Spikes",
        23: "Greater Spikes",
        24: "Poison Spikes",
        25: "Spinning Spikes",
        26: "Windmill",
        27: "Faster Windmill",
        28: "Power Mill",
        29: "Mine",
        30: "Sapling",
        31: "Pit Trap",
        32: "Boost Pad",
        33: "Turret",
        34: "Platform",
        35: "Healing Pad",
        36: "Spawn Pad",
        37: "Blocker",
        38: "Teleporter"
    };

    const ITEM_AGES = {
        0: 1, 16: 1, 19: 1, 22: 1, 26: 1,
        1: 2, 3: 2, 5: 2, 6: 2, 7: 2, 8: 2,
        17: 3, 20: 3,
        31: 4, 32: 4,
        23: 5, 27: 5, 29: 5, 30: 5,
        9: 6, 10: 6, 11: 6, 14: 6,
        18: 7, 21: 7, 33: 7, 34: 7, 35: 7, 37: 7, 38: 7,
        2: 8, 4: 8, 12: 8, 28: 8,
        13: 9, 15: 9, 24: 9, 25: 9, 36: 9
    };

    // Upgrade chains are derived from the community-maintained MooMoo.io Wiki.
    // Each nested array is one possible path; repeated IDs indicate a branching upgrade.
    const UPGRADE_TREES = {
        primaryWeapon: [
            [0],
            [1, 2],
            [3, 4],
            [5],
            [6],
            [7],
            [8]
        ],
        secondaryWeapon: [
            [9, 12, 13],
            [9, 12, 15],
            [10],
            [11],
            [14]
        ],
        food: [
            [16, 17, 18]
        ],
        wall: [
            [19, 20, 21]
        ],
        spike: [
            [22, 23, 24],
            [22, 23, 25]
        ],
        windmill: [
            [26, 27, 28]
        ],
        mine: [
            [29]
        ],
        sapling: [
            [30]
        ],
        pitTrap: [
            [31]
        ],
        boostPad: [
            [32]
        ],
        turret: [
            [33]
        ],
        platform: [
            [34]
        ],
        healingPad: [
            [35]
        ],
        spawnPad: [
            [36]
        ],
        blocker: [
            [37]
        ],
        teleporter: [
            [38]
        ]
    };

    const UPGRADE_CATEGORY_ALIASES = {
        primary: "primaryWeapon",
        weapon: "primaryWeapon",
        mainweapon: "primaryWeapon",
        primaryweapon: "primaryWeapon",
        secondary: "secondaryWeapon",
        secondweapon: "secondaryWeapon",
        secondaryweapon: "secondaryWeapon",
        food: "food",
        consumable: "food",
        wall: "wall",
        walls: "wall",
        spike: "spike",
        spikes: "spike",
        windmill: "windmill",
        windmills: "windmill",
        mine: "mine",
        sapling: "sapling",
        pittrap: "pitTrap",
        boostpad: "boostPad",
        turret: "turret",
        platform: "platform",
        healingpad: "healingPad",
        spawnpad: "spawnPad",
        blocker: "blocker",
        teleporter: "teleporter"
    };

    const ITEM_COSTS = {
        22: { wood: 20, stone: 5 },
        23: { wood: 30, stone: 10 },
        24: { wood: 35, stone: 15 },
        25: { wood: 30, stone: 20 }
    };

    function getActionBarItemElement(id) {
        if (!Number.isInteger(Number(id))) return null;
        return document.getElementById("actionBarItem" + Number(id));
    }

    function isElementVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        return style.display !== "none" &&
            style.visibility !== "hidden" &&
            element.getClientRects().length > 0;
    }

    function isValidItemId(id) {
        return Number.isInteger(id) &&
            Object.prototype.hasOwnProperty.call(ITEM_NAMES, id);
    }

    const itemsModule = api.registerModule("items", function () {
        function getElement(id) {
            return isValidItemId(Number(id)) ? getActionBarItemElement(Number(id)) : null;
        }

        function isAvailable(id) {
            const numericId = Number(id);
            return isValidItemId(numericId) && isElementVisible(getElement(numericId));
        }

        function getItem(id) {
            const numericId = Number(id);
            if (!isValidItemId(numericId)) return null;

            return {
                id: numericId,
                name: ITEM_NAMES[numericId],
                type: numericId < 16 ? "weapon" : "item",
                actionBarId: "actionBarItem" + numericId,
                buildItemId: numericId >= 16 ? numericId - 16 : null,
                unlockAge: ITEM_AGES[numericId],
                available: isAvailable(numericId)
            };
        }

        function getCatalog() {
            return Object.keys(ITEM_NAMES).map(function (id) {
                return getItem(Number(id));
            });
        }

        function getAvailable() {
            return getCatalog().filter(function (item) {
                return item.available;
            });
        }

        function getStatus() {
            return getCatalog().map(function (item) {
                return {
                    id: item.id,
                    elementId: item.actionBarId,
                    name: item.name,
                    type: item.type,
                    available: item.available,
                    status: item.available ? "Visible / selectable" : "Hidden / unavailable"
                };
            });
        }

        function showStatus() {
            const rows = getStatus();
            console.table(rows);
            return rows;
        }

        return {
            names: Object.freeze(Object.assign({}, ITEM_NAMES)),
            get: getItem,
            getElement: getElement,
            isAvailable: isAvailable,
            getCatalog: getCatalog,
            getAvailable: getAvailable,
            getStatus: getStatus,
            showStatus: showStatus
        };
    });

    // --------------------------------------------------
    // OPTIONAL MOOMOO.JS BRIDGE
    // --------------------------------------------------

    const bridgeModule = api.registerModule("bridge", function () {
        function getClient() {
            return getMooMooClient();
        }

        function isAvailable() {
            const client = getClient();
            return Boolean(client && client.self && client.send &&
                typeof client.send.selectItem === "function");
        }

        function getSelf() {
            const client = getClient();
            if (!client || !client.self || typeof client.self !== "object") return null;
            const state = Object.assign({}, client.self);
            if (Array.isArray(client.self.weapons)) state.weapons = client.self.weapons.slice();
            if (Array.isArray(client.self.items)) state.items = client.self.items.slice();
            return state;
        }

        function getCapabilities() {
            const client = getClient();
            const send = client && client.send;
            return {
                available: isAvailable(),
                state: Boolean(client && client.self && typeof client.self === "object"),
                events: Boolean(client && typeof client.on === "function"),
                readyEvent: Boolean(client && typeof client.onReady === "function"),
                selectItem: Boolean(send && typeof send.selectItem === "function"),
                mouse: Boolean(send && typeof send.mouse === "function"),
                aim: Boolean(send && typeof send.aim === "function"),
                store: Boolean(send && typeof send.store === "function")
            };
        }

        function sendAction(actionName, args) {
            const client = getClient();
            const send = client && client.send;
            if (!send || typeof send[actionName] !== "function") {
                return { success: false, reason: "bridge-action-unavailable", action: actionName };
            }
            try {
                const result = send[actionName].apply(send, args);
                return {
                    success: result !== false,
                    reason: result === false ? "action-rejected" : null,
                    action: actionName,
                    result: result
                };
            } catch (error) {
                return { success: false, reason: "bridge-action-threw", action: actionName, error: error };
            }
        }

        function selectGameItem(itemId, isWeapon) {
            if (!Number.isInteger(itemId) || itemId < 0) {
                return { success: false, reason: "invalid-game-item-id", itemId: itemId };
            }
            return Object.assign(
                { gameItemId: itemId, isWeapon: Boolean(isWeapon) },
                sendAction("selectItem", [itemId, Boolean(isWeapon)])
            );
        }

        function selectActionBarItem(actionBarId) {
            const numericId = Number(actionBarId);
            if (!Number.isInteger(numericId) || !isValidItemId(numericId)) {
                return { success: false, reason: "invalid-item-id", itemId: actionBarId };
            }
            const gameItemId = numericId < 16 ? numericId : numericId - 16;
            const result = selectGameItem(gameItemId, numericId < 16);
            result.itemId = numericId;
            result.actionBarId = "actionBarItem" + numericId;
            result.method = "moomoo-bridge";
            return result;
        }

        function mouse(down, directionRadians) {
            if (typeof down !== "boolean") return { success: false, reason: "invalid-mouse-state" };
            if (directionRadians !== undefined && !isFiniteNumber(directionRadians)) {
                return { success: false, reason: "invalid-direction-radians" };
            }
            const args = directionRadians === undefined ? [down] : [down, directionRadians];
            return Object.assign({ down: down, directionRadians: directionRadians }, sendAction("mouse", args));
        }

        function aim(directionRadians) {
            if (!isFiniteNumber(directionRadians)) return { success: false, reason: "invalid-direction-radians" };
            return Object.assign({ directionRadians: directionRadians }, sendAction("aim", [directionRadians]));
        }

        function storeAction(id, isAccessory, action, label) {
            const numericId = Number(id);
            if (!Number.isInteger(numericId) || numericId < 0) {
                return { success: false, reason: "invalid-store-item-id", id: id };
            }
            return Object.assign(
                { id: numericId, accessory: Boolean(isAccessory) },
                sendAction("store", [action, numericId, Boolean(isAccessory)])
            );
        }

        function on(eventName, callback) {
            const client = getClient();
            if (!client || typeof client.on !== "function" || typeof callback !== "function") return null;
            try {
                const unsubscribe = client.on(eventName, callback);
                return typeof unsubscribe === "function" ? unsubscribe : function () {};
            } catch (error) {
                console.warn("[MooMooAPI] Could not subscribe to bridge event '" + eventName + "':", error);
                return null;
            }
        }

        function onReady(callback) {
            const client = getClient();
            if (!client || typeof client.onReady !== "function" || typeof callback !== "function") return null;
            try {
                const unsubscribe = client.onReady(callback);
                return typeof unsubscribe === "function" ? unsubscribe : function () {};
            } catch (error) {
                console.warn("[MooMooAPI] Could not subscribe to bridge readiness:", error);
                return null;
            }
        }

        return {
            isAvailable: isAvailable,
            getCapabilities: getCapabilities,
            getSelf: getSelf,
            on: on,
            onReady: onReady,
            selectGameItem: selectGameItem,
            selectActionBarItem: selectActionBarItem,
            mouse: mouse,
            aim: aim,
            setHat: function (id) { return storeAction(id, false, 1, "hat"); },
            setAccessory: function (id) { return storeAction(id, true, 1, "accessory"); },
            buyHat: function (id) { return storeAction(id, false, 0, "hat"); },
            buyAccessory: function (id) { return storeAction(id, true, 0, "accessory"); }
        };
    });

    // --------------------------------------------------
    // PLAYER STATE
    // --------------------------------------------------

    const playerModule = api.registerModule("player", function () {
        const MAX_HEALTH = 100;

        function get() {
            const state = api.bridge.getSelf();
            if (!state) {
                return {
                    available: false, known: false, sid: null, alive: null,
                    health: null, maxHealth: MAX_HEALTH, healthPercent: null,
                    x: null, y: null, position: null, directionRadians: null,
                    weaponId: null, buildIndex: null, buildItemId: null,
                    actionBarItemId: null, hatId: null, accessoryId: null,
                    ownedWeaponIds: [], ownedItemIds: [], resources: {
                        food: null, wood: null, stone: null, gold: null
                    }
                };
            }

            const sid = numberOrNull(state.sid);
            const health = numberOrNull(state.health);
            const weaponId = numberOrNull(state.weaponIndex);
            const buildIndex = numberOrNull(state.buildIndex);
            const x = numberOrNull(state.x);
            const y = numberOrNull(state.y);
            const activeBuildItem = buildIndex !== null && buildIndex >= 0 ? buildIndex : null;

            return {
                available: true,
                known: sid !== null && sid >= 0,
                sid: sid,
                alive: typeof state.alive === "boolean" ? state.alive : null,
                health: health,
                maxHealth: MAX_HEALTH,
                healthPercent: health === null ? null : Math.max(0, Math.min(100, health / MAX_HEALTH * 100)),
                x: x,
                y: y,
                position: x === null || y === null ? null : { x: x, y: y },
                directionRadians: numberOrNull(state.dir),
                weaponId: weaponId,
                buildIndex: buildIndex,
                buildItemId: activeBuildItem,
                actionBarItemId: activeBuildItem !== null ? activeBuildItem + 16 : weaponId,
                hatId: numberOrNull(state.hat),
                accessoryId: numberOrNull(state.accessory),
                team: state.team === undefined ? null : state.team,
                points: numberOrNull(state.points),
                kills: numberOrNull(state.kills),
                ownedWeaponIds: Array.isArray(state.weapons) ? state.weapons.slice() : [],
                ownedItemIds: Array.isArray(state.items) ? state.items.slice() : [],
                resources: {
                    food: numberOrNull(state.food),
                    wood: numberOrNull(state.wood),
                    stone: numberOrNull(state.stone),
                    gold: numberOrNull(state.gold)
                }
            };
        }

        function getHealth() { return get().health; }
        function getHealthPercent() { return get().healthPercent; }
        function isAlive() { return get().alive; }
        function getWeaponId() { return get().weaponId; }
        function getBuildItemId() { return get().buildItemId; }
        function getActionBarItemId() { return get().actionBarItemId; }

        function onHealthChange(callback) {
            if (typeof callback !== "function") {
                throw new TypeError("[MooMooAPI] onHealthChange requires a callback function.");
            }
            let previousHealth = getHealth();
            return api.bridge.on("health", function (payload) {
                const state = get();
                if (!state.known || !payload || payload.sid !== state.sid) return;
                const nextHealth = numberOrNull(payload.value);
                callback({
                    sid: state.sid,
                    previousHealth: previousHealth,
                    health: nextHealth,
                    delta: previousHealth === null || nextHealth === null ? null : nextHealth - previousHealth,
                    player: state,
                    raw: payload
                });
                previousHealth = nextHealth;
            });
        }

        function onDeath(callback) {
            if (typeof callback !== "function") throw new TypeError("[MooMooAPI] onDeath requires a callback function.");
            return api.bridge.on("died", function (payload) { callback({ player: get(), raw: payload }); });
        }

        function onSpawn(callback) {
            if (typeof callback !== "function") throw new TypeError("[MooMooAPI] onSpawn requires a callback function.");
            return api.bridge.on("playerAdd", function (payload) {
                if (payload && payload.isYou) callback({ player: get(), raw: payload });
            });
        }

        function onInventoryChange(callback) {
            if (typeof callback !== "function") throw new TypeError("[MooMooAPI] onInventoryChange requires a callback function.");
            return api.bridge.on("inventory", function (payload) {
                callback({ player: get(), isWeapon: Boolean(payload && payload.isWeapon), raw: payload });
            });
        }

        function onValueChange(callback) {
            if (typeof callback !== "function") throw new TypeError("[MooMooAPI] onValueChange requires a callback function.");
            return api.bridge.on("playerValue", function (payload) {
                callback({
                    key: payload && payload.key,
                    value: payload && payload.value,
                    player: get(),
                    raw: payload
                });
            });
        }

        return {
            maxHealth: MAX_HEALTH,
            get: get,
            getSelf: get,
            getHealth: getHealth,
            getHealthPercent: getHealthPercent,
            isAlive: isAlive,
            getWeaponId: getWeaponId,
            getCurrentWeaponId: getWeaponId,
            getBuildItemId: getBuildItemId,
            getCurrentBuildItemId: getBuildItemId,
            getActionBarItemId: getActionBarItemId,
            onHealthChange: onHealthChange,
            onDeath: onDeath,
            onSpawn: onSpawn,
            onInventoryChange: onInventoryChange,
            onValueChange: onValueChange
        };
    });

    // --------------------------------------------------
    // RESOURCE COUNTS AND KNOWN ITEM COSTS
    // --------------------------------------------------


    const resourcesModule = api.registerModule("resources", function () {
        function parseAmount(rawValue) {
            if (rawValue === null || rawValue === undefined) return null;

            // The game displays these values through innerHTML; strip markup before parsing.
            const text = String(rawValue)
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
                .trim();
            const match = text.match(/-?\d[\d,]*/);
            if (!match) return null;

            const value = Number.parseInt(match[0].replace(/,/g, ""), 10);
            return Number.isFinite(value) ? value : null;
        }

        function getDisplayAmount(id) {
            const element = document.getElementById(id);
            return element ? parseAmount(element.innerHTML) : null;
        }

        function getLegacyAmount(children, index) {
            if (!children || children.length <= index || !children[index]) return null;
            return parseAmount(children[index].innerHTML);
        }

        function get() {
            const display = document.getElementById("resDisplay");
            const children = display ? display.children : null;
            const gameState = api.bridge.getSelf() || {};

            const dom = {
                food: getDisplayAmount("foodDisplay"),
                wood: getDisplayAmount("woodDisplay"),
                stone: getDisplayAmount("stoneDisplay"),
                score: getDisplayAmount("scoreDisplay"),
                gold: getLegacyAmount(children, 3)
            };

            if (dom.food === null) dom.food = getLegacyAmount(children, 0);
            if (dom.wood === null) dom.wood = getLegacyAmount(children, 1);
            if (dom.stone === null) dom.stone = getLegacyAmount(children, 2);

            const native = {
                food: numberOrNull(gameState.food),
                wood: numberOrNull(gameState.wood),
                stone: numberOrNull(gameState.stone),
                score: numberOrNull(gameState.points !== undefined ? gameState.points : gameState.score),
                gold: numberOrNull(gameState.gold)
            };
            const result = {};
            const sources = {};
            Object.keys(dom).forEach(function (key) {
                if (native[key] !== null) {
                    result[key] = native[key];
                    sources[key] = "moomoo-state";
                } else if (dom[key] !== null) {
                    result[key] = dom[key];
                    sources[key] = "dom";
                } else {
                    result[key] = null;
                    sources[key] = "unknown";
                }
            });

            result.known = result.food !== null && result.wood !== null && result.stone !== null;
            result.sources = sources;

            if (!result.known) {
                const hasDisplay = Boolean(
                    display ||
                    document.getElementById("foodDisplay") ||
                    document.getElementById("woodDisplay") ||
                    document.getElementById("stoneDisplay") ||
                    api.bridge.isAvailable()
                );
                result.reason = hasDisplay
                    ? "resource-values-could-not-be-parsed-or-state-is-unavailable"
                    : "resource-display-not-found-or-bridge-unavailable";
            }
            return result;
        }

        function getAmount(resourceName) {
            const state = get();
            const name = String(resourceName).toLowerCase();

            if (!["food", "wood", "stone", "score", "gold"].includes(name)) {
                throw new TypeError("[MooMooAPI] Unknown resource or counter: " + resourceName);
            }
            return state[name];
        }

        function getScore() {
            return get().score;
        }

        function onChange(callback) {
            if (typeof callback !== "function") {
                throw new TypeError("[MooMooAPI] resources.onChange requires a callback function.");
            }
            return api.bridge.on("playerValue", function (payload) {
                const key = payload && String(payload.key || "").toLowerCase();
                if (!["food", "wood", "stone", "gold", "points", "score"].includes(key)) return;
                callback({
                    name: key === "points" ? "score" : key,
                    value: numberOrNull(payload.value),
                    resources: get(),
                    raw: payload
                });
            });
        }

        function getCost(itemId) {
            const numericId = Number(itemId);
            const cost = ITEM_COSTS[numericId];
            return cost ? Object.assign({}, cost) : null;
        }

        function canAfford(itemId, quantity) {
            const numericId = Number(itemId);
            const count = quantity === undefined ? 1 : Number(quantity);
            if (!Number.isInteger(count) || count < 1) {
                return {
                    known: false,
                    affordable: null,
                    itemId: numericId,
                    quantity: count,
                    cost: null,
                    reason: "invalid-quantity"
                };
            }

            const unitCost = getCost(numericId);
            if (!unitCost) {
                return {
                    known: false,
                    affordable: null,
                    itemId: numericId,
                    quantity: count,
                    cost: null,
                    reason: "cost-not-known-for-this-item"
                };
            }

            const cost = {
                wood: unitCost.wood * count,
                stone: unitCost.stone * count
            };
            const amounts = get();
            if (amounts.wood === null || amounts.stone === null) {
                return {
                    known: false,
                    affordable: null,
                    itemId: numericId,
                    quantity: count,
                    unitCost: unitCost,
                    cost: cost,
                    resources: amounts,
                    reason: "resource-values-unknown"
                };
            }

            const missing = {};
            if (amounts.wood < cost.wood) missing.wood = cost.wood - amounts.wood;
            if (amounts.stone < cost.stone) missing.stone = cost.stone - amounts.stone;

            return {
                known: true,
                affordable: Object.keys(missing).length === 0,
                itemId: numericId,
                quantity: count,
                unitCost: unitCost,
                cost: cost,
                resources: amounts,
                missing: missing
            };
        }

        return {
            get: get,
            getAmount: getAmount,
            getScore: getScore,
            onChange: onChange,
            getCost: getCost,
            canAfford: canAfford,
            costs: Object.freeze(Object.keys(ITEM_COSTS).reduce(function (result, id) {
                result[id] = Object.freeze(Object.assign({}, ITEM_COSTS[id]));
                return result;
            }, {}))
        };
    });

    // --------------------------------------------------
    // GENERIC UPGRADE TREE HELPERS
    // --------------------------------------------------

    const upgradesModule = api.registerModule("upgrades", function (api) {
        function resolveCategory(category) {
            if (typeof category !== "string" || !category.trim()) {
                throw new TypeError("[MooMooAPI] An upgrade category name is required.");
            }

            const normalized = category.toLowerCase().replace(/[\s_-]/g, "");
            const resolved = UPGRADE_CATEGORY_ALIASES[normalized];
            if (!resolved || !UPGRADE_TREES[resolved]) {
                throw new TypeError("[MooMooAPI] Unknown upgrade category: " + category);
            }
            return resolved;
        }

        function uniqueIds(paths) {
            const ids = [];
            const seen = new Set();
            paths.forEach(function (path) {
                path.forEach(function (id) {
                    if (!seen.has(id)) {
                        seen.add(id);
                        ids.push(id);
                    }
                });
            });
            return ids;
        }

        function getTree(category) {
            const resolved = resolveCategory(category);
            return {
                category: resolved,
                paths: UPGRADE_TREES[resolved].map(function (path) {
                    return path.map(function (id) {
                        return api.items.get(id);
                    });
                })
            };
        }

        function getAvailable(category) {
            const resolved = resolveCategory(category);
            return uniqueIds(UPGRADE_TREES[resolved])
                .filter(function (id) {
                    return api.items.isAvailable(id);
                })
                .map(function (id) {
                    return api.items.get(id);
                });
        }

        function getCurrent(category) {
            const resolved = resolveCategory(category);
            const paths = UPGRADE_TREES[resolved];
            const availableItems = getAvailable(resolved);
            const availableIds = new Set(availableItems.map(function (item) {
                return item.id;
            }));

            // If both an earlier item and its later upgrade are visible, prefer the
            // descendant in that same path instead of reporting the obsolete tier.
            const candidates = availableItems.filter(function (item) {
                return !paths.some(function (path) {
                    const index = path.indexOf(item.id);
                    if (index < 0) return false;

                    return path.slice(index + 1).some(function (laterId) {
                        return availableIds.has(laterId);
                    });
                });
            });

            if (candidates.length === 1) {
                return Object.assign({}, candidates[0], {
                    category: resolved,
                    known: true,
                    ambiguous: false,
                    candidates: candidates
                });
            }

            return {
                category: resolved,
                id: null,
                name: null,
                known: false,
                ambiguous: candidates.length > 1,
                available: availableItems,
                candidates: candidates,
                reason: candidates.length > 1
                    ? "multiple-current-items-visible"
                    : "no-current-item-visible"
            };
        }

        function getCurrentId(category) {
            const current = getCurrent(category);
            return current.known ? current.id : null;
        }

        function getUpgradePath(itemId) {
            const numericId = Number(itemId);
            const item = api.items.get(numericId);
            if (!item) return null;

            const matches = [];
            Object.keys(UPGRADE_TREES).forEach(function (category) {
                UPGRADE_TREES[category].forEach(function (path) {
                    if (path.includes(numericId)) {
                        matches.push({
                            category: category,
                            path: path.map(function (id) {
                                return api.items.get(id);
                            })
                        });
                    }
                });
            });

            return {
                item: item,
                paths: matches
            };
        }

        function getAllCurrent() {
            const result = {};
            Object.keys(UPGRADE_TREES).forEach(function (category) {
                result[category] = getCurrent(category);
            });
            return result;
        }

        function getPrimaryWeaponId() {
            return getCurrentId("primaryWeapon");
        }

        function getSecondaryWeaponId() {
            return getCurrentId("secondaryWeapon");
        }

        function getFoodId() {
            return getCurrentId("food");
        }

        function getWallId() {
            return getCurrentId("wall");
        }

        function getSpikeId() {
            return getCurrentId("spike");
        }

        function getWindmillId() {
            return getCurrentId("windmill");
        }

        return {
            categories: Object.freeze(Object.keys(UPGRADE_TREES)),
            getTree: getTree,
            getAvailable: getAvailable,
            getCurrent: getCurrent,
            getCurrentId: getCurrentId,
            getUpgradePath: getUpgradePath,
            getAllCurrent: getAllCurrent,
            getPrimaryWeaponId: getPrimaryWeaponId,
            getCurrentWeaponId: getPrimaryWeaponId,
            getSecondaryWeaponId: getSecondaryWeaponId,
            getFoodId: getFoodId,
            getWallId: getWallId,
            getSpikeId: getSpikeId,
            getWindmillId: getWindmillId
        };
    });

    // --------------------------------------------------
    // ITEM SELECTION
    // --------------------------------------------------

    const actionsModule = api.registerModule("actions", function () {
        let lastManuallySelectedWeaponId = null;

        function getSelectToBuild() {
            try {
                if (typeof selectToBuild === "function") return selectToBuild;
            } catch (_) {
                // The game may keep this function outside the global lexical scope.
            }

            if (typeof window.selectToBuild === "function") return window.selectToBuild;
            return null;
        }

        function rememberWeapon(id) {
            const numericId = Number(id);
            if (isValidItemId(numericId) &&
                numericId < 16 &&
                api.items.isAvailable(numericId)) {
                lastManuallySelectedWeaponId = numericId;
                return true;
            }
            return false;
        }

        const actionBar = document.getElementById("actionBar");
        if (actionBar) {
            actionBar.addEventListener("click", function (event) {
                if (!(event.target instanceof window.Element)) return;

                const element = event.target.closest(".actionBarItem");
                if (!element || !actionBar.contains(element)) return;

                const match = String(element.id || "").match(/^actionBarItem(\d+)$/);
                if (!match) return;

                const id = Number(match[1]);
                if (id < 16 && api.items.isAvailable(id)) {
                    lastManuallySelectedWeaponId = id;
                }
            }, true);
        }

        function selectItem(itemId, options) {
            const numericId = Number(itemId);
            const settings = Object.assign({ fallbackToDomClick: true }, options || {});

            if (!isValidItemId(numericId)) {
                return {
                    success: false,
                    reason: "invalid-item-id",
                    itemId: itemId
                };
            }

            const method = settings.method || "auto";
            if (!["auto", "selectToBuild", "bridge", "dom"].includes(method)) {
                return { success: false, reason: "invalid-selection-method", itemId: numericId, method: method };
            }

            const element = api.items.getElement(numericId);
            if (!element || !api.items.isAvailable(numericId)) {
                return {
                    success: false,
                    reason: "item-unavailable",
                    itemId: numericId,
                    name: ITEM_NAMES[numericId]
                };
            }

            if (method === "bridge") {
                const result = api.bridge.selectActionBarItem(numericId);
                if (result.success && numericId < 16) lastManuallySelectedWeaponId = numericId;
                return result;
            }

            if (method !== "dom") {
                const selectFunction = getSelectToBuild();
                if (selectFunction) {
                    try {
                        if (numericId < 16) {
                            selectFunction(numericId, true);
                            lastManuallySelectedWeaponId = numericId;
                        } else {
                            selectFunction(numericId - 16);
                        }
                        return {
                            success: true,
                            itemId: numericId,
                            name: ITEM_NAMES[numericId],
                            method: "selectToBuild"
                        };
                    } catch (error) {
                        console.warn("[MooMooAPI] selectToBuild failed; considering bridge/DOM fallback.", error);
                    }
                } else if (method === "selectToBuild") {
                    return {
                        success: false,
                        reason: "selection-function-unavailable",
                        itemId: numericId,
                        name: ITEM_NAMES[numericId]
                    };
                }
            }

            if (method === "auto" && api.bridge.isAvailable()) {
                const result = api.bridge.selectActionBarItem(numericId);
                if (result.success) {
                    if (numericId < 16) lastManuallySelectedWeaponId = numericId;
                    return result;
                }
            }

            if (settings.fallbackToDomClick && typeof element.onclick === "function") {
                try {
                    // Compatibility fallback preserved from the original working script.
                    // Some handlers inspect isTrusted even when called directly.
                    const baseEvent = new window.MouseEvent("click", {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 0
                    });

                    const handlerEvent = new Proxy(baseEvent, {
                        get(target, property) {
                            if (property === "isTrusted") return true;

                            const value = Reflect.get(target, property, target);
                            return typeof value === "function"
                                ? value.bind(target)
                                : value;
                        }
                    });

                    element.onclick.call(element, handlerEvent);
                    if (numericId < 16) lastManuallySelectedWeaponId = numericId;

                    return {
                        success: true,
                        itemId: numericId,
                        name: ITEM_NAMES[numericId],
                        method: "onclick-handler-compat"
                    };
                } catch (error) {
                    console.warn("[MooMooAPI] onclick compatibility fallback failed; trying DOM click.", error);
                }
            }

            if (settings.fallbackToDomClick && typeof element.click === "function") {
                try {
                    element.click();
                    if (numericId < 16) lastManuallySelectedWeaponId = numericId;

                    return {
                        success: true,
                        itemId: numericId,
                        name: ITEM_NAMES[numericId],
                        method: "dom-click"
                    };
                } catch (error) {
                    return {
                        success: false,
                        reason: "dom-click-failed",
                        itemId: numericId,
                        error: error
                    };
                }
            }

            return {
                success: false,
                reason: "selection-function-unavailable",
                itemId: numericId,
                name: ITEM_NAMES[numericId]
            };
        }

        function wait(milliseconds) {
            return new Promise(function (resolve) { window.setTimeout(resolve, milliseconds); });
        }

        function getDirectionRadians(settings) {
            if (isFiniteNumber(settings.directionRadians)) return settings.directionRadians;
            const angle = isFiniteNumber(settings.angle)
                ? settings.angle
                : api.input.getMouseDirection(settings.origin).angle;
            return angle * Math.PI / 180;
        }

        async function useItem(itemId, options) {
            const numericId = Number(itemId);
            const settings = Object.assign({
                method: "auto",
                distance: 80,
                delayMs: 0,
                restoreWeapon: true
            }, options || {});

            if (!isValidItemId(numericId) || numericId < 16) {
                return { success: false, reason: "not-a-consumable-or-build-item", itemId: numericId };
            }
            if (!Number.isFinite(settings.delayMs) || settings.delayMs < 0) {
                return { success: false, reason: "invalid-delay", delayMs: settings.delayMs };
            }

            const state = api.player.get();
            const restoreId = Number.isInteger(settings.restoreItemId)
                ? settings.restoreItemId
                : (state.weaponId !== null
                    ? state.weaponId
                    : (settings.restoreWeapon ? lastManuallySelectedWeaponId : null));

            const selection = selectItem(numericId, settings);
            if (!selection.success) {
                return { success: false, reason: "item-selection-failed", itemId: numericId, selection: selection };
            }

            let action = null;
            let restore = null;
            try {
                if (settings.delayMs > 0) await wait(settings.delayMs);

                if (settings.method === "bridge" || selection.method === "moomoo-bridge") {
                    action = api.bridge.mouse(true, getDirectionRadians(settings));
                } else {
                    action = api.input.click({
                        angle: settings.angle,
                        distance: settings.distance,
                        origin: settings.origin,
                        target: settings.target,
                        button: settings.button,
                        restoreMouse: settings.restoreMouse
                    });
                }
            } finally {
                if (settings.restoreWeapon && restoreId !== null && restoreId >= 0 && restoreId < 16) {
                    restore = selectItem(restoreId, {
                        method: settings.method === "bridge" ? "bridge" : "auto",
                        fallbackToDomClick: settings.fallbackToDomClick
                    });
                }
            }

            return {
                success: Boolean(action && action.success),
                itemId: numericId,
                itemName: ITEM_NAMES[numericId],
                selection: selection,
                action: action,
                restoredWeaponId: restore && restore.success ? restoreId : null,
                note: "A successful result means the action was dispatched, not that the game server accepted it."
            };
        }

        function eat(itemId, options) {
            const numericId = itemId === undefined ? 16 : Number(itemId);
            if (![16, 17, 18].includes(numericId)) {
                return Promise.resolve({ success: false, reason: "not-a-food-item", itemId: numericId });
            }
            return useItem(numericId, options);
        }

        function getLastWeaponId() {
            return lastManuallySelectedWeaponId;
        }

        function setLastWeaponId(id) {
            if (!rememberWeapon(id)) {
                throw new TypeError("[MooMooAPI] setLastWeaponId requires an available weapon ID from 0 to 15.");
            }
            return lastManuallySelectedWeaponId;
        }

        return {
            selectItem: selectItem,
            select: selectItem,
            useItem: useItem,
            eat: eat,
            getLastWeaponId: getLastWeaponId,
            setLastWeaponId: setLastWeaponId
        };
    });

    // --------------------------------------------------
    // BUILD PLACEMENT
    // --------------------------------------------------

    const buildModule = api.registerModule("build", function () {
        function getRestoreWeaponId(settings) {
            if (Number.isInteger(settings.restoreItemId)) return settings.restoreItemId;
            if (!settings.restoreWeapon) return null;
            const currentWeapon = api.player.getCurrentWeaponId();
            if (Number.isInteger(currentWeapon) && currentWeapon >= 0 && currentWeapon < 16) return currentWeapon;
            return api.actions.getLastWeaponId();
        }

        function restoreWeapon(restoreId, settings) {
            if (restoreId !== null && Number.isInteger(restoreId) &&
                restoreId >= 0 && restoreId < 16 && api.items.isAvailable(restoreId)) {
                return api.actions.selectItem(restoreId, {
                    method: settings && settings.method === "bridge" ? "bridge" : "auto"
                });
            }
            return null;
        }

        function dispatchClick(settings, forcedAngle) {
            if (isFiniteNumber(settings.x) && isFiniteNumber(settings.y) &&
                !isFiniteNumber(forcedAngle)) {
                return api.input.clickAt(settings.x, settings.y, settings);
            }

            const clickSettings = {
                distance: isFiniteNumber(settings.distance) ? settings.distance : 80,
                origin: settings.origin,
                target: settings.target,
                button: settings.button,
                restoreMouse: settings.restoreMouse
            };
            if (isFiniteNumber(forcedAngle)) {
                clickSettings.angle = forcedAngle;
            } else if (isFiniteNumber(settings.angle)) {
                clickSettings.angle = settings.angle;
            }

            return api.input.click(clickSettings);
        }

        function dispatchPlacement(settings, forcedAngle, selection) {
            if (settings.method === "bridge" || (selection && selection.method === "moomoo-bridge")) {
                let angle;
                if (isFiniteNumber(settings.directionRadians)) {
                    angle = settings.directionRadians;
                } else {
                    const degrees = isFiniteNumber(forcedAngle)
                        ? forcedAngle
                        : (isFiniteNumber(settings.angle)
                            ? settings.angle
                            : api.input.getMouseDirection(settings.origin).angle);
                    angle = degrees * Math.PI / 180;
                }
                return api.bridge.mouse(true, angle);
            }
            return dispatchClick(settings, forcedAngle);
        }

        function placeItem(itemId, options) {
            const numericId = Number(itemId);
            const settings = Object.assign({
                method: "auto",
                distance: 80,
                restoreWeapon: true
            }, options || {});

            if (!isValidItemId(numericId) || numericId < 16) {
                return {
                    success: false,
                    reason: "not-a-build-item",
                    itemId: numericId
                };
            }

            const restoreId = getRestoreWeaponId(settings);
            const selection = api.actions.selectItem(numericId, settings);
            if (!selection.success) {
                return {
                    success: false,
                    reason: "item-selection-failed",
                    selection: selection
                };
            }

            let clickResult = null;
            let restoreResult = null;
            try {
                clickResult = dispatchPlacement(settings, undefined, selection);
            } finally {
                restoreResult = restoreWeapon(restoreId, settings);
            }

            return {
                success: Boolean(clickResult && clickResult.success),
                itemId: numericId,
                itemName: ITEM_NAMES[numericId],
                selection: selection,
                click: clickResult,
                restoredWeaponId: restoreResult && restoreResult.success ? restoreId : null,
                method: settings.method === "bridge" || (selection && selection.method === "moomoo-bridge") ? "moomoo-bridge" : "dom",
                note: "A successful result means the selected action was dispatched; it does not guarantee server acceptance."
            };
        }

        function waitBetweenPlacements(milliseconds) {
            return new Promise(function (resolve) {
                window.setTimeout(resolve, milliseconds);
            });
        }

        // Select the build item before every placement. MooMoo.io may switch
        // back to the default weapon after a successful placement, so one
        // selection for the whole sequence is not enough.
        async function placeItemAtAngles(itemId, angles, options) {
            const numericId = Number(itemId);
            const suppliedOptions = options || {};
            const settings = Object.assign({
                method: "auto",
                distance: 80,
                intervalMs: suppliedOptions.method === "bridge" ? 111 : 1,
                restoreWeapon: true
            }, suppliedOptions);

            if (!isValidItemId(numericId) || numericId < 16) {
                return { success: false, reason: "not-a-build-item", itemId: numericId };
            }
            if (!Array.isArray(angles) || angles.length === 0 ||
                !angles.every(isFiniteNumber)) {
                return { success: false, reason: "invalid-angles", angles: angles };
            }
            if (!Number.isFinite(settings.intervalMs) || settings.intervalMs < 0) {
                return { success: false, reason: "invalid-interval", intervalMs: settings.intervalMs };
            }

            const restoreId = getRestoreWeaponId(settings);
            const selections = [];
            const clicks = [];
            let selectionFailure = null;
            let restoreResult = null;

            try {
                for (let index = 0; index < angles.length; index++) {
                    if (index > 0 && settings.intervalMs > 0) {
                        await waitBetweenPlacements(settings.intervalMs);
                    }

                    // Reselect on every iteration because the game can auto-select
                    // the Stick after the previous building placement.
                    const selection = api.actions.selectItem(numericId, settings);
                    selections.push(selection);

                    if (!selection.success) {
                        selectionFailure = {
                            index: index,
                            angle: angles[index],
                            selection: selection
                        };
                        break;
                    }

                    clicks.push(dispatchPlacement(settings, angles[index], selection));
                }
            } finally {
                restoreResult = restoreWeapon(restoreId, settings);
            }

            return {
                success: !selectionFailure &&
                    clicks.length === angles.length &&
                    clicks.every(function (result) {
                        return result && result.success;
                    }),
                reason: selectionFailure ? "item-selection-failed" : null,
                itemId: numericId,
                itemName: ITEM_NAMES[numericId],
                angles: angles.slice(),
                intervalMs: settings.intervalMs,
                selection: selections[0] || null,
                selections: selections,
                selectionFailure: selectionFailure,
                clicks: clicks,
                restoredWeaponId: restoreResult && restoreResult.success ? restoreId : null,
                method: settings.method,
                note: "The build item is reselected before every action. DOM mode dispatches synthetic mouse events; bridge mode sends a compatible action sequence. Server acceptance is not guaranteed."
            };
        }

        return {
            placeItem: placeItem,
            place: placeItem,
            placeItemAtAngles: placeItemAtAngles,
            placeAtAngles: placeItemAtAngles
        };
    });

    // Convenient top-level aliases for quick userscript calls.
    api.click = inputModule.click;
    api.clickAt = inputModule.clickAt;
    api.clickAtAngle = inputModule.clickAtAngle;
    api.clickAtOffset = inputModule.clickAtOffset;

    window[API_NAME] = api;
    console.info("[MooMooAPI] Loaded v" + VERSION + ". Available modules:", Object.keys(api.modules));
})(window, document);
