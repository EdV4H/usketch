---
"@edv4h/usketch-presence-motion": patch
---

Add a `default` export condition so CommonJS servers can `require()` the package (Node's require of ES modules). Until now only `import` resolved, so a CommonJS caller failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
