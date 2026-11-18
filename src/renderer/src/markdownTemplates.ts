export type MdTemplateId =
  | 'heading'
  | 'bullets'
  | 'checklist'
  | 'table'
  | 'code'
  | 'quote'
  | 'experiment'
  | 'measurement'

export type MdTemplate = {
  id: MdTemplateId
  /** i18n key suffix under mdTpl* */
  labelKey:
    | 'mdTplHeading'
    | 'mdTplBullets'
    | 'mdTplChecklist'
    | 'mdTplTable'
    | 'mdTplCode'
    | 'mdTplQuote'
    | 'mdTplExperiment'
    | 'mdTplMeasurement'
  body: string
}

export const MD_TEMPLATES: MdTemplate[] = [
  {
    id: 'heading',
    labelKey: 'mdTplHeading',
    body: `## 見出し

段落を書く。
`
  },
  {
    id: 'bullets',
    labelKey: 'mdTplBullets',
    body: `- 項目 A
- 項目 B
  - 詳細
- 項目 C
`
  },
  {
    id: 'checklist',
    labelKey: 'mdTplChecklist',
    body: `- [ ] 準備
- [ ] 実施
- [ ] 確認
- [x] 完了済みの例
`
  },
  {
    id: 'table',
    labelKey: 'mdTplTable',
    body: `| 項目 | 値 | 単位 | 備考 |
| --- | ---: | --- | --- |
| 温度 | 25.0 | °C | |
| pH | 7.2 | — | |
| 濃度 | 1.5 | mM | |
`
  },
  {
    id: 'code',
    labelKey: 'mdTplCode',
    body: `\`\`\`ts
// コードまたはコマンドログ
const value = 0
console.log(value)
\`\`\`
`
  },
  {
    id: 'quote',
    labelKey: 'mdTplQuote',
    body: `> 引用・注意事項を書く。
> 二行目。
`
  },
  {
    id: 'experiment',
    labelKey: 'mdTplExperiment',
    body: `## 目的

何を確かめるか。

## 材料・条件

- 試料:
- 装置:
- 条件:

## 手順

1.
2.
3.

## 結果

| 試行 | 測定値 | 備考 |
| --- | ---: | --- |
| 1 |  |  |
| 2 |  |  |

## 考察

-

## 次のアクション

- [ ]
`
  },
  {
    id: 'measurement',
    labelKey: 'mdTplMeasurement',
    body: `## 測定ログ

- 日時:
- 担当:
- 装置 ID:

| # | 時刻 | 値 | 単位 | メモ |
| --- | --- | ---: | --- | --- |
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

\`\`\`text
装置出力・生ログを貼る
\`\`\`
`
  }
]
