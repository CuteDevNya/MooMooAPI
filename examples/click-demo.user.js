// ==UserScript==
// @name         MooMooAPI - Click Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.5.0
// @description  Demo hotkey for MooMooAPI click helpers.
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
        console.error("[MooMooAPI Demo] The library did not load.");
        return;
    }

    api.ready().then(function () {
        // Press N to click 80 pixels in the direction of the current mouse pointer.
        const unbind = api.input.bindClickHotkey(
            "KeyN",
            {
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
