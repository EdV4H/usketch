---
"@edv4h/usketch-plugin-voice-notes": minor
---

音声メモプラグイン `usketch-plugin-voice-notes` を追加。マイクで話した内容を文字起こしし、AI で要約して**まとめ Frame** を起こす（Notion の AI Meeting Notes に着想）。

- **モジュラブルな文字起こし**: `Transcriber` インターフェース（差し替え可能）。v1 既定はブラウザ Web Speech API（continuous 蓄積）。将来サーバ Whisper 実装を `createTranscriber` で差し込める。
- **AI 要約**: 蓄積した transcript をサーバの OpenAI 互換プロキシ `/api/ai/openui`（キーはサーバ側）に送り、要点ノード＋関連の構造化 JSON を取得。
- **まとめ Frame**: 生の文字起こしは `frame.meta.transcript` に保存（source of truth）。可視内容は要点を GeoShape（ラベル付き角丸）＋ connector で配置した「まとめの図」。要約失敗時は markdown で全文フォールバック。生成は 1 undo ステップ、通常のシェイプ同期で全クライアントへ。
- Control HUD（group "Voice Notes"）: 録音/停止トグル＋選択メモの再要約。録音中/要約中は画面下部にインジケータ。
