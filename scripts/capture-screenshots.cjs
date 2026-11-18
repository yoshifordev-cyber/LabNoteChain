/**
 * README / 公開ページ用のスクリーンショットを、実アプリの実画面から自動撮影する。
 *
 * 使い方:
 *   npm run build
 *   npx electron scripts/capture-screenshots.cjs
 *
 * - 実データは使わない。保存先は C:\lnc-demo（短いパス。ユーザー名が画像に写らないようにするため）。
 * - デモ用のノートを作り、1 件だけ意図的に書き換えて「検証NG」の画面も撮る。
 * - 出力: docs/images/*.png
 * - 撮影後、C:\lnc-demo は手動で削除してよい（共有フォルダのデモ用ディレクトリもこの中にある）。
 */
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'images')
const DEMO = 'C:\\lnc-demo'
const SHARE = path.join(DEMO, 'LabShare')
const MARKER = path.join(DEMO, '.labnotechain-demo')

// ---- 既存フォルダを巻き込まない: このスクリプトが作った印（MARKER）のある場所だけ作り直す ----
if (fs.existsSync(DEMO)) {
  if (!fs.existsSync(MARKER)) {
    console.error(`${DEMO} は既に存在し、このスクリプトが作ったものではありません。削除または改名してから再実行してください。`)
    process.exit(1)
  }
  fs.rmSync(DEMO, { recursive: true, force: true })
}
fs.mkdirSync(DEMO, { recursive: true })
fs.writeFileSync(MARKER, 'created by scripts/capture-screenshots.cjs\n')

// ---- 実環境のパス・ユーザー名が画像に写らないよう、ホームを差し替える ----
const FAKE_HOME = path.join(DEMO, 'home')
fs.mkdirSync(path.join(FAKE_HOME, 'OneDrive'), { recursive: true })
fs.mkdirSync(path.join(FAKE_HOME, 'MEGA'), { recursive: true })
fs.mkdirSync(SHARE, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })
process.env.USERPROFILE = FAKE_HOME
process.env.HOME = FAKE_HOME
process.env.OneDrive = path.join(FAKE_HOME, 'OneDrive')
delete process.env.OneDriveConsumer

app.setPath('userData', path.join(DEMO, 'userdata'))
app.commandLine.appendSwitch('force-device-scale-factor', '1.5')

let win = null
app.on('browser-window-created', (_e, w) => {
  win = w
})
require(path.join(ROOT, 'out', 'main', 'index.js'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const js = (code) => win.webContents.executeJavaScript(code, true)

async function waitLoaded() {
  while (!win) await sleep(100)
  while (win.webContents.isLoading()) await sleep(100)
  await sleep(700)
}

async function shot(name) {
  await sleep(700)
  const img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUT, name), img.toPNG())
  const s = img.getSize()
  console.log(`saved ${name} (${s.width}x${s.height})`)
}

async function reload() {
  win.webContents.reload()
  await sleep(400)
  await waitLoaded()
}

// ---- レンダラー側で動くヘルパー（toString で注入） ----
function installHelpers() {
  window.__cap = {
    all: (sel) => Array.from(document.querySelectorAll(sel)),
    find(sel, text) {
      return this.all(sel).find((e) => (e.textContent || '').includes(text))
    },
    click(sel, text) {
      const el = text ? this.find(sel, text) : document.querySelector(sel)
      if (!el) throw new Error('not found: ' + sel + ' / ' + text)
      el.click()
      return true
    },
    dbl(sel, text) {
      const el = text ? this.find(sel, text) : document.querySelector(sel)
      if (!el) throw new Error('not found: ' + sel + ' / ' + text)
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
      return true
    },
    setValue(el, v) {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  return true
}

// ---- デモデータ（レンダラー側で window.api を叩いて作る） ----
async function seed(data) {
  const api = window.api
  const ok = (r) => {
    if (!r.ok) throw new Error(r.error)
    return r.data
  }
  ok(await api.updateSettings({ language: 'ja', theme: 'light' }))

  // 測定グラフの添付画像（canvas で描いて PNG にする）
  const c = document.createElement('canvas')
  c.width = 720
  c.height = 420
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#999'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(70, 30)
  g.lineTo(70, 350)
  g.lineTo(680, 350)
  g.stroke()
  g.fillStyle = '#333'
  g.font = '16px sans-serif'
  g.fillText('吸光度 (a.u.)', 8, 22)
  g.fillText('濃度 (mmol/L)', 560, 388)
  const pts = [
    [0, 0.02],
    [0.2, 0.19],
    [0.4, 0.41],
    [0.6, 0.6],
    [0.8, 0.82],
    [1.0, 1.01]
  ]
  g.strokeStyle = '#2f6f9f'
  g.fillStyle = '#2f6f9f'
  g.lineWidth = 2.5
  g.beginPath()
  pts.forEach(([x, y], i) => {
    const px = 70 + x * 590
    const py = 350 - y * 300
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  })
  g.stroke()
  pts.forEach(([x, y]) => {
    g.beginPath()
    g.arc(70 + x * 590, 350 - y * 300, 5, 0, Math.PI * 2)
    g.fill()
  })
  const plotPath = ok(await api.saveDataUrl(c.toDataURL('image/png'), 'calibration-curve'))

  const ids = {}
  for (const nb of data.notebooks) {
    const n = ok(await api.createNotebook({ title: nb.title, authorName: nb.author }))
    ids[nb.key] = n.id
    for (const p of nb.pages) {
      ok(
        await api.addEntry({
          notebookId: n.id,
          title: p.title,
          body: p.body,
          tags: p.tags || [],
          attachmentPaths: p.plot ? [plotPath] : []
        })
      )
    }
    if (nb.seal) {
      ok(await api.sealNotebook(n.id))
      const cur = ok(await api.getNotebook(n.id))
      const target = cur.entries[nb.correct.index]
      ok(
        await api.addCorrection({
          notebookId: n.id,
          title: nb.correct.title,
          body: nb.correct.body,
          tags: ['訂正'],
          correctsEntryId: target.id,
          correctionReason: nb.correct.reason
        })
      )
    }
  }

  const folder = ok(await api.createFolder('2026年度 研究'))
  ok(await api.moveNotebookToFolder({ notebookId: ids.synth, folderId: folder.id }))
  ok(await api.moveNotebookToFolder({ notebookId: ids.cell, folderId: folder.id }))

  ok(await api.setLabSharePath(data.share))
  ok(await api.updateSettings({ labServer: { enabled: true, autoAnchor: false } }))
  return ids
}

const DATA = {
  share: SHARE,
  notebooks: [
    {
      key: 'synth',
      title: '有機合成ノート',
      author: '山田 太郎',
      pages: [
        {
          title: 'アセチルサリチル酸の合成',
          tags: ['合成', 'アスピリン'],
          body: [
            '## 目的',
            'サリチル酸のアセチル化により、アセチルサリチル酸を合成し収率を確認する。',
            '',
            '## 試薬',
            '| 試薬 | 量 | 備考 |',
            '|---|---|---|',
            '| サリチル酸 | 2.00 g | 乾燥済み |',
            '| 無水酢酸 | 4.0 mL | 新規開封 |',
            '| 濃硫酸 | 数滴 | 触媒 |',
            '',
            '## 手順',
            '- [x] サリチル酸と無水酢酸を混合',
            '- [x] 85 ℃ で 15 分加熱',
            '- [ ] 氷水で結晶化し、ろ過',
            '',
            '> 加熱中にわずかに黄変。温度計の誤差を後で確認する。'
          ].join('\n')
        },
        {
          title: '吸光度の検量線',
          tags: ['測定', 'UV-Vis'],
          plot: true,
          body: [
            '## 測定条件',
            '- 波長: **296 nm**',
            '- セル: 石英 10 mm',
            '',
            '```text',
            'conc [mmol/L]  abs',
            '0.2            0.19',
            '0.4            0.41',
            '1.0            1.01',
            '```',
            '',
            '検量線は原点付近を通り、直線性は良好（R² ≥ 0.999）。'
          ].join('\n')
        },
        {
          title: '再結晶と収率',
          tags: ['精製'],
          body: ['## 結果', '収率 **62 %**（理論値 2.61 g に対し 1.62 g）。', '', '融点は文献値と一致。'].join('\n')
        }
      ]
    },
    {
      key: 'cell',
      title: '細胞培養ノート',
      author: '山田 太郎',
      pages: [
        { title: '継代 P5 → P6', tags: ['培養'], body: '## 記録\n- 継代日: 2026-11-10\n- 播種密度: 2 × 10^5 cells/mL\n- 培地: 10% FBS' },
        { title: '増殖曲線（72 h）', tags: ['測定'], body: '24 h / 48 h / 72 h で計数。倍加時間は約 21 時間。' }
      ],
      seal: true,
      correct: {
        index: 0,
        title: '訂正: 継代日の記載',
        body: '継代日を 2026-11-10 から **2026-11-09** に訂正する。',
        reason: '実験スケジュール表との照合で日付の誤記が判明したため'
      }
    },
    {
      key: 'tamper',
      title: '改ざんテスト用（デモ）',
      author: '山田 太郎',
      pages: [
        { title: '結果の記録', tags: ['デモ'], body: '収率 **62 %**。再現実験でも同程度。' },
        { title: '考察', tags: ['デモ'], body: '加熱時間が短いと収率が下がる傾向。' }
      ]
    }
  ]
}

async function run() {
  await waitLoaded()
  win.setContentSize(1280, 800)
  win.center()
  await sleep(500)
  await js(`(${installHelpers.toString()})()`)

  const ids = await js(`(${seed.toString()})(${JSON.stringify(DATA)})`)
  console.log('seeded', ids)

  // 「改ざんテスト用」ノートのファイルを直接書き換える（ハッシュ連鎖が壊れる）
  const nbFile = path.join(DEMO, 'userdata', 'notebooks', ids.tamper, 'notebook.json')
  const nb = JSON.parse(fs.readFileSync(nbFile, 'utf8'))
  nb.entries[0].body = nb.entries[0].body.replace('62 %', '92 %')
  fs.writeFileSync(nbFile, JSON.stringify(nb, null, 2), 'utf8')

  await reload()
  await js(`(${installHelpers.toString()})()`)

  // 01: 3ペイン全体（Library / ページ一覧 / 詳細）
  await js(`__cap.click('.tree-item', '有機合成ノート')`)
  await sleep(700)
  await js(`__cap.click('.item-table tbody tr', '吸光度の検量線')`)
  await shot('01-library.png')

  // 02: 閲覧ビュー + 検証OK
  await js(`__cap.dbl('.item-table tbody tr', '吸光度の検量線')`)
  await sleep(800)
  await js(`__cap.click('.tb-btn', '検証')`)
  await shot('02-reader-verify-ok.png')
  await js(`__cap.click('.verify-dialog .btn', '閉じる')`)
  await sleep(300)
  await js(`__cap.click('.tb-btn', '一覧に戻る')`)
  await sleep(500)

  // 03: 新規ページ作成（Markdown テンプレート）
  await js(`__cap.click('.pane-head-action[title="新規ページ"]')`)
  await sleep(700)
  await js(`(() => {
    const t = document.querySelector('.compose-page input')
    __cap.setValue(t, '反応条件の検討')
    __cap.click('.md-tpl-btn', '実験記録')
    return true
  })()`)
  await sleep(500)
  await js(`(() => {
    const inputs = document.querySelectorAll('.compose-page input')
    __cap.setValue(inputs[inputs.length - 1], '合成, 条件検討')
    const ed = document.querySelector('.md-editor')
    if (ed) ed.scrollTop = 0
    return true
  })()`)
  await shot('03-compose-markdown.png')
  await js(`__cap.click('.md-tab', 'プレビュー')`)
  await shot('04-compose-preview.png')
  await js(`__cap.click('.tb-btn', '作成をやめる')`)
  await sleep(500)

  // 05: 改ざんを検出（検証NG）
  await js(`__cap.click('.tree-item', '改ざんテスト用')`)
  await sleep(800)
  await js(`__cap.dbl('.item-table tbody tr', '結果の記録')`)
  await sleep(800)
  await js(`__cap.click('.tb-btn', '検証')`)
  await shot('05-verify-ng.png')
  await js(`__cap.click('.verify-dialog .btn', '閉じる')`)
  await sleep(300)
  await js(`__cap.click('.tb-btn', '一覧に戻る')`)
  await sleep(500)

  // 06: 確定済みノート + 訂正ページ
  await js(`__cap.click('.tree-item', '細胞培養ノート')`)
  await sleep(800)
  await js(`__cap.click('.item-table tbody tr', '訂正: 継代日の記載')`)
  await shot('06-sealed-correction.png')

  // 07/08: 設定（接続 / 一般）
  await js(`__cap.click('.library-footer-settings')`)
  await sleep(700)
  await js(`__cap.click('.modal button', '接続')`)
  await sleep(500)
  await js(`__cap.click('.modal button', '接続を確認')`)
  await sleep(1500)
  await shot('07-settings-labshare.png')
  await js(`__cap.click('.modal button', '一般')`)
  await sleep(600)
  await shot('08-settings-general.png')
  await js(`__cap.click('.modal-actions button', '閉じる')`)
  await sleep(400)

  // 09: ダークテーマ
  await js(`window.api.updateSettings({ theme: 'dark' })`)
  await reload()
  await js(`(${installHelpers.toString()})()`)
  await js(`__cap.click('.tree-item', '有機合成ノート')`)
  await sleep(700)
  await js(`__cap.click('.item-table tbody tr', 'アセチルサリチル酸の合成')`)
  await shot('09-dark-theme.png')

  console.log('done')
  app.quit()
}

app.whenReady().then(() => {
  run().catch((e) => {
    console.error('capture failed:', e)
    app.exit(1)
  })
})
