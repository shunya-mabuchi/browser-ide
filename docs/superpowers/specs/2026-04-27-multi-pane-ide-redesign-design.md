# Multi-Pane IDE Redesign — 設計書

**日付**: 2026-04-27
**ステータス**: Draft（ユーザーレビュー待ち）
**対象 Phase**: BrowserIDE Phase 1 後半 + Phase 2 の前倒し統合
**作成経緯**: ブレインストーミング（2026-04-27）の合意事項を文書化

## 背景

BrowserIDE は Phase 1 として「単一 TSX ファイル + プレビュー + チャット」の最小構成で実装完了している（[DESIGN.md](../../../DESIGN.md) 参照、コミット `7ec4ff3`）。しかし以下の要件が浮上した:

- **Cursor/VS Code 風の本格 IDE 体験**: 左にファイルツリー、中央タブ式エディタ、右にチャット、下にコンソール
- **複数ファイル管理**: フォルダ階層・CRUD・DnD・右クリック対応
- **AI による複数ファイル変更**: diff 承認 UI による Cursor 風体験

DESIGN.md の Phase 2（ファイルツリー UI / 複数ファイル / OPFS）と Phase 4（Cmd+K diff 承認）を**前倒しで Phase 1 に統合**する。

## ゴールと非ゴール

### ゴール

- 4 ペインレイアウト（ファイルツリー / エディタ + タブ / チャット / コンソール）への作り直し
- OPFS によるフォルダ階層付きワークスペース
- esm.sh + import map 経由の任意 npm パッケージ利用
- Worker 化された Bundler
- AI 応答の inline diff 承認 UI（CodeMirror 6 gutter）
- スコープ別コンテキスト注入（選択範囲 / アクティブ / @filename / Explore モード）

### 非ゴール（Phase 2 以降）

- 仮想 Web サーバ（Service Worker による静的アセット配信）
- 画像/PDF プレビュー
- isomorphic-git / GitHub 連携
- インライン補完（grey テキスト / Tab 確定）
- Cmd+K インライン編集
- コマンドパレット（⌘Shift+P）
- `@workspace` のキーワード絞り込み RAG

## 主要決定事項サマリ

| 項目 | 決定 | 代替案を退けた理由 |
|---|---|---|
| レイアウト | 4 ペイン（左: ツリー / 中央: タブ式エディタ / 右: チャット / 下: コンソール） | 2 ペイン維持は「VS Code 風 IDE」名乗れず、3 ペインだと console 置き場無し |
| ファイル管理 | フル装備（フォルダ階層 + CRUD + DnD + 右クリック） | 最小構成は「タブ追加機能」と機能不整合、本格 IDE 名乗れず |
| 永続化 | OPFS（DESIGN.md の Phase 2 通り） | localStorage は容量制限、メモリのみは UX 破綻 |
| Import 解決 | ローカル + esm.sh + import map（HTML 標準） | esm.sh のみは npm バージョン固定不可、ローカルのみは AI 提案の任意ライブラリ動かず |
| AI 適用 UX | CodeMirror 6 inline gutter（Cursor 風） | モーダル方式は Phase 1 完成優先には合うが diff 体験が IDE の心臓部、妥協しない |
| LLM 出力フォーマット | ` ``` ` で始まり 1 行目に `// file: <path>` コメント | XML/JSON は 7B モデルで追従精度落ちる、SEARCH/REPLACE は recovery 不可 |
| Bundler 配置 | 完全 Worker 化（OPFS sync API 活用） | main thread は LLM 適用時の連続書き換えで UI ブロック、既存 `llm.worker.ts` パターン再利用 |
| Console 配置 | 下端パネル（VS Code Terminal 風、折りたたみ可） | Preview 内は Preview を見てる時しか見えない、Chat 流しはノイズ過多 |
| エントリポイント | 拡張順走査（App.tsx → main.tsx → index.tsx） | 固定 1 つは AI 生成命名に追従できない、設定 UI は Phase 1 で過剰 |
| importmap 編集 | `importmap.json` を普通のファイルとして編集 | 設定画面 UI は AI diff 承認体験と二重管理、AI に編集させる体験を主役に |
| Diff 自動表示 | 応答完了で自動オープン + 「次回手動」リンク | 完全手動は「結局見ない」リスク、設定 UI は Phase 1 で過剰 |
| Diff ライブラリ | `diff` (jsdiff) パッケージ | 30KB は誤差、自前実装はテスト工数過大、`fast-diff` は機能不足 |
| コンテキスト注入 | ハイブリッド（暗黙 + @ メンション + Explore モード） | 明示のみは敷居高い、AI 自動推論は 7B 精度問題、モードボタンは毎回摩擦 |

## 1. アーキテクチャ全体像

### レイアウト

```
┌─────────────┬────────────────────────────────────┬──────────┐
│ ▶ src       │ App.tsx │ Counter.tsx │ 🌐 Preview │  💬 Chat │
│   App.tsx   │ ────────────────────────────────── │          │
│ ▶ components│                                     │ messages │
│   Counter…  │  [CodeMirror 6 editor]              │          │
│ ▶ lib       │                                     │          │
│   util.ts   │                                     │ ──────── │
│ index.html  │                                     │ [入力欄] │
├─────────────┴────────────────────────────────────┤          │
│ ▼ Console                                  [×]    │          │
│ > [10:23] App rendered                            │          │
│ > [10:24] Error in Counter.tsx:5                  │          │
└───────────────────────────────────────────────────┴──────────┘
```

軸:
- 左境界（垂直）: ファイルツリー幅、既定 18%、最小 10%、最大 40%
- 右境界（垂直）: チャット幅、既定 26%、最小 18%、最大 45%
- 下境界（水平）: コンソール高さ、既定 22%、`▼` で折りたたみ可、最小 0% (折りたたみ時)、最大 60%
- 中央エディタは伸縮 1fr

`localStorage` キー:
- `bide.split.tree` （旧 `bide.split.h` を捨てる）
- `bide.split.chat`
- `bide.split.console`

### モジュール責務分離

| モジュール | 責務 | ファイル |
|---|---|---|
| **FsAdapter** | OPFS への薄いラッパ | `src/lib/fs.ts` |
| **FsAdapterSync** | Worker 専用 sync OPFS（Bundler 用） | `src/lib/fs-sync.ts` |
| **WorkspaceStore** | ツリー構造のキャッシュと変更通知 | `src/lib/workspace.ts` |
| **TabManager** | 開いているタブ・アクティブ・ダーティ状態管理 | `src/lib/tabs.ts` |
| **Bundler (facade)** | メインスレッド側 API。Worker への postMessage を隠蔽 | `src/lib/bundler.ts` |
| **Bundler Worker** | esbuild-wasm + import 解決プラグイン | `src/workers/bundler.worker.ts` |
| **DiffApplier** | LLM 応答パース、現状ファイルとの diff 計算、ChangeSet 生成 | `src/lib/diff.ts` |
| **ContextBuilder** | スコープ判定とシステムプロンプト構築 | `src/lib/context.ts` |
| **LLM Worker** | 既存維持。プロンプト構築は ContextBuilder に分離 | `src/workers/llm.worker.ts` |

### データフロー（典型シナリオ）

ユーザーが「Counter コンポーネントを作って App.tsx で使って」をチャットに送信:

```
1. ContextBuilder がワークスペース状態 + 選択 + アクティブから system prompt 生成
2. LLM Worker が応答ストリーム返却
3. DiffApplier がレスポンスをパース → ChangeSet 生成
4. 該当ファイルのタブを自動オープンし、CodeMirror 6 inline gutter で diff 表示
5. ユーザーが個別 hunk 単位で Accept、Accept されたぶんだけ FsAdapter で OPFS 書き込み
6. WorkspaceStore がツリー更新 → FileTree 再描画
7. OPFS 書き込みイベントで Bundler.rebuild が発火（debounced）
8. Bundler Worker → 完了 postMessage → Preview iframe 更新
```

### 既存コードへのインパクト

- `App.tsx` (現状 13KB → 目標 6KB): レイアウト 2 ペイン → 4 ペインに変更、ストアからファイル一覧/タブ状態を引く形にスリム化
- `Editor.tsx`: `(filePath, content, onChange)` 受け取り API に変更
- `Preview.tsx`: 単一 transform → Bundler ファサード呼び出しに置換、iframe 再ロードなしの工夫は維持
- `ChatPanel.tsx`: `applyCode` 一発適用廃止 → ChangeSet 発行に変更
- 新規ファイル: `FileTree.tsx`, `Tabs.tsx`, `DiffView.tsx`, `Console.tsx`, `Splitter` 縦版対応

## 2. OPFS とファイルシステム

### ディレクトリ構成

```
/workspace/
  App.tsx                # ルート React コンポーネント（エントリポイント候補）
  importmap.json         # ユーザー編集可能な import 定義（import map の唯一の真実）
  components/
    Counter.tsx
  lib/
    util.ts
  .browser-ide/          # 内部状態ファイル（FileTree UI で非表示）
    session.json         # 開いていたタブ・アクティブ・カーソル位置・展開状態
    history/             # （Phase 2 用）スナップショット用ディレクトリ
```

`index.html` は OPFS に置かない。プレビューは `Preview.tsx` が iframe 用 HTML を内部で構築し、その中で `importmap.json` の内容を `<script type="importmap">` として注入する。Phase 2 で仮想 Web サーバを実装する際に `index.html` をユーザー編集対象として導入予定（Phase 1 はスコープ外）。

### FsAdapter API

```ts
type FsEntry = { name: string; path: string; kind: 'file' | 'dir' }

interface FsAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  delete(path: string): Promise<void>           // フォルダは再帰削除
  rename(from: string, to: string): Promise<void>
  mkdir(path: string): Promise<void>            // 中間ディレクトリも作る
  list(dirPath: string): Promise<FsEntry[]>     // 1 階層分
  exists(path: string): Promise<boolean>
}
```

`FsAdapterSync` は Worker 専用、`createSyncAccessHandle()` ベースで同等 API を sync 提供。

### WorkspaceStore

```ts
type TreeNode =
  | { kind: 'file'; path: string; name: string }
  | { kind: 'dir';  path: string; name: string; children: TreeNode[]; expanded: boolean }

class WorkspaceStore {
  tree: TreeNode
  subscribe(listener: () => void): () => void
  refresh(path: string): Promise<void>
  createFile(path: string, content: string): Promise<void>
  deleteNode(path: string): Promise<void>
  renameNode(from: string, to: string): Promise<void>
}
```

### 初回起動時の seed

判定: `localStorage.getItem('bide.bootstrap.v1')` が無ければ seed → フラグ立て。

Seed 内容:

```
/workspace/
  App.tsx          (Counter を import するシンプルなデモ)
  importmap.json   (react / react-dom を定義済み)
  components/
    Counter.tsx    (useState でカウントアップする例)
```

「ワークスペース初期化」コマンドは Phase 5（コマンドパレット）で別途提供。

### 自動保存

- 保存ボタン / Cmd+S は実装しない
- 編集から **800ms デバウンスで OPFS 自動書き込み**
- ダーティ表示（タブ名隣の `●`）は OPFS 未書き込み中のみ
- `beforeunload` で未書き込みバッファをフラッシュ

### 容量制限と例外

- `QuotaExceededError` をトーストで通知
- ファイル単体サイズ制限なし

## 3. エディタ・タブ管理

### タブの種類

| 種類 | 説明 |
|---|---|
| **コードタブ** | OPFS の 1 ファイルに対応、close/reorder/dirty 表示可、同一パスは 1 タブまで |
| **Preview タブ** | 常に 1 つだけ、close 不可、reorder 不可（右端固定） |

### TabManager

```ts
type Tab = {
  id: string                        // crypto.randomUUID()
  filePath: string                  // 重複排除 key
  cursor: { line: number; col: number } | null
  scrollTop: number
  dirty: boolean
}

class TabManager {
  tabs: Tab[]
  activeTabId: string | 'preview'
  open(filePath: string, mode?: 'preview' | 'pinned'): void
  close(tabId: string): void
  reorder(fromIdx: number, toIdx: number): void
  setActive(tabId: string | 'preview'): void
  saveSession(): void                // .browser-ide/session.json
  loadSession(): Promise<void>
}
```

### ファイルツリーからの開き方

| 操作 | 挙動 |
|---|---|
| シングルクリック | プレビュー的に開く（タブ斜体）。次のクリックで上書き |
| ダブルクリック | 通常の開き方（斜体解除、固定タブ化） |
| 右クリック | コンテキストメニュー |

### 右クリックメニュー

**ファイル**: 開く / プレビューで開く / リネーム / 削除 / 複製 / パスをコピー
**フォルダ**: 新規ファイル / 新規フォルダ / リネーム / 削除（再帰確認）/ 展開・折りたたみ
**ルート空白**: 新規ファイル / 新規フォルダ

### ドラッグ&ドロップ

- ファイル → フォルダ: 移動
- ファイル → ルート: ルート直下に移動
- フォルダ → 別フォルダ: 子孫込み移動
- タブ → 別タブの位置: タブ並び替え
- 実装: HTML5 DnD API（`react-dnd` 不採用）

### キーボードショートカット

| ショートカット | 動作 |
|---|---|
| `⌘W` | アクティブタブを閉じる |
| `⌘1`〜`⌘9` | 1〜9 番目のタブに切り替え |
| `⌘Enter` | Preview タブに切り替えて即実行（既存維持） |
| `⌘K` | チャット入力にフォーカス（既存維持） |
| `⌘P` | クイックオープン（ファイル名 fuzzy 検索） |
| `⌘Shift+P` | コマンドパレット（Phase 5） |

### セッション復元

`.browser-ide/session.json` 例:

```jsonc
{
  "tabs": [
    { "filePath": "/workspace/App.tsx", "cursor": { "line": 12, "col": 4 }, "scrollTop": 240 }
  ],
  "activeTabId": "<id>",
  "expandedFolders": ["/workspace/components"],
  "splitTree": 0.18,
  "splitChat": 0.26,
  "splitConsole": 0.22
}
```

500ms debounced で OPFS 書き込み。起動時に読み込んで復元。

## 4. プレビューと Bundling

### Bundler の入出力

```
[OPFS のファイル群] + [importmap.json]
       ↓
[Bundler Worker: esbuild-wasm + 解決プラグイン]
       ↓
[1 本の ESM コード文字列] → Blob URL → iframe で import()
```

iframe への注入手法は既存 `Preview.tsx` の Blob URL `import()` + `globalThis.App` 取り出しを温存。

### エントリポイント決定

```
1. /workspace/App.tsx があれば採用
2. なければ /workspace/main.tsx
3. なければ /workspace/index.tsx
4. それも無ければ「エントリ未設定」エラー
```

### Import 解決ルール（onResolve）

```
(1) 'http://...' / 'https://...'    → external 扱い
(2) './xxx' / '../xxx'              → 呼び出し元 dir + specifier を OPFS で解決
                                      拡張子省略時: .tsx → .ts → .jsx → .js → .css
                                      フォルダなら index.tsx を探す
(3) bare specifier
   (3a) importmap.json に定義あり    → 定義 URL に置換
   (3b) 定義無し                     → 'https://esm.sh/<specifier>' に置換
```

### onLoad ルール

```
(1) http(s) URL → fetch + text()、Map<url, content> でメモリキャッシュ
(2) OPFS パス  → FsAdapterSync.readFile()
(3) loader: .tsx/.ts → tsx, .jsx → jsx, .css → css, それ以外 → ts
```

### importmap.json

形式は HTML 標準の import map と同形:

```jsonc
{
  "imports": {
    "react": "https://esm.sh/react@19",
    "react-dom/client": "https://esm.sh/react-dom@19/client",
    "lodash": "https://esm.sh/lodash@4.17.21"
  }
}
```

普通のファイルとして編集（ツリーから開いてエディタで JSON 書き換え）。`JSON.parse` 失敗時はトースト警告 + 前回成功状態を保持。

### Re-bundle トリガ

```
ユーザー編集 ─→ 800ms debounce ─→ OPFS 書き込み
                                  ↓
                          OPFS 書き込みイベント
                                  ↓
                          200ms debounce
                                  ↓
                          Bundler.rebuild()
                                  ↓
                          Preview 更新
```

`⌘Enter` は debounce 無視で即時 rebuild。

### Bundler Worker 構造

```ts
// src/lib/bundler.ts （メイン側ファサード）
const worker = new Worker(
  new URL('../workers/bundler.worker.ts', import.meta.url),
  { type: 'module' }
)

const inflight = new Map<string, (r: BuildResult) => void>()
worker.onmessage = (e) => inflight.get(e.data.id)?.(e.data.result)

export function build(req: BuildRequest): Promise<BuildResult> {
  const id = crypto.randomUUID()
  return new Promise((resolve) => {
    inflight.set(id, resolve)
    worker.postMessage({ id, ...req })
  })
}
```

```ts
// src/workers/bundler.worker.ts
import * as esbuild from 'esbuild-wasm'
import { syncFsAdapter } from '../lib/fs-sync'

let initialized = false
self.onmessage = async (e) => {
  if (!initialized) {
    await esbuild.initialize({ wasmURL: '/esbuild.wasm' })
    initialized = true
  }
  const result = await esbuild.build({
    plugins: [opfsResolver(syncFsAdapter), esmShResolver(e.data.importMap)],
    entryPoints: [e.data.entry],
    bundle: true, format: 'esm', write: false,
  })
  self.postMessage({ id: e.data.id, result })
}
```

### ビルドエラー表示先

| 場所 | 内容 |
|---|---|
| Preview タブ内 | エラーメッセージ + スタックトレース、コードは直前成功状態維持 |
| エディタ gutter | エラー行ハイライト + アイコン |
| ステータスバー | 直近ビルド時間と `✓ OK` / `✗ Error` |

### CSS / 静的アセット

- `import './style.css'` は esbuild の css loader で `<style>` タグ注入
- 画像/PDF は Phase 2（仮想 Web サーバ待ち）

### Console 出力

VS Code Terminal 風、エディタ下に折りたたみ可能パネル:

```
┌─────────────────────────┐
│ ▼ Console        [×]    │
│ > [10:23] App rendered  │
│ > [10:24] Error: ...    │
└─────────────────────────┘
```

iframe → 親（postMessage）→ Console コンポで描画。レベル別色分け、フィルタ機能は Phase 2。

### 依存追加

- 新規: `diff`（jsdiff、~30KB）
- 既存維持: `esbuild-wasm`、`@huggingface/transformers`、CodeMirror 6 一式
- `vite.config.ts` の `optimizeDeps.exclude: ['@mlc-ai/web-llm']` を削除（旧スタックの遺物）

## 5. AI 適用 / Diff 承認

### LLM 応答フォーマット

````markdown
カウンターを作って App から呼び出します。

```tsx
// file: /workspace/components/Counter.tsx
import { useState } from 'react'
export function Counter() { ... }
```

```tsx
// file: /workspace/App.tsx
import { Counter } from './components/Counter'
export default function App() { return <Counter /> }
```
````

ルール:
- コードブロック 1 行目に `// file: <絶対パス>` コメント
- パスは `/workspace/` から始まる絶対パス
- 同じファイルが複数回出現したら最後を採用

### パーサーとフォールバック

```ts
function parseLLMResponse(markdown: string): ProposedFile[] {
  const blocks = markdown.matchAll(/```(\w+)\s*\n\/\/\s*file:\s*(.+?)\n([\s\S]*?)```/g)
  // ...
}
```

フォールバック:
1. `// file:` 無し + コードブロック 1 個 → アクティブタブを暗黙ターゲット
2. `// file:` 無し + コードブロック 2 個以上 → 「フォーマット崩れ、どれを適用？」リスト UI
3. コードブロック 0 個 → 普通の Chat 応答として残す
4. ワークスペース外パス（例 `/etc/...`）→ 無視

### ChangeSet 構造

```ts
type FileChange =
  | { kind: 'create'; path: string; newContent: string }
  | { kind: 'modify'; path: string; oldContent: string; newContent: string; hunks: Hunk[] }
  | { kind: 'delete'; path: string; oldContent: string }   // Phase 2 用、未使用

type ChangeSet = {
  id: string
  files: FileChange[]
  status: Map<path, 'pending' | 'accepted' | 'rejected'>
}
```

### Diff 計算

```ts
import { diffLines } from 'diff'

function computeHunks(oldContent: string, newContent: string): Hunk[] {
  return diffLines(oldContent, newContent).map(part => ({
    type: part.added ? 'add' : part.removed ? 'del' : 'context',
    lines: part.value.split('\n'),
  }))
}
```

### Diff 表示 UI（CodeMirror 6 inline gutter）

Cursor 風の inline 体験を Phase 1 から実装。

実装要素:

1. **Decoration**: `Decoration.line` で変更行の背景色（追加=緑系、削除=赤系）
2. **Gutter**: カスタム `gutterMarker` で `+` / `-` / `~` アイコン表示
3. **Floating buttons**: 変更ブロック上にホバーで `[Accept]` / `[Reject]` フローティングボタン
4. **StateField**: pending / accepted / rejected の 3 状態を CodeMirror state で保持
5. **LineMapping**: 旧/新の行番号対応マップを保持、部分 accept で再計算
6. **競合処理**: diff 表示中にユーザーが編集したら、その diff 提案は破棄してトースト警告

実装単位:

- `src/components/DiffView.tsx`: 単一ファイルの diff を表示するコンポ
- `src/lib/cm-diff-extension.ts`: CodeMirror 6 拡張本体（Decoration, Gutter, StateField）
- `src/components/DiffSession.tsx`: ChangeSet 全体を統括、ファイル間ナビゲーション

### 自動オープン挙動

- 応答完了時に **ChangeSet が 1 個以上あれば自動で diff モードへ切替**
- アクティブタブが該当ファイルなら inline gutter 表示
- 該当ファイルが開いてなければ自動で開く（プレビュー的タブとして）
- diff モード初回表示時に右上に「次回から手動で開く」リンク → クリックで `localStorage.bide.autoDiff = false`

### Apply 処理

```
1. ユーザーが Accept クリック（個別 hunk or ファイル全体 or All）
2. accepted 分の FileChange を抽出
3. FsAdapter で OPFS 書き込み（create は mkdir 再帰、modify は全文上書き）
4. WorkspaceStore.refresh で該当パスのキャッシュ更新
5. アクティブタブが対象だったらエディタに新内容を流し込む
6. Bundler.rebuild トリガ → Preview 更新
7. ChatPanel に「N 件適用しました」のシステムメッセージ追加
```

### エラーケース

- パース失敗: 「フォーマット認識不可、コードコピーしますか？」フォールバック
- 書き込み権限/容量エラー: トースト + 部分書き込み残置（atomic ロールバック未実装）
- 同名ファイルが直前に手動編集: 「このファイルは編集中です。AI 提案で上書きしていいですか？」確認ダイアログ

### コンテキスト注入（ハイブリッド）

#### 自動注入（ユーザー意識不要）

- 選択範囲があれば → 選択行 + 周囲 20 行
- 選択無し → アクティブファイル全文（行数によるスマート切り詰め）
- ワークスペースのファイル一覧（パスのみ）は常時

#### 明示注入（@ メンション）

- `@Counter.tsx` → そのファイル全文を追加注入
- `@components/` → そのフォルダ配下の全ファイル一覧（中身は注入しない）
- `@workspace` → 全ファイル一覧 + 主要ファイル冒頭 30 行

#### Explore モード（オプトイン）

- チャット入力欄左の `🔍 Explore` トグル
- ON: 全ファイルのシグネチャ抜粋（`export function`、`export const`、`export class` の行）を注入
- 横断的質問（"認証まわりどこ？"）に対応

#### スマート切り詰め

```ts
function formatActiveFile(tab: Tab): string {
  const lines = tab.content.split('\n')
  if (lines.length < 100) return fullContent(tab)
  if (lines.length < 500) return headTailContent(tab, 50, 50)  // 冒頭+末尾各50行
  return signatureOnly(tab)                                     // パスのみ
}
```

#### システムプロンプト構造

```
You are an AI assistant for BrowserIDE...

## Workspace files
- /workspace/App.tsx
- /workspace/components/Counter.tsx
- ...

## Active context
[A] Selection (when user has selected text):
File: /workspace/App.tsx (lines 12-18)
\`\`\`tsx
{selected text + 5 lines context}
\`\`\`

[B] Active file (when no selection):
Currently active file: /workspace/App.tsx
\`\`\`tsx
{full content or smart-truncated}
\`\`\`

## Referenced files (when @-mentioned)
File: /workspace/components/Counter.tsx
\`\`\`tsx
{full content}
\`\`\`

## Explore mode signatures (when Explore mode ON)
- /workspace/lib/util.ts:
  export function formatDate(d: Date): string
  export const API_URL: string

## Output format rules
[フォーマット指示]
```

#### トークン超過時の挙動

1. 過去のチャット履歴トリミング（最新 5 往復のみ）
2. それでも超えたらアクティブファイルを冒頭+末尾に縮める
3. それでも超えたら警告: 「コンテキストが大きすぎます」

## Phase 1 スコープ確定

### マスト（Phase 1 完成条件）

- [ ] 4 ペインレイアウト（縦 Splitter 含む）
- [ ] OPFS ファイルシステム + FsAdapter + FsAdapterSync
- [ ] WorkspaceStore とツリー UI
- [ ] フォルダ階層付き CRUD（右クリックメニュー）
- [ ] DnD（ファイル移動・タブ並び替え）
- [ ] TabManager + マルチタブエディタ
- [ ] セッション復元（リロードで完全復元）
- [ ] Bundler Worker + esbuild-wasm + import 解決プラグイン
- [ ] importmap.json サポート
- [ ] esm.sh による npm パッケージ動的解決
- [ ] エラー表示（Preview / gutter / ステータスバー 3 か所）
- [ ] Console パネル（折りたたみ可、postMessage 連携）
- [ ] LLM 応答パーサー + ChangeSet
- [ ] diff 計算 (jsdiff)
- [ ] CodeMirror 6 inline gutter による diff 表示
- [ ] 個別 hunk Accept/Reject + ファイル単位 + 全体一括
- [ ] Apply 後の OPFS 書き込み + 再 bundle
- [ ] コンテキスト注入: 暗黙 + `@filename` テキストパース + スマート切り詰め
- [ ] 起動時 seed
- [ ] 自動保存（800ms debounce）
- [ ] キーボードショートカット（`⌘W` / `⌘1-9` / `⌘P`）

### ナイス・トゥ・ハブ（Phase 1 で時間あれば）

- [ ] `@` 入力時のオートコンプリート UI
- [ ] Explore モード（シグネチャ抜粋）
- [ ] `⌘P` クイックオープンの fuzzy 検索

### Phase 2 以降に明示的に送る

- 仮想 Web サーバ（Service Worker）
- 画像/PDF プレビュー
- isomorphic-git 統合
- インライン補完 (grey テキスト)
- Cmd+K インライン編集
- コマンドパレット
- `@workspace` のキーワード絞り込み RAG
- ワークスペース初期化コマンド
- 設定 UI（自動オープン切替等）
- atomic ロールバック付き Apply

## リスクと未解決事項

### リスク

| リスク | 影響 | 緩和策 |
|---|---|---|
| esbuild-wasm v0.28 の `incremental` API が不安定 | rebuild 速度劣化 | 不安定なら毎回 fresh build、CDN キャッシュで補う |
| OPFS の `createSyncAccessHandle` が Safari で完全動作するか不確実 | Safari ユーザー体験低下 | 検出時は async API にフォールバック、警告トースト |
| 7B モデルの `// file:` フォーマット追従率 78〜85% | パース失敗時の混乱 | 4 段フォールバック実装で実質 95% カバー |
| CodeMirror 6 の inline diff gutter が想定より重い | Phase 1 完成遅延 | リスク高、最悪モーダル方式へのフォールバック計画を持つ |
| LLM 推論中に Bundler が並列で重い処理 | 体感劣化 | esbuild=CPU、LLM=GPU で物理リソース衝突せず、現実的には問題なし |

### 確定事項（暫定デフォルト、運用後に再検討）

- **importmap.json バリデーション失敗時の通知**: トースト + ステータスバーに `✗ importmap.json` 警告。前回成功時の状態で bundle 続行
- **diff 表示中の編集**: 編集禁止（CodeMirror を read-only に切り替え）。「先に diff を Accept/Reject してください」のヒント表示
- **session.json の互換性**: 最初からトップレベルに `"version": 1` フィールド。読み込み時に version mismatch なら無視して新規作成
- **並列 AI 応答**: Phase 1 はキューイング不要（同時に 1 応答想定）。新規送信時に進行中の応答を abort して新規開始（既存 abortRequested フラグを流用）

## ロールアウト方針

Phase 1 完成までの想定実装期間: **3〜5 週間**（5-2 の inline gutter 実装が大きい）

実装順序の推奨（writing-plans で詳細化）:

1. **Week 1**: FsAdapter + WorkspaceStore + 基本ファイルツリー UI（CRUD なし、表示のみ）
2. **Week 2**: TabManager + マルチタブエディタ + セッション復元
3. **Week 3**: Bundler Worker + 複数ファイル import 解決 + Console
4. **Week 4**: LLM パーサー + ChangeSet + jsdiff 計算
5. **Week 5**: CodeMirror 6 inline gutter + Apply フロー（最も難易度高）

各 Week 終了時に動作検証（dev server で実機ブラウザ確認）。

## 参考資料

- [DESIGN.md](../../../DESIGN.md) — プロジェクト全体の設計書
- [README.md](../../../README.md) — プロジェクト概要
- 既存コード: `src/App.tsx`, `src/components/*`, `src/workers/llm.worker.ts`, `src/lib/hardware.ts`
