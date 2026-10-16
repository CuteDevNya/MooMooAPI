// ==UserScript==
// @name         MooMooAPI - Click Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.2.0
// @description  Demo hotkey for MooMooAPI click helpers.
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
        console.error("[MooMooAPI Demo] The library did not load.");
        return;
    }

    api.ready().then(function () {
        // Press N to click 80 pixels above the viewport center.
        const unbind = api.input.bindClickHotkey(
            "KeyN",
            {
                angle: 270,
                distance: 80
            },
            {
                preventDefault: true,
                ignoreInputs: true,
                ignoreRepeat: true
            }
        );

        console.info("[MooMooAPI Demo] Ready. Press N to test a click.");

        // Remove the listener if the page is about to unload.
        window.addEventListener("beforeunload", unbind, { once: true });
    }).catch(function (error) {
        console.error("[MooMooAPI Demo] Failed to initialize:", error);
    });
})();
