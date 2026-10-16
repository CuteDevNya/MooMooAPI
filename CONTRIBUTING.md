# Contributing to MooMooAPI

Thanks for helping improve MooMooAPI. The project is currently an early client-side foundation, so reliability and clear documentation matter more than the number of methods.

## Project conventions

- Use English for all public names, comments, documentation, and console messages.
- Use plain JavaScript with no third-party dependencies.
- Use camelCase for method names.
- Keep optional behavior behind explicit options; do not silently bind keyboard shortcuts.
- Validate public arguments and return useful errors or structured failure results.
- Clearly distinguish verified behavior from hypotheses or planned functionality.
- Do not document game internals as stable until they have been tested against the current official client.

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
5. Verify the feature in the browser against the current game version before describing it as supported.

## Click module notes

The first input helpers dispatch synthetic DOM mouse events to a configurable target. A successful dispatch only means the DOM accepted the dispatch; it does not guarantee the game acted on it. Keep this distinction clear in logs and documentation.

## Versioning

- Patch version: fixes that do not change the public API.
- Minor version: backward-compatible features.
- Major version: breaking API changes.

Until automated tests are added, review syntax and test changed methods in a browser before publishing.
