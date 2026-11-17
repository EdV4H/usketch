---
"@edv4h/usketch-session-gather": minor
---

集合に「呼ぶ人」(`audience`: userId の一覧) を足した。一覧に無い人は対象外になり、聞かれず、カメラも動かず、参加者にも入らない。`GatherState.inAudience` と `isGatherAudience` で判定できる。`audience` を渡さなければ、いままで通り全員が対象。
