// ==UserScript==
// @name         MooMooAPI - Spike Macro Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.2.1
// @description  Demonstrates the MooMooAPI spike selector and placement helper.
// @match        https://moomoo.io/*
// @match        https://*.moomoo.io/*
// @run-at       document-idle
// @grant        none
// @require      https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js
// ==/UserScript==

(function () {
    "use strict";

    const api = window.MooMooAPI;

    if (!api) {
        console.error("[MooMooAPI Spike Demo] The library did not load.");
        return;
    }

    api.ready().then(function () {
        console.info("[MooMooAPI Spike Demo] Loaded. Current visible item status:");
        api.items.showStatus();

        // Press N to try the highest-priority visible spike that is affordable.
        // No hotkey is registered unless this userscript explicitly binds it.
        const unbind = api.spikes.bindHotkey("KeyN", {
            angle: 270,
            distance: 80,
            checkResources: true,
            unknownResources: "allow",
            restoreWeapon: true
        });

        console.info("[MooMooAPI Spike Demo] Ready. Press N to try placing a spike.");
        console.info("[MooMooAPI Spike Demo] If resource text cannot be parsed, the macro continues by priority and logs a warning.");

        window.addEventListener("beforeunload", unbind, { once: true });
    }).catch(function (error) {
        console.error("[MooMooAPI Spike Demo] Initialization failed:", error);
    });
})();
