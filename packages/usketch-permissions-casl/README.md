# @edv4h/usketch-permissions-casl

Connects [CASL](https://casl.js.org/) to uSketch's permission port (`PermissionProvider` / `ServerPermissionResolver` in `@edv4h/usketch-shared`).

A permission name is asked as a CASL action on a subject: `"page.edit"` is `edit` on `page`, and a plugin's `"<plugin id>:<op>"` is `<op>` on `<plugin id>`. The `PermissionResource` you ask about (`{ pageId, … }`) is the subject's fields, so conditional rules (`{ ownerId: userId }`) work.

```ts
import { createCaslPermissionProvider, createCaslServerResolver } from "@edv4h/usketch-permissions-casl";

// Browser: rules from the server, swapped in when they change.
const permissions = createCaslPermissionProvider({ rules: [{ action: "view", subject: "page" }] });
const app = await createApp({ store, plugins, permissions });
permissions.update(rulesFromServer); // the HUD and read-only follow

// Server: build the rules for a person, judge with them, send them to the browser.
const resolver = createCaslServerResolver({ loadRules: (subject, resource) => rulesFor(subject, resource) });
const { can, rules } = await resolver.resolve({ userId }, { boardId });
```

The rules are plain JSON, so the server and the browser judge with the same rules.
