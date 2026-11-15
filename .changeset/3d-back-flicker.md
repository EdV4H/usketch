---
"@edv4h/usketch-plugin-character": patch
"@edv4h/usketch-plugin-elevation": patch
---

3D 表示の 2 つの不具合を直しました。

- character: カメラが向きに合わせて回るモード（`rotate`）で後ろ（S）を押すと、キャラが振り向こうとしてカメラも一緒に回り、ぐるぐる回り続けていました。このモードでは前を向いたまま後ろに下がります（`stepCharacter` の新しい引数 `backpedal`）。
- elevation: 地形メッシュ（と丘の陰のカバー）を、変更の次のフレームではなく同じフレームで描き直すようにしました。追従カメラで動くと、地形が DOM の Shape より 1 フレーム遅れるフレームとそうでないフレームが交互に出て、ガタついて（チラついて）見えていました。
