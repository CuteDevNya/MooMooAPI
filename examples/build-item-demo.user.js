// ==UserScript==
// @name         MooMooAPI - Build Item Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.6.0
// @description  Press F to place a visible Pit Trap or Boost Pad toward the mouse.
// @match        https://moomoo.io/*
// @match        https://*.moomoo.io/*
// @run-at       document-idle
// @grant        none
// @require      https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js?v=0.6.0
// ==/UserScript==

(function () {
    "use strict";

    const api = window.MooMooAPI;
    if (!api) {
        console.error("[MooMooAPI Build Demo] The library did not load.");
        return;
    }

    let busy = false;

    function isEditableTarget(target) {
        if (!(target instanceof HTMLElement)) return false;
        return target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    async function onKeyDown(event) {
        if (event.code !== "KeyF" || event.repeat || event.ctrlKey ||
            event.altKey || event.metaKey || isEditableTarget(event.target) || busy) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        busy = true;

        try {
            const itemId = api.items.isAvailable(31)
                ? 31
                : (api.items.isAvailable(32) ? 32 : null);

            if (itemId === null) {
                console.warn("[MooMooAPI Build Demo] Neither Pit Trap nor Boost Pad is visible in the action bar.");
                return;
            }

            const result = await api.build.placeItem(itemId, {
                distance: 80,
                restoreWeapon: true
            });

            if (!result.success) {
                console.warn("[MooMooAPI Build Demo] Placement did not complete:", result);
            } else {
                console.info("[MooMooAPI Build Demo] Build placement attempted:", result);
            }
        } catch (error) {
            console.error("[MooMooAPI Build Demo] Unexpected error:", error);
        } finally {
            busy = false;
        }
    }

    api.ready().then(function () {
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("beforeunload", function () {
            window.removeEventListener("keydown", onKeyDown, true);
        }, { once: true });
        console.info("[MooMooAPI Build Demo] Ready. Press F to attempt a build-item placement toward the mouse.");
    }).catch(function (error) {
        console.error("[MooMooAPI Build Demo] Initialization failed:", error);
    });
})();
