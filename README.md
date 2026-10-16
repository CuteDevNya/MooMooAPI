# MooMooAPI

A modular JavaScript helper library for Tampermonkey userscripts targeting the MooMoo.io browser client.

> **Current status: early foundation (v0.1.0).** The first built-in module provides configurable synthetic mouse-click helpers. Player data, inventory, resources, shop actions, chat, and building helpers are not implemented yet; they must be researched and verified against the current client before being documented as supported.

## Install with Tampermonkey

Add this metadata line to your userscript:

```javascript
// @require https://raw.githubusercontent.com/CuteDevNya/MooMooAPI/main/moomoo-api.js
```

Then use the global `MooMooAPI`:

```javascript
const api = await MooMooAPI.ready();

console.log(api.getInfo());
console.log(api.input.getMousePosition());
```

The library is plain JavaScript and has no build step or third-party dependencies.

## Click helpers

By default, the input module dispatches mouse events to `#touch-controls-fullscreen`, matching the working click script that started this project. Change the target with `input.setDefaultTarget(...)` or override it for an individual call.

### Click a specific screen coordinate

Coordinates are viewport CSS pixels, the same coordinate system used by `MouseEvent.clientX` and `clientY`.

```javascript
MooMooAPI.input.clickAt(640, 280);

// Object form is also supported:
MooMooAPI.input.clickAt({ x: 640, y: 280 });

// Override the target and mouse button:
MooMooAPI.input.clickAt(640, 280, {
    target: "#touch-controls-fullscreen",
    button: "left",       // "left", "middle", "right", or 0, 1, 2
    restoreMouse: true    // restore the last real mouse position afterwards
});
```

### Click by angle and distance

Angles use screen coordinates: **0° = right, 90° = down, 180° = left, 270° = up**. The default origin is the center of the viewport.

```
// Click 80 pixels above the center (the original script's behavior):
MooMooAPI.input.click();

// 120 pixels to the right:
MooMooAPI.input.click({ angle: 0, distance: 120 });

// 100 pixels down:
MooMooAPI.input.clickAtAngle(90, 100);

// Equivalent shorthand:
MooMooAPI.input.click(90, 100);
```

You can select a different origin:

```javascript
// Click 80 pixels to the right of a custom origin:
MooMooAPI.input.click({
    origin: { x: 300, y: 200 },
    angle: 0,
    distance: 80
});

// Use the most recently observed real mouse position as the origin:
MooMooAPI.input.click({
    origin: "mouse",
    angle: 180,
    distance: 50
});
```

### Click using offsets or at the center

```javascript
// 30 pixels right and 20 pixels up from the viewport center:
MooMooAPI.input.clickAtOffset(30, -20);

// Exact center:
MooMooAPI.input.clickCenter();

// Top-level shortcuts are also available:
MooMooAPI.clickAt(640, 280);
MooMooAPI.clickAtAngle(270, 80);
MooMooAPI.clickAtOffset(30, -20);
```

### Optional keyboard shortcut

The library does not bind a key automatically. Bind and unbind a shortcut explicitly:

```javascript
const unbind = MooMooAPI.input.bindClickHotkey(
    "KeyN",
    { angle: 270, distance: 80 },
    {
        preventDefault: true,
        ignoreInputs: true,
        ignoreRepeat: true
    }
);

// Later, when the shortcut is no longer needed:
// unbind();
```

See [examples/click-demo.user.js](examples/click-demo.user.js) for a complete userscript.

## Adding new functionality

Features are organized as modules. Register a new module from your own userscript or add a built-in module to the project:

```javascript
MooMooAPI.registerModule("example", (api) => {
    return {
        hello() {
            return "Hello from an extension!";
        },

        getLibraryInfo() {
            return api.getInfo();
        }
    };
});

// The module is now available here:
console.log(MooMooAPI.example.hello());
```

Each module factory receives the main API object and returns an object of functions. The module is available as both `MooMooAPI.example` and `MooMooAPI.modules.example`. Module names must be unique and must not replace an existing API property.

Suggested future module boundaries:

- `player` — local player and other-player state, after the relevant structures are verified.
- `world` — entities, resources, and buildings.
- `inventory` — currently selected item, owned items, and material counts.
- `chat` — chat-related helpers, if the current client exposes a supported path.
- `actions` — item selection, placement, and other client actions.
- `debug` — safe inspection helpers for development.

These are design ideas, not implemented modules yet.

## Important limitations

- This library runs inside the browser and does not provide a server API.
- The click helpers dispatch **synthetic** DOM mouse events. Such events have `isTrusted === false`; a game version may ignore them or change its event target. The helper reports when its target cannot be found, but a successful dispatch does not guarantee that the game performed an action.
- The default target `#touch-controls-fullscreen` comes from the supplied working script and may change in future game updates.
- Internal game state, chat, shop, and building behavior must be individually investigated and tested. The library does not bypass server-side validation.
- Only use userscripts in ways that comply with the game's rules and applicable terms.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions for adding modules and documenting verified behavior.

## License

No license has been added yet. Until a license is chosen, the repository's default copyright applies.
