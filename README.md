# MooMooAPI

A modular JavaScript helper library for Tampermonkey userscripts targeting the MooMoo.io browser client.

> **Current status: early development (v0.6.0).** Built-in modules cover action-bar item detection, resource display parsing, generic item-upgrade tree inspection, item selection, and build/click helpers. The game client can change at any time; verify behavior in the current browser client. A successful DOM event dispatch does not prove that the server accepted an action.

## Install with Tampermonkey

Add this metadata line to your userscript:

```javascript
// @require https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js?v=0.6.0
```

Then use the global `MooMooAPI`:

```javascript
const api = await MooMooAPI.ready();

console.log(api.getInfo());
console.log(api.items.getStatus());
```

The library is plain JavaScript and has no build step or third-party dependencies.

## Modules at a glance

| Module | Purpose |
| --- | --- |
| `input` | Synthetic click helpers, coordinates, angles, optional click hotkeys |
| `items` | Item catalog and visible action-bar item detection |
| `resources` | Read food, wood, stone and score from dedicated display elements, with a legacy fallback for gold; query recorded item costs |
| `actions` | Select an action-bar item through the game's `selectToBuild` function when available |
| `build` | Select a build item, click toward the mouse or at explicit angles, and optionally restore a weapon |
| `upgrades` | Inspect visible current items, categories, and item upgrade paths for weapons, food, walls, spikes, windmills, and structures |

These modules are based on observed DOM IDs and functions from a userscript. They are not an official game API.

## Item detection

The known action-bar ID mapping is:

- IDs `0–15`: weapons.
- IDs `16–38`: consumables and build items.
- Build item IDs passed to `selectToBuild` are offset by 16 (for example action-bar item 22 maps to build item ID 6).

```javascript
// One item:
console.log(MooMooAPI.items.get(22));
// { id: 22, name: "Spikes", type: "item", ... }

// Is a particular item currently visible?
console.log(MooMooAPI.items.isAvailable(24));

// Get only visible items:
console.table(MooMooAPI.items.getAvailable());

// Full status table:
MooMooAPI.items.showStatus();
```

The current catalog contains:

| ID | Name | ID | Name |
| ---: | --- | ---: | --- |
| 0 | Tool Hammer | 20 | Stone Wall |
| 1 | Hand Axe | 21 | Castle Wall |
| 2 | Great Axe | 22 | Spikes |
| 3 | Short Sword | 23 | Greater Spikes |
| 4 | Katana | 24 | Poison Spikes |
| 5 | Polearm | 25 | Spinning Spikes |
| 6 | Bat | 26 | Windmill |
| 7 | Daggers | 27 | Faster Windmill |
| 8 | Stick | 28 | Power Mill |
| 9 | Hunting Bow | 29 | Mine |
| 10 | Great Hammer | 30 | Sapling |
| 11 | Wooden Shield | 31 | Pit Trap |
| 12 | Crossbow | 32 | Boost Pad |
| 13 | Repeater Crossbow | 33 | Turret |
| 14 | Mc Grabby | 34 | Platform |
| 15 | Musket | 35 | Healing Pad |
| 16 | Apple | 36 | Spawn Pad |
| 17 | Cookie | 37 | Blocker |
| 18 | Cheese | 38 | Teleporter |
| 19 | Wood Wall | | |

“Available” currently means the matching `#actionBarItem<ID>` element exists and is visible in the DOM. This does not independently verify server-side unlock state.

## Resources

Food, wood, and stone are read from the `innerHTML` of `#foodDisplay`, `#woodDisplay`, and `#stoneDisplay`. The API falls back to the matching child of `#resDisplay` if one of those dedicated elements is unavailable or unparsable. Score is read from `#scoreDisplay` and exposed separately; legacy gold is still read from the fourth child of `#resDisplay` when present.

```javascript
const resources = MooMooAPI.resources.get();
console.log(resources);
// { food: ..., wood: ..., stone: ..., score: ..., gold: ..., known: true }

console.log(MooMooAPI.resources.getAmount("wood"));
console.log(MooMooAPI.resources.getScore()); // Same as getAmount("score")
console.log(MooMooAPI.resources.canAfford(24)); // Poison Spikes, one placement
console.log(MooMooAPI.resources.canAfford(24, 4)); // Resources for four Poison Spikes
```

If a value is missing or cannot be parsed, the API returns `null` for that value instead of assuming the player can afford an item. The `known` flag requires food, wood, and stone; score is independent of that flag. Only the following spike costs have been added from the supplied userscript; costs for other items are not yet known here:

| Item ID | Spike variant | Wood | Stone |
| ---: | --- | ---: | ---: |
| 22 | Spikes | 20 | 5 |
| 23 | Greater Spikes | 30 | 10 |
| 24 | Poison Spikes | 35 | 15 |
| 25 | Spinning Spikes | 30 | 20 |

## Selecting items

```javascript
// Select a weapon:
console.log(MooMooAPI.actions.selectItem(0));

// Select an action-bar item:
console.log(MooMooAPI.actions.selectItem(24));

// Force-disable the DOM fallback:
MooMooAPI.actions.selectItem(24, { fallbackToDomClick: false });

// You can explicitly remember the weapon to restore after building:
MooMooAPI.actions.setLastWeaponId(3);
console.log(MooMooAPI.actions.getLastWeaponId());
```

Selection now preserves the invocation style from the original working script: `selectToBuild(itemId, true)` for weapons and `selectToBuild(itemId - 16)` for build items, without binding a new `this` context. If that function is unavailable, the API attempts the original `onclick` compatibility fallback before trying `.click()`. The compatibility fallback cannot make a browser-generated trusted event; it only supplies a Proxy to a directly invoked handler.

The API remembers a weapon when the user clicks a visible weapon in the action bar, or when a weapon is selected through `MooMooAPI.actions.selectItem`. Keyboard-based game selections may not be observable through this mechanism; set the restore ID explicitly when necessary.

## Click helpers

By default, the input module dispatches mouse events to `#touch-controls-fullscreen`, matching the working click script that started this project. Change the target with `input.setDefaultTarget(...)` or override it for an individual call.

### Click a specific screen coordinate

Coordinates are viewport CSS pixels, the same coordinate system used by `MouseEvent.clientX` and `clientY`.

```javascript
MooMooAPI.input.clickAt(640, 280);
MooMooAPI.input.clickAt({ x: 640, y: 280 });

MooMooAPI.input.clickAt(640, 280, {
    target: "#touch-controls-fullscreen",
    button: "left",       // "left", "middle", "right", or 0, 1, 2
    restoreMouse: true
});
```

### Click toward the mouse, or use an explicit angle

Angles use screen coordinates: **0° = right, 90° = down, 180° = left, 270° = up**. The default origin is the center of the viewport.

```javascript
// Aim toward the current real mouse position and click 80px from the center:
MooMooAPI.input.click();

// The empty configuration form behaves the same:
MooMooAPI.input.click({});

// Inspect the current direction:
console.log(MooMooAPI.input.getMouseDirection());

// Use an explicit angle instead:
MooMooAPI.input.click({ angle: 0, distance: 120 });
MooMooAPI.input.clickAtAngle(90, 100);
MooMooAPI.input.click(90, 100);
```

If the mouse is exactly at the center of the viewport, the default direction falls back to 270° (up). An explicitly supplied `angle` always takes priority over the mouse direction.

You can select a different origin:

```javascript
MooMooAPI.input.click({
    origin: { x: 300, y: 200 },
    angle: 0,
    distance: 80
});

MooMooAPI.input.click({
    origin: "mouse",
    angle: 180,
    distance: 50
});
```

### Click using offsets or at the center

```javascript
MooMooAPI.input.clickAtOffset(30, -20);
MooMooAPI.input.clickCenter();

// Top-level shortcuts:
MooMooAPI.clickAt(640, 280);
MooMooAPI.clickAtAngle(270, 80);
MooMooAPI.clickAtOffset(30, -20);
```

### Optional click hotkey

```javascript
const unbind = MooMooAPI.input.bindClickHotkey(
    "KeyN",
    { angle: 270, distance: 80 },
    { preventDefault: true, ignoreInputs: true, ignoreRepeat: true }
);

// Later:
// unbind();
```

## Build placement

```javascript
// Select item 31 (Pit Trap) and click 80px in the direction of the mouse:
console.log(MooMooAPI.build.placeItem(31, {
    distance: 80,
    restoreWeapon: true
}));

// Explicit angle overrides mouse direction:
MooMooAPI.build.placeItem(24, {
    angle: 270,
    distance: 80
});

// Place one item at several angles after selecting it just once:
await MooMooAPI.build.placeItemAtAngles(22, [270, 0, 90, 180], {
    distance: 80,
    intervalMs: 1,
    restoreWeapon: true
});
```

The multi-angle helper reselects the build item before every click, because the game may switch back to the Stick after placement. It uses `intervalMs: 1` by default, introducing a minimal yield between selection/click pairs so the client can process each one separately. You can increase `intervalMs` if the client needs extra time. Use `await` with `placeItemAtAngles`. The server may still reject an individual placement. If no restore weapon has been detected, the build item can remain selected unless `restoreItemId` is provided.

## Upgrade trees and current items

The `upgrades` module reads the items that are currently visible in the game's action bar. It does **not** claim to know which item is selected in the player's hand at this exact moment. A result with `id: null` means no item was visible in that category or the visible items were ambiguous; the API will not guess between competing end branches.

```javascript
// IDs refer to the action-bar item IDs used by MooMooAPI.
console.log(MooMooAPI.upgrades.getPrimaryWeaponId());   // Short Sword, Katana, Stick, etc.
console.log(MooMooAPI.upgrades.getSecondaryWeaponId()); // Bow, Crossbow, Great Hammer, Shield, etc.
console.log(MooMooAPI.upgrades.getFoodId());             // Apple, Cookie, or Cheese
console.log(MooMooAPI.upgrades.getWallId());             // Wood Wall, Stone Wall, or Castle Wall
console.log(MooMooAPI.upgrades.getSpikeId());            // Spikes, Greater, Poison, or Spinning
console.log(MooMooAPI.upgrades.getWindmillId());         // Windmill, Faster Windmill, or Power Mill

// Generic category methods:
console.log(MooMooAPI.upgrades.getCurrentId("secondaryWeapon"));
console.log(MooMooAPI.upgrades.getCurrent("food"));
console.log(MooMooAPI.upgrades.getAvailable("spikes"));
console.log(MooMooAPI.upgrades.getTree("spikes"));
console.log(MooMooAPI.upgrades.getUpgradePath(24)); // Paths which include Poison Spikes
console.log(MooMooAPI.upgrades.getAllCurrent());
```

The known upgrade lines in the built-in catalog are:

| Category | Upgrade line(s) |
| --- | --- |
| Primary weapon | Tool Hammer (0); Hand Axe (1) → Great Axe (2); Short Sword (3) → Katana (4); Polearm (5), Bat (6), Daggers (7), Stick (8) |
| Secondary weapon | Hunting Bow (9) → Crossbow (12) → Repeater Crossbow (13) **or** Musket (15); Great Hammer (10), Wooden Shield (11), Mc Grabby (14) |
| Food | Apple (16) → Cookie (17) → Cheese (18) |
| Walls | Wood Wall (19) → Stone Wall (20) → Castle Wall (21) |
| Spikes | Spikes (22) → Greater Spikes (23) → Poison Spikes (24) **or** Spinning Spikes (25) |
| Windmills | Windmill (26) → Faster Windmill (27) → Power Mill (28) |
| Other structures | Mine (29), Sapling (30), Pit Trap (31), Boost Pad (32), Turret (33), Platform (34), Healing Pad (35), Spawn Pad (36), Blocker (37), Teleporter (38) |

`getTree(category)` returns the complete tracked paths for a category, with item metadata including the age at which the item is listed as unlocked. `getUpgradePath(itemId)` returns every tracked path containing that item; it can return more than one path for a branch point such as Crossbow.

These names and paths were cross-checked against the community-maintained [MooMoo.io Wiki's Hotbar page](https://moomooio.fandom.com/wiki/Hotbar) and [Age page](https://moomooio.fandom.com/wiki/Age). They reflect the currently documented item tree, not a guarantee that the live client will never change.

See [examples/upgrade-tree-demo.user.js](examples/upgrade-tree-demo.user.js) for a category snapshot and [examples/build-item-demo.user.js](examples/build-item-demo.user.js) for generic build placement. The [click demo](examples/click-demo.user.js) shows how to bind an optional keyboard shortcut.

## Adding new functionality

Features are organized as modules. Register a new module from your own userscript or add a built-in module to the project:

```javascript
MooMooAPI.registerModule("example", (api) => ({
    hello() {
        return "Hello from an extension!";
    },
    getLibraryInfo() {
        return api.getInfo();
    }
}));

console.log(MooMooAPI.example.hello());
```

Each module factory receives the main API object and returns an object of functions. The module is available as both `MooMooAPI.example` and `MooMooAPI.modules.example`. Module names must be unique and must not replace an existing API property.

## Important limitations

- This is a browser-side userscript library, not a server API.
- The click helpers dispatch **synthetic** DOM mouse events. These events have `isTrusted === false`; the game may ignore them or change its event target.
- A successful click result means that the event sequence was dispatched, not that a server-side action was accepted.
- DOM IDs, resource ordering, item IDs, and internal functions can change after game updates.
- The game can validate resources, placements, shop purchases and other actions server-side. The library does not bypass server-side validation.
- Use userscripts in ways that comply with the game's rules and applicable terms.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions for adding modules and documenting verified behavior.

## License

No license has been added yet. Until a license is chosen, the repository's default copyright applies.
