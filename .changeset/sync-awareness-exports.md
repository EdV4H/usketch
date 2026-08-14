---
"@edv4h/usketch-sync": minor
---

feat(sync): re-export the Yjs awareness primitives (`Awareness`, `encodeAwarenessUpdate`, `applyAwarenessUpdate`, `removeAwarenessStates`)

So consumers can publish/apply presence without taking a direct `y-protocols`
dependency — this package already depends on it and owns the `MSG_AWARENESS`
message framing. Used by the MCP server to make the AI appear as a presence
participant (#960).
