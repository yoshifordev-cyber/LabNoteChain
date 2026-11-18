# Markdown UI チェック原稿

このファイル全文をページ本文に貼り付け、「プレビュー」と閲覧画面で確認してください。

---

## 1. 見出し

# H1 見出し
## H2 見出し
### H3 見出し
#### H4 見出し

## 2. 段落・強調

通常の段落です。改行を入れています。

**太字** と *斜体* と ***太字斜体*** と ~~取り消し線~~ を確認。

行内コードは `SHA-256` や `entry.hash` のように見えるはずです。

## 3. リスト

箇条書き:

- 観察 A
- 観察 B
  - ネスト 1
  - ネスト 2
- 観察 C

番号付き:

1. 準備
2. 測定
3. 記録

タスク風（GFM）:

- [x] 試料準備
- [ ] 測定
- [ ] 解析

## 4. 引用

> 本ページは改ざん検知用ハッシュ連鎖の検証用です。
> 二行目の引用。

## 5. コードブロック

```ts
const hash = sha256Hex(payload)
console.log(hash.slice(0, 12))
```

```text
plain text block
line 2
```

## 6. リンク・区切り線

公式っぽいリンク: [LabNoteChain](https://example.com/labnotechain)

---

## 7. 表

| 項目 | 値 | 単位 |
| --- | ---: | --- |
| 温度 | 25.0 | °C |
| pH | 7.2 | — |
| 濃度 | 1.5 | mM |

## 8. エスケープ・特殊

バックスラッシュ: \*リテラル\* と \<tag\>

HTML風の文字列（そのまま表示される想定）: `<script>alert(1)</script>`

数式っぽい記号: α β γ → ≤ ≥ ± × ÷

日本語混在: **実験A**の結果は*有意*だった。

## 9. 長い行の折り返し

AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

以上。プレビューで見出し階層・リスト・表・コード・引用が崩れていなければ OK です。
