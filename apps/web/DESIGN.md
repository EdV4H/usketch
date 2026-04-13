# uSketch Demo App Design Guide

デモアプリ（apps/web）のUIを一貫させるためのデザインガイドライン。
新規コンポーネントや既存コードの修正時にこのドキュメントを参照すること。

## Color Palette

### Semantic Colors

| Token | Value | 用途 |
|-------|-------|------|
| `brand` | `#0066ff` | プライマリボタン、アクティブリンク、トグルON |
| `brandHover` | `#0052cc` | プライマリボタンhover |
| `textPrimary` | `#333` | 見出し、本文、ボタンテキスト |
| `textSecondary` | `#666` | ラベル、補足テキスト |
| `textMuted` | `#999` | プレースホルダー、無効テキスト |
| `textSubtle` | `#888` | 補助説明文 |
| `error` | `#c33` | エラーメッセージ、削除ボタン |
| `errorBorder` | `#fcc` | 削除ボタンの枠線 |
| `surfaceWhite` | `#fff` | パネル背景、カード背景 |
| `surfaceLight` | `#fafafa` | セカンダリボタン背景 |
| `surfaceMuted` | `#f5f5f5` | バッジ背景、リスト区切り |
| `surfaceDim` | `#f0f0f0` | Devログインボタン背景 |
| `borderLight` | `#eee` | カード枠線、セクション区切り |
| `borderDefault` | `#ddd` | インプット枠線、セカンダリボタン枠 |
| `borderStrong` | `#e0e0e0` | ツールバー区切り線、パネル枠線 |

### Active/Selection Colors

| Token | Value | 用途 |
|-------|-------|------|
| `activeBackground` | `#e3f2fd` | アクティブツールの背景 |
| `activeText` | `#1976d2` | アクティブツールのテキスト |
| `copilotOnBg` | `#e8f5e9` | Copilot ON 背景 |
| `copilotOnText` | `#2e7d32` | Copilot ON テキスト |
| `voiceOnBg` | `#fce4ec` | Voice ON 背景 |
| `voiceOnText` | `#c62828` | Voice ON テキスト |

### Shape Color Palette

描画ツールで使用する色:

```
transparent, #ffffff, #737373, #1e1e1e,
#ef4444, #f97316, #eab308, #22c55e,
#3b82f6, #8b5cf6, #ec4899, #06b6d4
```

## Typography

| Property | Value |
|----------|-------|
| Font family | `system-ui, sans-serif` |

### Size Scale

| Token | Size | 用途 |
|-------|------|------|
| `xs` | `10px` | カテゴリラベル、バッジ、Opacityパーセント |
| `sm` | `11px` | ツールバーボタン、コンパクトUI、メンバーロール |
| `md` | `12px` | ステータスボタン、トグル、補助ラベル |
| `base` | `13px` | メニューアイテム、インプット、リンクテキスト |
| `lg` | `14px` | 見出し（小）、ユーザー名、フォームラベル |
| `xl` | `18px` | ダイアログタイトル、閉じるボタン |
| `2xl` | `1.1rem` | セクション見出し |
| `3xl` | `1.5rem` | ページタイトル |
| `4xl` | `2rem` | ランディングタイトル |

### Font Weight

| Token | Weight | 用途 |
|-------|--------|------|
| `normal` | `400` | 本文テキスト |
| `medium` | `500` | リスト項目名、フォームラベル |
| `semibold` | `600` | ボタン、ツールバーラベル、アクティブ項目 |

## Spacing

4px ベースのスペーシングスケール:

| Token | Value | 用途 |
|-------|-------|------|
| `1` | `2px` | ディバイダーのマージン |
| `2` | `4px` | ツールバーgap、パディング（小） |
| `3` | `6px` | ピッカーgap、パレットパディング |
| `4` | `8px` | カードgap、ピッカーパディング、ボタンgap |
| `5` | `10px` | メニューアイテム上下パディング |
| `6` | `12px` | ボタンパディング、セクション間 |
| `8` | `16px` | カード内パディング、メニュー左右パディング |
| `10` | `24px` | ダイアログパディング、ページマージン |

## Border Radius

| Token | Value | 用途 |
|-------|-------|------|
| `sm` | `4px` | バッジ、インプット（小）、zOrderボタン |
| `md` | `6px` | ボタン、アクションボタン、インプット |
| `lg` | `8px` | ツールバー、カード、ドロップダウン |
| `xl` | `10px` | ピッカーパネル |
| `2xl` | `12px` | ダイアログ |

## Shadows

| Token | Value | 用途 |
|-------|-------|------|
| `panel` | `0 2px 8px rgba(0,0,0,0.12)` | ツールバー、フローティングパネル |
| `dropdown` | `0 4px 16px rgba(0,0,0,0.15)` | ドロップダウンメニュー |
| `dialog` | `0 8px 32px rgba(0,0,0,0.2)` | モーダルダイアログ |
| `palette` | `0 4px 12px rgba(0,0,0,0.12)` | カラーパレット |

## Z-Index Layers

| Token | Value | 用途 |
|-------|-------|------|
| `toolbar` | `100` | ツールバー、フローティングUI |
| `picker` | `150` | サブツールピッカー |
| `palette` | `200` | カラーパレット |
| `modalBackdrop` | `200` | モーダル背景 |
| `modalContent` | `201` | モーダル本体 |

## UI Component Patterns

### Floating Panel (ツールバー等)

```ts
{
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  zIndex: 100,
}
```

### Action Button (ツールバーのアイコンボタン)

```ts
{
  width: 36,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "#666",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
}
```

### Primary Button

```ts
{
  padding: "8px 16px",
  border: "none",
  borderRadius: 6,
  background: "#0066ff",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
}
```

### Secondary Button

```ts
{
  padding: "6px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  background: "#fff",
  color: "#333",
  fontSize: 12,
  cursor: "pointer",
}
```

### Danger Button (削除等)

```ts
{
  padding: "4px 8px",
  border: "1px solid #fcc",
  borderRadius: 4,
  background: "#fff",
  color: "#c33",
  fontSize: 11,
  cursor: "pointer",
}
```

### Menu Item (ドロップダウン内)

```ts
{
  display: "block",
  width: "100%",
  padding: "10px 16px",
  border: "none",
  background: "none",
  textAlign: "left",
  fontSize: 13,
  cursor: "pointer",
  color: "#333",
}
```

### Dropdown Panel

```ts
{
  position: "absolute",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  overflow: "hidden",
  minWidth: 120,
}
```

### Dialog Backdrop

```ts
{
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.3)",
  zIndex: 200,
}
```

### Dialog Content

```ts
{
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  zIndex: 201,
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  fontFamily: "system-ui, sans-serif",
}
```

### Divider (ツールバー区切り)

```ts
{
  width: 1,
  height: 24,
  background: "#e0e0e0",
  margin: "0 2px",
}
```

### Text Input

```ts
{
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 6,
  fontSize: 13,
}
```

### Card

```ts
{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  border: "1px solid #eee",
  borderRadius: 8,
}
```

## Error Handling

エラーメッセージの取得は以下の標準パターンを使用:

```ts
import { getErrorMessage } from "../lib/errors.js";

// catch ブロック内で
setError(getErrorMessage(e, "Failed to load boards"));
```

## Style Token の使い方

`lib/styles.ts` からインポートして使用:

```ts
import { colors, shadows, zIndex, floatingPanelStyle, menuItemStyle } from "../lib/styles.js";

// 個別トークン
<div style={{ color: colors.brand, boxShadow: shadows.panel }}>

// スタイルオブジェクト
<div style={floatingPanelStyle}>

// 拡張
<button style={{ ...menuItemStyle, fontWeight: 600 }}>
```
