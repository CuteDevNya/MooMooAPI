// ==UserScript==
// @name         MooMooAPI - Mouse Trap and Four Spikes
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.5.0
// @description  Press F to place a trap (or boost pad fallback) toward the mouse, or N to place spikes in four directions.
// @match        https://moomoo.io/*
// @match        https://*.moomoo.io/*
// @run-at       document-idle
// @grant        none
// @require      https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js?v=0.5.0
// ==/UserScript==

(function () {
    "use strict";

    const api = window.MooMooAPI;

    if (!api) {
        console.error("[MooMooAPI Example] The API did not load.");
        return;
    }

    let busy = false;

    function isEditableTarget(target) {
        if (!(target instanceof HTMLElement)) return false;

        return target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    async function onKeyDown(event) {
        if (event.code !== "KeyF" && event.code !== "KeyN") return;
        if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
        if (isEditableTarget(event.target)) return;
        if (busy) return;

        event.preventDefault();
        event.stopPropagation();

        busy = true;

        try {
            let result;

            if (event.code === "KeyF") {
                // Prefer Pit Trap (31); fall back to Boost Pad (32) if the trap is unavailable.
                // No explicit angle is passed: the API aims toward the real mouse pointer.
                const itemId = api.items.isAvailable(31)
                    ? 31
                    : (api.items.isAvailable(32) ? 32 : null);

                if (itemId === null) {
                    console.warn("[MooMooAPI Example] Neither Pit Trap nor Boost Pad is available.");
                    return;
                }

                result = await api.build.placeItem(itemId, {
                    distance: 80,
                    restoreWeapon: true
                });

                if (!result.success) {
                    console.warn("[MooMooAPI Example] Trap/boost-pad placement failed:", result);
                } else {
                    console.info(
                        itemId === 31
                            ? "[MooMooAPI Example] Pit Trap placement attempted toward the mouse."
                            : "[MooMooAPI Example] Boost Pad fallback placement attempted toward the mouse.",
                        result
                    );
                }
            } else {
                // Highest-priority visible and affordable spike variant.
                // Reselect the spike before every placement because the game may
                // switch back to the Stick after each placement. A 1ms interval lets
                // the client process each selection/click pair separately.
                result = await api.spikes.placeCross({
                    angles: [270, 0, 90, 180], // Up, right, down, left
                    distance: 80,
                    intervalMs: 1,
                    checkResources: true,
                    unknownResources: "allow",
                    restoreWeapon: true
                });

                if (!result.success) {
                    console.warn("[MooMooAPI Example] Four-way spike placement failed:", result);
                } else {
                    console.info("[MooMooAPI Example] Four-way spike placement attempted.", result);
                    if (result.warning) {
                        console.warn("[MooMooAPI Example] Resource warning:", result.warning);
                    }
                }
            }
        } catch (error) {
            console.error("[MooMooAPI Example] Unexpected error:", error);
        } finally {
            busy = false;
        }
    }

    api.ready().then(function () {
        window.addEventListener("keydown", onKeyDown, true);

        console.info("[MooMooAPI Example] Ready.");
        console.info("[MooMooAPI Example] F: place a Pit Trap toward the mouse, or a Boost Pad if traps are unavailable.");
        console.info("[MooMooAPI Example] N: rapidly place spikes up, right, down, and left.");
    }).catch(function (error) {
        console.error("[MooMooAPI Example] Initialization failed:", error);
    });
})();
