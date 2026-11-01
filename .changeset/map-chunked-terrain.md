---
"@edv4h/usketch-plugin-map": patch
---

Walking into new terrain no longer stutters as much: the ground and the Mode 7 relief are drawn chunk by chunk, so crossing a chunk edge builds only the chunks coming into view (chunks about to come into view are built ahead, one per frame, and stay hidden until needed). Each chunk is built as SVG/HTML markup instead of hundreds of React elements, and the shared pattern defs no longer rebuild every frame.
