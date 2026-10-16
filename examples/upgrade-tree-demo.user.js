// ==UserScript==
// @name         MooMooAPI - Upgrade Tree Demo
// @namespace    https://github.com/CuteDevNya/MooMooAPI
// @version      0.6.0
// @description  Prints visible current items and their tracked upgrade trees.
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
        console.error("[MooMooAPI Upgrade Demo] The library did not load.");
        return;
    }

    function printCurrentItems() {
        const snapshot = api.upgrades.getAllCurrent();
        const rows = Object.keys(snapshot).map(function (category) {
            const state = snapshot[category];
            return {
                category: category,
                id: state.known ? state.id : null,
                name: state.known ? state.name : null,
                status: state.known
                    ? "Visible"
                    : (state.ambiguous ? "Ambiguous" : "Not visible")
            };
        });

        console.table(rows);
        console.info("[MooMooAPI Upgrade Demo] Current upgrade-tree snapshot:", snapshot);
        return snapshot;
    }

    function onKeyDown(event) {
        if (event.code !== "KeyI" || event.repeat || event.ctrlKey ||
            event.altKey || event.metaKey) return;

        if (event.target instanceof HTMLElement &&
            (event.target.isContentEditable ||
             ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) {
            return;
        }

        event.preventDefault();
        printCurrentItems();
    }

    api.ready().then(function () {
        printCurrentItems();
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("beforeunload", function () {
            window.removeEventListener("keydown", onKeyDown, true);
        }, { once: true });
        console.info("[MooMooAPI Upgrade Demo] Ready. Press I to print the current visible items again.");
    }).catch(function (error) {
        console.error("[MooMooAPI Upgrade Demo] Initialization failed:", error);
    });
})();
