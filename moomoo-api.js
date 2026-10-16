/*!
 * MooMooAPI v0.2.3
 * A modular, client-side helper library for MooMoo.io userscripts.
 * https://github.com/CuteDevNya/MooMooAPI
 */
(function (window, document) {
    "use strict";

    const API_NAME = "MooMooAPI";
    const VERSION = "0.2.3";

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
            const angle = isFiniteNumber(settings.angle) ? settings.angle : 270;
            const radius = isFiniteNumber(settings.distance) ? settings.distance : 80;
            const radians = angle * Math.PI / 180;
            const x = origin.x + Math.cos(radians) * radius;
            const y = origin.y + Math.sin(radians) * radius;

            return clickAt(x, y, settings);
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
            bindClickHotkey: bindClickHotkey
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
        14: "MC Grabby",
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

    const SPIKE_PRIORITY = [24, 25, 23, 22];

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
    // RESOURCE COUNTS AND KNOWN ITEM COSTS
    // --------------------------------------------------

    const resourcesModule = api.registerModule("resources", function () {
        function parseAmount(element) {
            if (!element) return null;

            const text = String(element.textContent || "").trim();
            const match = text.match(/-?\d[\d,]*/);
            if (!match) return null;

            const value = Number.parseInt(match[0].replace(/,/g, ""), 10);
            return Number.isFinite(value) ? value : null;
        }

        function get() {
            const display = document.getElementById("resDisplay");
            const children = display ? display.children : null;

            if (!children || children.length < 3) {
                return {
                    known: false,
                    food: null,
                    wood: null,
                    stone: null,
                    gold: null,
                    reason: "resource-display-not-found-or-incomplete"
                };
            }

            const result = {
                food: parseAmount(children[0]),
                wood: parseAmount(children[1]),
                stone: parseAmount(children[2]),
                gold: children.length >= 4 ? parseAmount(children[3]) : null
            };

            result.known = result.food !== null &&
                result.wood !== null &&
                result.stone !== null;

            if (!result.known) result.reason = "resource-values-could-not-be-parsed";
            return result;
        }

        function getAmount(resourceName) {
            const state = get();
            const name = String(resourceName).toLowerCase();

            if (!["food", "wood", "stone", "gold"].includes(name)) {
                throw new TypeError("[MooMooAPI] Unknown resource: " + resourceName);
            }
            return state[name];
        }

        function getCost(itemId) {
            const numericId = Number(itemId);
            const cost = ITEM_COSTS[numericId];
            return cost ? Object.assign({}, cost) : null;
        }

        function canAfford(itemId) {
            const cost = getCost(itemId);
            if (!cost) {
                return {
                    known: false,
                    affordable: null,
                    itemId: Number(itemId),
                    cost: null,
                    reason: "cost-not-known-for-this-item"
                };
            }

            const amounts = get();
            if (amounts.wood === null || amounts.stone === null) {
                return {
                    known: false,
                    affordable: null,
                    itemId: Number(itemId),
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
                itemId: Number(itemId),
                cost: cost,
                resources: amounts,
                missing: missing
            };
        }

        return {
            get: get,
            getAmount: getAmount,
            getCost: getCost,
            canAfford: canAfford,
            costs: Object.freeze(Object.keys(ITEM_COSTS).reduce(function (result, id) {
                result[id] = Object.freeze(Object.assign({}, ITEM_COSTS[id]));
                return result;
            }, {}))
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

            const element = api.items.getElement(numericId);
            if (!element || !api.items.isAvailable(numericId)) {
                return {
                    success: false,
                    reason: "item-unavailable",
                    itemId: numericId,
                    name: ITEM_NAMES[numericId]
                };
            }

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
                    console.warn("[MooMooAPI] selectToBuild failed; considering DOM fallback.", error);
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
            getLastWeaponId: getLastWeaponId,
            setLastWeaponId: setLastWeaponId
        };
    });

    // --------------------------------------------------
    // BUILD PLACEMENT
    // --------------------------------------------------

    const buildModule = api.registerModule("build", function () {
        function placeItem(itemId, options) {
            const numericId = Number(itemId);
            const settings = Object.assign({
                angle: 270,
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

            const restoreId = Number.isInteger(settings.restoreItemId)
                ? settings.restoreItemId
                : (settings.restoreWeapon ? api.actions.getLastWeaponId() : null);

            const selection = api.actions.selectItem(numericId, settings);
            if (!selection.success) {
                return {
                    success: false,
                    reason: "item-selection-failed",
                    selection: selection
                };
            }

            let clickResult;
            try {
                if (isFiniteNumber(settings.x) && isFiniteNumber(settings.y)) {
                    clickResult = api.input.clickAt(settings.x, settings.y, settings);
                } else {
                    clickResult = api.input.click({
                        angle: isFiniteNumber(settings.angle) ? settings.angle : 270,
                        distance: isFiniteNumber(settings.distance) ? settings.distance : 80,
                        origin: settings.origin,
                        target: settings.target,
                        button: settings.button,
                        restoreMouse: settings.restoreMouse
                    });
                }
            } finally {
                if (restoreId !== null &&
                    Number.isInteger(restoreId) &&
                    restoreId >= 0 &&
                    restoreId < 16 &&
                    api.items.isAvailable(restoreId)) {
                    const restoreResult = api.actions.selectItem(restoreId);
                    settings._restoreResult = restoreResult;
                }
            }

            return {
                success: Boolean(clickResult && clickResult.success),
                itemId: numericId,
                itemName: ITEM_NAMES[numericId],
                selection: selection,
                click: clickResult || null,
                restoredWeaponId: settings._restoreResult && settings._restoreResult.success
                    ? restoreId
                    : null,
                note: "A successful click result means mouse events were dispatched; it does not guarantee server acceptance."
            };
        }

        return {
            placeItem: placeItem,
            place: placeItem
        };
    });

    // --------------------------------------------------
    // SPIKE HELPERS
    // --------------------------------------------------

    const spikesModule = api.registerModule("spikes", function () {
        function getAvailable(options) {
            const settings = Object.assign({ checkResources: true }, options || {});
            const result = [];

            for (const itemId of SPIKE_PRIORITY) {
                if (!api.items.isAvailable(itemId)) continue;

                const affordability = settings.checkResources
                    ? api.resources.canAfford(itemId)
                    : { known: false, affordable: null, reason: "resource-check-disabled" };

                result.push({
                    id: itemId,
                    name: ITEM_NAMES[itemId],
                    available: true,
                    affordability: affordability
                });
            }

            return result;
        }

        function getBestAvailable(options) {
            // Match the original macro: if the resource display cannot be read,
            // continue by priority rather than preventing item selection entirely.
            // Set unknownResources: "reject" to require a known resource state.
            const settings = Object.assign({
                checkResources: true,
                unknownResources: "allow"
            }, options || {});
            const candidates = getAvailable(settings);

            if (!candidates.length) {
                return {
                    success: false,
                    reason: "no-spike-available",
                    candidates: []
                };
            }

            if (!settings.checkResources) {
                return {
                    success: true,
                    item: candidates[0],
                    candidates: candidates,
                    resourceCheck: "skipped"
                };
            }

            const best = candidates.find(function (candidate) {
                return candidate.affordability.affordable === true;
            });

            if (best) {
                return {
                    success: true,
                    item: best,
                    candidates: candidates,
                    resourceCheck: "passed"
                };
            }

            const unknown = candidates.filter(function (candidate) {
                return candidate.affordability.affordable === null;
            });

            if (unknown.length) {
                if (settings.unknownResources === "reject") {
                    return {
                        success: false,
                        reason: "resource-state-unknown",
                        candidates: candidates,
                        resourceCheck: "unknown"
                    };
                }

                return {
                    success: true,
                    item: unknown[0],
                    candidates: candidates,
                    resourceCheck: "unknown",
                    warning: "Resource values could not be read; using spike priority without affordability verification."
                };
            }

            return {
                success: false,
                reason: "not-enough-resources",
                candidates: candidates,
                resourceCheck: "failed"
            };
        }

        function placeBest(options) {
            const settings = Object.assign({
                checkResources: true,
                unknownResources: "allow",
                angle: 270,
                distance: 80,
                restoreWeapon: true
            }, options || {});

            const chosen = getBestAvailable({
                checkResources: settings.checkResources,
                unknownResources: settings.unknownResources
            });

            if (!chosen.success) return chosen;

            const result = api.build.placeItem(chosen.item.id, settings);
            result.resourceCheck = chosen.resourceCheck;
            if (chosen.warning) result.warning = chosen.warning;
            return result;
        }

        function bindHotkey(code, options, hotkeyOptions) {
            if (typeof code !== "string" || !code) {
                throw new TypeError("[MooMooAPI] bindHotkey requires a KeyboardEvent.code string.");
            }

            const placementOptions = Object.assign({}, options || {});
            const keySettings = Object.assign({
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
                if (keySettings.ignoreRepeat && event.repeat) return;
                if (keySettings.ignoreInputs && isEditableTarget(event.target)) return;
                if (event.ctrlKey || event.altKey || event.metaKey) return;

                if (keySettings.preventDefault) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                const result = placeBest(placementOptions);
                if (!result.success) {
                    console.warn("[MooMooAPI] Spike placement did not complete:", result);
                } else if (result.warning) {
                    console.warn("[MooMooAPI] Spike placement used a fallback:", result.warning, result);
                }
            }

            window.addEventListener("keydown", onKeyDown, true);
            return function unbindSpikeHotkey() {
                window.removeEventListener("keydown", onKeyDown, true);
            };
        }

        return {
            priority: SPIKE_PRIORITY.slice(),
            getAvailable: getAvailable,
            getBestAvailable: getBestAvailable,
            placeBest: placeBest,
            bindHotkey: bindHotkey
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
