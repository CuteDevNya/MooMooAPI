# MooMooAPI

A modular JavaScript helper library for Tampermonkey userscripts targeting the MooMoo.io browser client.

> **Current status: early development (v0.2.3).** Built-in modules currently cover action-bar item detection, resource display parsing, item selection, click helpers, and a first spike-placement helper. The official game can change at any time; verify behavior in the current browser client. A successful DOM event dispatch does not prove that the server accepted an action.

## Install with Tampermonkey

Add this metadata line to your userscript:

```javascript
// @require https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js?v=0.2.3
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
| `resources` | Read food, wood, stone and gold from the current resource display; known spike costs |
| `actions` | Select an action-bar item through the game's `selectToBuild` function when available |
| `build` | Select a build item, click a target, and optionally restore a weapon |
| `spikes` | Pick the best visible spike variant by priority and optionally place it with a hotkey |

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
| 14 | MC Grabby | 34 | Platform |
| 15 | Musket | 35 | Healing Pad |
| 16 | Apple | 36 | Spawn Pad |
| 17 | Cookie | 37 | Blocker |
| 18 | Cheese | 38 | Teleporter |
| 19 | Wood Wall | | |

“Available” currently means the matching `#actionBarItem<ID>` element exists and is visible in the DOM. This does not independently verify server-side unlock state.

## Resources

Resource counts are read from the children of `#resDisplay`, in this observed order: food, wood, stone, gold.

```javascript
const resources = MooMooAPI.resources.get();
console.log(resources);
// { food: ..., wood: ..., stone: ..., gold: ..., known: true }

console.log(MooMooAPI.resources.getAmount("wood"));
console.log(MooMooAPI.resources.canAfford(24)); // Poison Spikes
```

If the element is missing or a number cannot be parsed, the API returns `null` for unknown values instead of assuming the player can afford an item. Only the following spike costs have been added from the supplied userscript; costs for other items are not yet known here:

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

### Click by angle and distance

Angles use screen coordinates: **0° = right, 90° = down, 180° = left, 270° = up**. The default origin is the center of the viewport.

```javascript
// 80 pixels above the center (the original script's behavior):
MooMooAPI.input.click();

// 120 pixels to the right:
MooMooAPI.input.click({ angle: 0, distance: 120 });

// 100 pixels down:
MooMooAPI.input.clickAtAngle(90, 100);

// Shorthand:
MooMooAPI.input.click(90, 100);
```

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
// Select action-bar item 24, click 80px above screen center,
// then restore the last remembered weapon if one is known.
console.log(MooMooAPI.build.placeItem(24, {
    angle: 270,
    distance: 80,
    restoreWeapon: true
}));

// Click at a precise viewport position instead:
MooMooAPI.build.placeItem(24, {
    x: 640,
    y: 280,
    restoreItemId: 3
});
```

This is a fast sequence with no intentional delay. It is not proof that the game accepted the item placement. If no restore weapon has been detected, the build item can remain selected unless `restoreItemId` is provided.

## Spike helpers

The priority, highest first, is Poison Spikes (24), Spinning Spikes (25), Greater Spikes (23), and normal Spikes (22).

```javascript
// Inspect visible spike variants and resource affordability:
console.log(MooMooAPI.spikes.getAvailable());
console.log(MooMooAPI.spikes.getBestAvailable());

// Attempt to place the best affordable visible variant:
console.log(MooMooAPI.spikes.placeBest({
    angle: 270,
    distance: 80,
    checkResources: true,
    restoreWeapon: true
}));
```

To make a macro, bind a key explicitly. No key is bound automatically by loading the library:

```javascript
const unbindSpikes = MooMooAPI.spikes.bindHotkey("KeyN", {
    angle: 270,
    distance: 80,
    checkResources: true,
    restoreWeapon: true
});

// Later, to remove the key listener:
// unbindSpikes();
```

If resource values cannot be read, `placeBest` now follows the original macro's behavior and continues by spike priority, returning `resourceCheck: "unknown"` and a warning. Set `unknownResources: "reject"` to stop instead. Set `checkResources: false` to skip affordability checks entirely.

See [examples/click-demo.user.js](examples/click-demo.user.js) and [examples/spike-macro.user.js](examples/spike-macro.user.js) for complete userscripts.

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
