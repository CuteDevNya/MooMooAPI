// ==UserScript==
// @name         MooMooAPI - Player State Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.7.0
// @description  Inspect player state and listen for health changes when a compatible bridge is present.
// @match        https://moomoo.io/*
// @match        https://*.moomoo.io/*
// @run-at       document-idle
// @grant        none
// @require      https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js?v=0.7.0
// ==/UserScript==

(function () {
    "use strict";

    const api = window.MooMooAPI;
    if (!api) {
        console.error("[MooMooAPI Player Demo] The API did not load.");
        return;
    }

    function printState() {
        console.info("[MooMooAPI Player Demo] Bridge capabilities:", api.bridge.getCapabilities());
        console.info("[MooMooAPI Player Demo] Player state:", api.player.get());
    }

    function onKeyDown(event) {
        if (event.code !== "KeyI" || event.repeat ||
            event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.target instanceof HTMLElement &&
            (event.target.isContentEditable ||
             ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
        event.preventDefault();
        printState();
    }

    let unbindHealth = null;
    let unbindDeath = null;

    api.ready().then(function () {
        printState();
        unbindHealth = api.player.onHealthChange(function (event) {
            console.info("[MooMooAPI Player Demo] Health changed:", event.previousHealth, "->", event.health);
        });
        unbindDeath = api.player.onDeath(function () {
            console.info("[MooMooAPI Player Demo] Death event received.");
        });
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("beforeunload", function () {
            window.removeEventListener("keydown", onKeyDown, true);
            if (typeof unbindHealth === "function") unbindHealth();
            if (typeof unbindDeath === "function") unbindDeath();
        }, { once: true });
        console.info("[MooMooAPI Player Demo] Ready. Press I to print the player snapshot.");
    }).catch(function (error) {
        console.error("[MooMooAPI Player Demo] Initialization failed:", error);
    });
})();
