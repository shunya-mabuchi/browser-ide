# BrowserIDE 設計書

## プロジェクト概要

**プロダクト名**: 未定（仮称: BrowserIDE）

**コンセプト**: 完全ブラウザ完結・永続無料・依存最小のAI付きIDE。WebLLMでブラウザ内ローカル推論を行い、コードもデータも外部に出ない。

**思想・優先順位**:
1. 永続無料・無制限（クラウドAPIに依存しない）
2. プライバシー（コードがサーバーに送られない）
3. オフライン動作可能
4. インストール不要（ブラウザのみ）
5. 依存先を最小化（サービス終了リスクの低減)

**作者の動機**: 環境を汚さず、永続的にバイブコーディングをしたい。クラウドAI無料枠は将来縮小・有料化されうるが、ローカル推論なら本当の意味で永続無料。モデルとハードウェアの進化で時間と共に価値が増す資産になる。

---

## 確定した技術スタック

### Phase 1（最初の2週間目標）のミニマル構成

```
[UI Layer]
  React 18 + TypeScript    # UIフレームワーク
  Vite                     # ビルドツール
  vite-plugin-pwa          # PWA対応（最初から徹底）
  Tailwind CSS             # スタイリング
  lucide-react             # アイコン

[Editor]
  CodeMirror 6             # エディタ（Monacoより軽量・モバイル対応良好）
  ※ TypeScript型チェックの完成度のみMonacoに劣る、後で@typescript/vfs統合可能

[AI Inference]
  @mlc-ai/web-llm          # ブラウザ内LLM推論エンジン
  Web Worker               # メインスレッドブロック防止
  モデル: 実装時点でのコード特化モデル最新版から選ぶ
  ※ Qwen2.5-Coder系が現状の有力候補だが、開発時に再評価

[Code Execution]
  esbuild-wasm             # JS/TSトランスパイル
  iframe                   # サンドボックス実行

[Service Worker]
  最小Service Worker        # PWAキャッシュ用（Phase 2で仮想Webサーバ機能追加）
```

### Phase 2 以降の追加項目

```
[Phase 2: 仮想Webサーバ + 画像対応]
  - Service Worker拡張（静的アセット配信）
  - 画像ビューア（<img> + blob URL）
  - PDFプレビュー（iframe + blob URL、pdfjs-distは不要）
  - <audio>/<video>タグ
  - ファイルツリーUI、複数ファイル編集
  - OPFS（自動保存・大きいバイナリ用）

[Phase 3: Git統合]
  - isomorphic-git + lightning-fs（ブラウザ内Git）
  - GitHub OAuth or PAT認証
  - clone/commit/push/pull/branch/merge
  - diff表示
  - jszip（プロジェクトexport/import）
  - @octokit/rest（PR、Issue操作）

[Phase 4: AI機能本格化 + バックエンド]
  - インライン補完（タイプ中grey候補）
  - Cmd+K インライン編集
  - チャットの複数ファイルコンテキスト
  - diff承認UI
  - Service WorkerでAPIルーティング
  - Honoまたは素のSWでバックエンドハンドラ（Phase 4時に判断）
  - pglite or sql.js（ローカルDB、Phase 4時に判断）
  - Pyodide（Python実行、必要なら）

[Phase 5: 仕上げ・PWA完全対応]
  - 設定UI、モデル推薦機能
  - ハードウェア検出(WebGPU adapter info、deviceMemory)
  - コマンドパレット（Cmd+Shift+P）
  - Lint/Format/Testタスクボタン
  - shadcn/ui統合（必要なら）
  - File System Access API（オプション、Chromium限定）
  - 完全オフライン動作確認

[Phase 6: モバイル対応（将来）]
  - react-native-web統合
  - iPhone/Android枠UIプレビュー
  - Expo Go QRコード対応
    - esbuild-wasmでbundle.jsビルド
    - Cloudflare Pages/R2に自動アップロード
    - QRコード生成（qrcodeライブラリ）
    - 実機Expo Goでスキャン → カメラ・GPS等のネイティブ機能含めて動作確認
  - ※ iOS/Android実機ビルドは原理的に不可能、ストア提出は外部ツール必要
```

### 採用しなかった/見送った技術

```
- Monaco Editor → CodeMirror 6に決定（バンドル軽量、モバイル対応）
- shadcn/ui（Phase 1）→ Phase 2以降で必要なら追加
- Hono（Phase 1）→ Phase 4で再判断、最初は素のSWで書く
- workbox-window → 不要、素のService Worker APIで十分
- Pyodide（デフォルト）→ Python必要時のみ追加、デフォルトから外す
- pdfjs-dist → 不要、ブラウザ標準PDF表示で十分
- @typescript/vfs → Phase 4以降で必要なら追加
- File System Access API（Phase 1〜4）→ Chromium限定なのでPhase 5オプション扱い
- WebContainers → 商用利用制限ありで採用せず
- モデル事前ロード共有機能 → 一旦不要
- Ollama/LM Studio連携 → 不採用（思想と矛盾、推論性能はWebGPUの制約内で受容）
- WebUSB経由のNPU直接アクセス → 不採用（実装コストで破綻）
```

### 推論性能の現実的な上限

- ブラウザWebGPUで実用的に動くモデル: 〜7B程度（量子化込み）
- ハイエンドPC（VRAM 16GB+）でも実用速度を考えると7B〜13Bが実質上限
- 32B以上の大型モデルは諦める方針
- 「クラウドAPIや外部Ollamaなら使える大型モデル」は本プロジェクトのスコープ外
- 思想を一貫させるため、推論性能の天井はWebGPU/WebLLMに従う

### ホスティング戦略

```
メイン: Cloudflare Pages（無制限帯域、商用OK、500ビルド/月）
ミラー（保険）: GitHub Pages
将来: Cloudflare R2でモデル自前ホストの選択肢を残す
```

### 言語対応戦略

```
第一級（編集 + 実行）: JS/TS/HTML/CSS/React/Vue/Svelte
第二級（編集 + 実行、必要時のみ）: Python（Pyodide遅延ロード）
第三級（編集 + AI生成のみ）: Rust/Go/C++等
バックエンド: TypeScript + Service Worker（同コードがCloudflare Workersで本番動作）
```

---

## アーキテクチャ概要

```
[ブラウザ内（すべてローカル）]
  ┌─────────────────────────────────┐
  │ UI Layer                          │
  │   CodeMirror | Chat | Files | Preview │
  ├─────────────────────────────────┤
  │ AI Worker（WebLLM + モデル）     │
  ├─────────────────────────────────┤
  │ Code Engine        | Git Engine  │
  │ esbuild-wasm       | isomorphic  │
  │ Pyodide(任意)      | -git        │
  ├─────────────────────────────────┤
  │ Service Worker（PWA + 仮想サーバ）│
  ├─────────────────────────────────┤
  │ IndexedDB | OPFS                 │
  └─────────────────────────────────┘
       ↑              ↑              ↑
  Cloudflare Pages  MLC CDN      GitHub
  （アプリ配信）   （モデルDL）  （Git protocol + API）
```

---

## IDE機能の設計方針

### エディタファースト + AI支援（Cursor的）

自然言語のみで動かすのではなく、VS Codeライクな普通のエディタとして使えつつ、AI機能を呼び出せる構成。

**AIへの3つの入り口**:
1. **インライン補完**: タイプ中にgreyテキストで候補表示、Tabで確定
2. **インライン編集**: Cmd+Kで選択範囲に対して自然言語で指示
3. **チャットパネル**: サイドバーで会話、ファイルをコンテキストに含められる

**全AI変更は差分プレビュー → 承認制**。

### ファイル管理（Phase 3で実装）

isomorphic-git + lightning-fsで仮想Git環境を持つ。GitHubと連携しつつ、オフラインでも作業可能。

```
コア機能:        isomorphic-git（仮想FS上で完全なGit）
GitHub高度連携:  @octokit/rest（PR、Issue作成）
補助:            OPFS（自動保存）

制約（許容する）:
  - rebase -i、Submodule、Git Worktreeは非対応
  - 必要時はzipエクスポート→ローカルでgit→戻す運用
  - 巨大モノレポ（500MB+）は性能劣化
```

### 画像・バイナリ対応

```
- isomorphic-gitはバイナリ対応OK、画像はGit管理可能
- 大きいバイナリ（〜50MB）はOPFSで管理、Git外
- プレビュー時はService Worker + blob URLで配信
- 画像/PDF/音声/動画はブラウザ標準で表示
```

### バックエンド対応

```
- TypeScript + Service Workerで擬似実行
- 同じコードが本番Cloudflare Workersで動作
- ローカルDB（pglite/sql.js）でフルスタック開発可能
- 本番デプロイのみ外部サービス（Cloudflare Workers等）
```

---

## Phase 1 実装の具体的タスク

### 達成基準
- [ ] ブラウザで開ける（Cloudflare Pagesにデプロイ）
- [ ] CodeMirror 6でReactコンポーネントが書ける
- [ ] "Run"ボタンで右側iframeにプレビュー表示
- [ ] チャット欄に質問するとWebLLM(Qwen)が答える
- [ ] AI応答のコードを「適用」するとエディタに反映
- [ ] 1回目DL後はオフラインで起動可能（PWA）
- [ ] 複数モデル切り替えUI（最低7B/3B/1.5B）

### スケジュール目安

```
Day 1-2:   Vite + React環境立ち上げ、PWA設定、CodeMirror画面表示
Day 3-4:   esbuild-wasm統合、"Run"ボタンでiframeプレビュー
Day 5-6:   WebLLMをWeb Workerで動かす、最小チャットUI
Day 7-8:   AI応答からコードブロック抽出 → エディタ反映の動線
Day 9-10:  モデル切り替えUI、Tailwind/lucide-reactで仕上げ
Day 11-12: Cloudflare Pagesデプロイ、PWA動作確認
Day 13-14: 自分で実使用、ベンチマーク（tok/s計測、メモリ確認）
```

### 注意点・心構え

**完璧主義を捨てる**: Phase 1は動けばOK。Tailwind配色がダサくても、エラーハンドリングが雑でも、設定画面がなくても良い。

**捨てる前提で書く**: Phase 1のコードはPhase 3か4で大幅書き直し前提。最初から綺麗な設計を目指すと永遠に動かない。

**最重要リスク**: WebLLMが手元のマシンで実用速度で動くか。Phase 1完成後に必ずベンチマーク。遅すぎたらモデル選定からやり直し。

---

## 公開戦略（将来）

```
Stage 1: Phase 1〜3完成、自分専用ツールとして使い倒す、友人βテスト
Stage 2: Phase 5完成、GitHub公開、r/LocalLLaMA・HackerNews投稿
Stage 3: Phase 6完成、ProductHunt公開、Discord立ち上げ、独自ドメイン
Stage 4: 収益化判断（GitHub Sponsors / フリーミアム / 企業ライセンス等）
```

サービス化のターゲット層: プライバシー重視の開発者、オフライン環境で開発する人、教育用途、発展途上国の開発者、コスト意識の高い学生・趣味開発者、依存したくない思想を持つ開発者。

---

## Claude Code CLI 用プロンプト例

このドキュメントをそのままClaude Codeに渡して、以下のように指示すれば開始できます:

```
このドキュメントは「BrowserIDE」プロジェクトの設計書です。
Phase 1の実装を開始したいので、以下を順に進めてください:

1. Day 1のタスクから開始してほしい
2. プロジェクトディレクトリを作成、Vite + React + TypeScriptで初期化
3. vite-plugin-pwa、Tailwind CSS、lucide-react、CodeMirror 6を導入
4. 基本的なUI構造（左:エディタ、右上:プレビュー、右下:チャット）を作成
5. 各ステップで動作確認できる状態を保ちながら進める

完璧主義は不要、Phase 1は「動けばOK」の精神で進めてください。
```

---

## 議論で決めなかった項目（将来判断）

- 具体的なモデル選定（実装時点で最新を選ぶ）
- shadcn/ui の採用タイミング（必要になったら）
- Hono の採用（Phase 4で判断）
- pglite vs sql.js（Phase 4で判断）
- 収益化戦略（実用後に判断）
- プロダクト正式名称（公開時に決定）
