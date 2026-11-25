---
"@edv4h/usketch-plugin-pages": minor
---

Let the host change how pages appear (`pageView` option, `PageView` type).

- `isVisible(pageId)`: hide pages the viewer may not see from the panel, the page list and next/previous navigation.
- `displayName(page)`: show another name, such as the real name of a private page whose name is masked in the root doc.
- `rename(pageId, name)`: return `true` to take over a rename (for example, a server stores the name), so it is not written to the root doc.
- `subscribe(listener)`: tell the panel when any of these changed.

"Duplicate this page" now requires `page.create`, like "Add page".
