/*!
 * MooMooAPI v0.1.0
 * A modular, client-side helper library for MooMoo.io userscripts.
 * https://github.com/CuteDevNya/MooMooAPI
 */
(function (window, document) {
    "use strict";

    const API_NAME = "MooMooAPI";
    const VERSION = "0.1.0";

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

    // Convenient top-level aliases for quick userscript calls.
    api.click = inputModule.click;
    api.clickAt = inputModule.clickAt;
    api.clickAtAngle = inputModule.clickAtAngle;
    api.clickAtOffset = inputModule.clickAtOffset;

    window[API_NAME] = api;
    console.info("[MooMooAPI] Loaded v" + VERSION + ". Available modules:", Object.keys(api.modules));
})(window, document);
