# Contributing to MooMooAPI

Thanks for helping improve MooMooAPI. This project is an early client-side foundation, so reliability, inspectable behavior, and clear documentation matter more than the number of methods.

## Project conventions

- Use English for all public names, comments, documentation, and console messages.
- Use plain JavaScript with no third-party dependencies.
- Use camelCase for method names.
- Keep optional behavior behind explicit options; do not silently bind keyboard shortcuts.
- Validate public arguments and return useful errors or structured failure results.
- Clearly distinguish verified behavior from hypotheses or planned functionality.
- Do not document game internals as stable until they have been tested against the current official client.
- Prefer direct client methods. If maintaining a compatibility shim for a known handler, document that it only affects the handler's property read and does not create a browser-trusted event.

## Current built-in modules

- `input`: synthetic pointer events, one-shot hotkeys, and repeat-while-held hotkeys with cleanup.
- `items`: action-bar catalog and DOM visibility checks.
- `bridge`: optional adapter for the `window.MooMoo` state/events/actions surface.
- `player`: state snapshots and health, death, spawn, inventory, and value callbacks when bridge data exists.
- `resources`: prefers bridge state when available, falls back to dedicated DOM displays, and exposes recorded costs.
- `upgrades`: identifies visible current items by category and describes tracked upgrade paths.
- `actions`: item selection, generic item use, and food-use helpers; bridge sending is explicit or used as a fallback when compatible.
- `build`: DOM or bridge placement, multi-angle placement, and optional weapon restoration.

DOM visibility is a client-side signal, not an independent proof of server-side ownership or unlock state.

## Adding a module

The core API exposes `registerModule(name, factory)`. Each factory receives the main API object and must return an object of methods.

```javascript
MooMooAPI.registerModule("example", function (api) {
    return {
        getVersion: function () {
            return api.version;
        }
    };
});
```

After registration, the module is available as `MooMooAPI.example` and `MooMooAPI.modules.example`.

When adding a built-in module:

1. Add the implementation and keep it independent where practical.
2. Use unique module and public method names.
3. Update the README with signatures, arguments, examples, return values, and limitations.
4. Add or update an example userscript when it makes the feature easier to understand.
5. Verify the feature in a browser against the current game version before describing it as live-tested.

## Click and action notes

The input helpers dispatch synthetic DOM mouse events to a configurable target. Hold-to-repeat callbacks await asynchronous work, cancel on keyup and blur, and enforce a configurable minimum interval. A successful dispatch only means the DOM accepted the dispatch; it does not guarantee server acceptance. The optional bridge can read state and send semantic actions only when a compatible `window.MooMoo` runtime is present.

The `selectToBuild` function and action-bar DOM IDs are observed client implementation details. They may change during a game update. Keep fallbacks explicit, report failure reasons, and do not describe client-side action calls as guaranteed results.

## Versioning

- Patch version: fixes that do not change the public API.
- Minor version: backward-compatible features.
- Major version: breaking API changes.

Before publishing, check JavaScript syntax, test the method logic, and verify behavior in a real browser when possible. A mocked test is useful but is not a substitute for a live game test.
