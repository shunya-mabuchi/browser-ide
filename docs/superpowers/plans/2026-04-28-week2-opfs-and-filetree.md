# Week 2: OPFS ファイルシステム + ファイルツリー — 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OPFS（Origin Private File System）を使ってブラウザ内に永続化されるファイルシステムを構築し、Week 1 で placeholder だった FileTree を実装に置き換える。フォルダ階層・CRUD・DnD・右クリックメニュー・自動保存に対応。

**Architecture:** FsAdapter インタフェースを定義し、テスト用 MemoryFsAdapter / 本番用 OpfsFsAdapter の 2 実装を持つ。WorkspaceStore がツリーをキャッシュして購読パターンで通知。React 側は `useWorkspace` フックで統合。FileTree は再帰的に TreeNode を描画。アクティブファイルのコードを編集すると 800ms デバウンスで OPFS に書き込み。

**Tech Stack:** React 19, TypeScript, OPFS (navigator.storage.getDirectory), Vitest（既存）, lucide-react アイコン（既存）

**対応する spec**: [2026-04-27-multi-pane-ide-redesign-design.md](../specs/2026-04-27-multi-pane-ide-redesign-design.md) のセクション 2（OPFS とファイルシステム）+ セクション 3 のファイルツリー / 右クリックメニュー / DnD 部分

---

## ファイル構成

| 種別 | パス | 責務 |
|---|---|---|
| 新規 | `src/lib/fsPath.ts` | パス文字列操作の純関数（join / parent / basename / extname / normalize） |
| 新規 | `src/lib/fs.ts` | `FsAdapter` インタフェース + `FsEntry` 型定義 |
| 新規 | `src/lib/fsMemory.ts` | テスト用 in-memory 実装 |
| 新規 | `src/lib/fsOpfs.ts` | 本番用 OPFS 実装（`navigator.storage.getDirectory()` ベース） |
| 新規 | `src/lib/workspace.ts` | `WorkspaceStore`（ツリーキャッシュ + 購読 + CRUD） |
| 新規 | `src/lib/seed.ts` | 初回起動時のサンプルプロジェクト bootstrap |
| 新規 | `src/hooks/useWorkspace.ts` | React 統合フック |
| 新規 | `src/components/TreeNode.tsx` | ツリー 1 行（ファイル or フォルダ）の描画 |
| 新規 | `src/components/FileTree.tsx` | ツリー全体の root コンポーネント（FileTreePlaceholder の置換先） |
| 新規 | `src/components/FileTreeContextMenu.tsx` | 右クリックメニュー |
| 修正 | `src/App.tsx` | アクティブファイル管理、自動保存、FileTreePlaceholder 撤去 |
| 削除 | `src/components/FileTreePlaceholder.tsx` | FileTree に置換、不要 |
| 新規 | `src/lib/__tests__/fsPath.test.ts` | パス操作の単体テスト |
| 新規 | `src/lib/__tests__/fsMemory.test.ts` | MemoryFsAdapter の単体テスト |
| 新規 | `src/lib/__tests__/workspace.test.ts` | WorkspaceStore の単体テスト |

---

## Task 1: パス操作ユーティリティ

**Files:**
- Create: `src/lib/fsPath.ts`
- Test: `src/lib/__tests__/fsPath.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/fsPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pathJoin, parent, basename, extname, normalize, isWithin, splitPath } from '../fsPath'

describe('pathJoin', () => {
  it('絶対パスと相対パスを結合', () => {
    expect(pathJoin('/a/b', 'c')).toBe('/a/b/c')
  })
  it('末尾の / を正規化', () => {
    expect(pathJoin('/a/', '/b/', 'c')).toBe('/a/b/c')
  })
  it('単一の絶対パスはそのまま', () => {
    expect(pathJoin('/a/b/c')).toBe('/a/b/c')
  })
})

describe('parent', () => {
  it('親ディレクトリを返す', () => {
    expect(parent('/a/b/c.tsx')).toBe('/a/b')
  })
  it('ルート直下なら "/"', () => {
    expect(parent('/a')).toBe('/')
  })
  it('"/" の親は "/"', () => {
    expect(parent('/')).toBe('/')
  })
})

describe('basename', () => {
  it('ファイル名を返す', () => {
    expect(basename('/a/b/c.tsx')).toBe('c.tsx')
  })
  it('末尾 / を無視', () => {
    expect(basename('/a/b/')).toBe('b')
  })
  it('"/" は ""', () => {
    expect(basename('/')).toBe('')
  })
})

describe('extname', () => {
  it('拡張子を返す', () => {
    expect(extname('/a/b.tsx')).toBe('.tsx')
  })
  it('拡張子なしなら ""', () => {
    expect(extname('/a/b')).toBe('')
  })
  it('複数 . の場合は最後の . から', () => {
    expect(extname('/a.test.ts')).toBe('.ts')
  })
})

describe('normalize', () => {
  it('. を除去', () => {
    expect(normalize('/a/./b')).toBe('/a/b')
  })
  it('.. で親に上る', () => {
    expect(normalize('/a/b/../c')).toBe('/a/c')
  })
  it('連続スラッシュをまとめる', () => {
    expect(normalize('/a//b///c')).toBe('/a/b/c')
  })
  it('"/.." はルート以下に出ない', () => {
    expect(normalize('/..')).toBe('/')
  })
})

describe('isWithin', () => {
  it('子パスは true', () => {
    expect(isWithin('/a/b/c', '/a')).toBe(true)
  })
  it('同じパスは true', () => {
    expect(isWithin('/a', '/a')).toBe(true)
  })
  it('別の枝は false', () => {
    expect(isWithin('/a/b', '/a/c')).toBe(false)
  })
  it('部分一致のディレクトリ名は false', () => {
    expect(isWithin('/abc', '/a')).toBe(false)
  })
})

describe('splitPath', () => {
  it('セグメントに分解', () => {
    expect(splitPath('/a/b/c')).toEqual(['a', 'b', 'c'])
  })
  it('"/" は空配列', () => {
    expect(splitPath('/')).toEqual([])
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/fsPath.test.ts
```

期待: `Cannot find module '../fsPath'`

- [ ] **Step 3: `src/lib/fsPath.ts` を実装**

```ts
export function splitPath(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0)
}

export function normalize(path: string): string {
  const segs = splitPath(path)
  const result: string[] = []
  for (const s of segs) {
    if (s === '.') continue
    if (s === '..') {
      result.pop()
      continue
    }
    result.push(s)
  }
  return '/' + result.join('/')
}

export function pathJoin(...parts: string[]): string {
  const all = parts
    .flatMap((p) => splitPath(p))
  return normalize('/' + all.join('/'))
}

export function parent(path: string): string {
  const segs = splitPath(path)
  if (segs.length <= 1) return '/'
  return '/' + segs.slice(0, -1).join('/')
}

export function basename(path: string): string {
  const segs = splitPath(path)
  return segs[segs.length - 1] ?? ''
}

export function extname(path: string): string {
  const name = basename(path)
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.slice(idx)
}

export function isWithin(child: string, ancestor: string): boolean {
  const c = normalize(child)
  const a = normalize(ancestor)
  if (c === a) return true
  if (a === '/') return c.startsWith('/')
  return c.startsWith(a + '/')
}
```

- [ ] **Step 4: テスト実行で 17 件 pass 確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/fsPath.test.ts
```

期待: 17 件 pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/fsPath.ts src/lib/__tests__/fsPath.test.ts
git commit -m "feat: パス操作ユーティリティ（pathJoin / parent / basename / extname / normalize / isWithin）"
```

---

## Task 2: FsAdapter インタフェース定義

**Files:**
- Create: `src/lib/fs.ts`

- [ ] **Step 1: `src/lib/fs.ts` を作成**

```ts
export type FsEntry = {
  name: string
  path: string
  kind: 'file' | 'dir'
}

export interface FsAdapter {
  /** ファイル内容を読む。存在しなければ throw */
  readFile(path: string): Promise<string>
  /** ファイルを書く（既存上書き、親ディレクトリは自動作成） */
  writeFile(path: string, content: string): Promise<void>
  /** エントリを削除（フォルダは再帰削除） */
  delete(path: string): Promise<void>
  /** リネーム/移動 */
  rename(from: string, to: string): Promise<void>
  /** ディレクトリ作成（中間も再帰） */
  mkdir(path: string): Promise<void>
  /** 1 階層分のエントリを返す（再帰しない） */
  list(dirPath: string): Promise<FsEntry[]>
  /** 存在チェック */
  exists(path: string): Promise<boolean>
}

export class FsError extends Error {
  constructor(message: string, public code: 'NOT_FOUND' | 'EXISTS' | 'NOT_DIR' | 'NOT_FILE' | 'QUOTA' | 'IO') {
    super(message)
    this.name = 'FsError'
  }
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/fs.ts
git commit -m "feat: FsAdapter インタフェースと FsError を定義"
```

---

## Task 3: MemoryFsAdapter（テスト用 in-memory 実装）

**Files:**
- Create: `src/lib/fsMemory.ts`
- Test: `src/lib/__tests__/fsMemory.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/fsMemory.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryFsAdapter } from '../fsMemory'
import { FsError } from '../fs'

describe('MemoryFsAdapter', () => {
  let fs: MemoryFsAdapter

  beforeEach(() => {
    fs = new MemoryFsAdapter()
  })

  it('writeFile + readFile の往復', async () => {
    await fs.writeFile('/foo.txt', 'hello')
    expect(await fs.readFile('/foo.txt')).toBe('hello')
  })

  it('writeFile で深い階層も自動作成', async () => {
    await fs.writeFile('/a/b/c/d.txt', 'deep')
    expect(await fs.readFile('/a/b/c/d.txt')).toBe('deep')
    expect(await fs.exists('/a/b/c')).toBe(true)
  })

  it('未存在の readFile は throw', async () => {
    await expect(fs.readFile('/nope')).rejects.toBeInstanceOf(FsError)
  })

  it('exists は true/false を返す', async () => {
    await fs.writeFile('/x', 'y')
    expect(await fs.exists('/x')).toBe(true)
    expect(await fs.exists('/nope')).toBe(false)
  })

  it('mkdir で空ディレクトリ作成', async () => {
    await fs.mkdir('/empty')
    expect(await fs.exists('/empty')).toBe(true)
    expect(await fs.list('/empty')).toEqual([])
  })

  it('list は 1 階層分のみ返す（再帰しない）', async () => {
    await fs.writeFile('/a.txt', 'a')
    await fs.writeFile('/dir/b.txt', 'b')
    await fs.mkdir('/dir/sub')
    const entries = await fs.list('/')
    const names = entries.map((e) => e.name).sort()
    expect(names).toEqual(['a.txt', 'dir'])
  })

  it('list は kind を正しく返す', async () => {
    await fs.writeFile('/a.txt', 'a')
    await fs.mkdir('/d')
    const entries = await fs.list('/')
    const aFile = entries.find((e) => e.name === 'a.txt')
    const dDir = entries.find((e) => e.name === 'd')
    expect(aFile?.kind).toBe('file')
    expect(dDir?.kind).toBe('dir')
  })

  it('delete でファイル削除', async () => {
    await fs.writeFile('/x', 'y')
    await fs.delete('/x')
    expect(await fs.exists('/x')).toBe(false)
  })

  it('delete でディレクトリ再帰削除', async () => {
    await fs.writeFile('/d/a.txt', 'a')
    await fs.writeFile('/d/sub/b.txt', 'b')
    await fs.delete('/d')
    expect(await fs.exists('/d')).toBe(false)
    expect(await fs.exists('/d/sub/b.txt')).toBe(false)
  })

  it('rename はファイル移動', async () => {
    await fs.writeFile('/old.txt', 'content')
    await fs.rename('/old.txt', '/new.txt')
    expect(await fs.exists('/old.txt')).toBe(false)
    expect(await fs.readFile('/new.txt')).toBe('content')
  })

  it('rename はディレクトリも移動', async () => {
    await fs.writeFile('/d/a.txt', 'a')
    await fs.rename('/d', '/d2')
    expect(await fs.readFile('/d2/a.txt')).toBe('a')
    expect(await fs.exists('/d')).toBe(false)
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/fsMemory.test.ts
```

期待: `Cannot find module '../fsMemory'`

- [ ] **Step 3: `src/lib/fsMemory.ts` を実装**

```ts
import { FsAdapter, FsEntry, FsError } from './fs'
import { splitPath, parent, basename, isWithin, normalize, pathJoin } from './fsPath'

type Node =
  | { kind: 'file'; content: string }
  | { kind: 'dir' }

export class MemoryFsAdapter implements FsAdapter {
  private nodes = new Map<string, Node>()

  constructor() {
    this.nodes.set('/', { kind: 'dir' })
  }

  async readFile(path: string): Promise<string> {
    const p = normalize(path)
    const node = this.nodes.get(p)
    if (!node) throw new FsError(`Not found: ${p}`, 'NOT_FOUND')
    if (node.kind !== 'file') throw new FsError(`Not a file: ${p}`, 'NOT_FILE')
    return node.content
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = normalize(path)
    await this.mkdir(parent(p))
    this.nodes.set(p, { kind: 'file', content })
  }

  async delete(path: string): Promise<void> {
    const p = normalize(path)
    if (p === '/') throw new FsError('Cannot delete root', 'IO')
    if (!this.nodes.has(p)) return
    for (const key of [...this.nodes.keys()]) {
      if (isWithin(key, p)) this.nodes.delete(key)
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const f = normalize(from)
    const t = normalize(to)
    if (!this.nodes.has(f)) throw new FsError(`Not found: ${f}`, 'NOT_FOUND')
    if (this.nodes.has(t)) throw new FsError(`Exists: ${t}`, 'EXISTS')
    await this.mkdir(parent(t))
    for (const key of [...this.nodes.keys()]) {
      if (isWithin(key, f)) {
        const suffix = key.slice(f.length)
        const newKey = normalize(t + suffix)
        const node = this.nodes.get(key)!
        this.nodes.delete(key)
        this.nodes.set(newKey, node)
      }
    }
  }

  async mkdir(path: string): Promise<void> {
    const p = normalize(path)
    const segs = splitPath(p)
    let acc = ''
    for (const s of segs) {
      acc = acc + '/' + s
      if (!this.nodes.has(acc)) {
        this.nodes.set(acc, { kind: 'dir' })
      } else {
        const existing = this.nodes.get(acc)!
        if (existing.kind !== 'dir') throw new FsError(`Not a dir: ${acc}`, 'NOT_DIR')
      }
    }
    if (segs.length === 0 && !this.nodes.has('/')) {
      this.nodes.set('/', { kind: 'dir' })
    }
  }

  async list(dirPath: string): Promise<FsEntry[]> {
    const dir = normalize(dirPath)
    const dirNode = this.nodes.get(dir)
    if (!dirNode) throw new FsError(`Not found: ${dir}`, 'NOT_FOUND')
    if (dirNode.kind !== 'dir') throw new FsError(`Not a dir: ${dir}`, 'NOT_DIR')

    const out: FsEntry[] = []
    const dirSegs = splitPath(dir).length
    for (const [path, node] of this.nodes) {
      if (path === dir) continue
      if (!isWithin(path, dir)) continue
      const segs = splitPath(path)
      if (segs.length !== dirSegs + 1) continue
      out.push({
        name: basename(path),
        path,
        kind: node.kind,
      })
    }
    return out
  }

  async exists(path: string): Promise<boolean> {
    return this.nodes.has(normalize(path))
  }

  // Helper for tests
  _dump(): string[] {
    return [...this.nodes.keys()].sort()
  }

  _withRoot(prefix: string): string[] {
    return this._dump().filter((p) => isWithin(p, prefix))
  }

  _join = pathJoin // re-export for convenience in tests if needed
}
```

- [ ] **Step 4: テスト実行で 11 件 pass 確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/fsMemory.test.ts
```

期待: 11 件 pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/fsMemory.ts src/lib/__tests__/fsMemory.test.ts
git commit -m "feat: MemoryFsAdapter（テスト用 in-memory 実装）+ 11 件のテスト"
```

---

## Task 4: OpfsFsAdapter（本番用 OPFS 実装）

**Files:**
- Create: `src/lib/fsOpfs.ts`

OPFS はブラウザ依存で jsdom で動かないため単体テスト不可。ロジックは MemoryFsAdapter で検証済みなので、ここでは API 呼び出しのラッパーのみ。手動で動作検証する。

- [ ] **Step 1: `src/lib/fsOpfs.ts` を実装**

```ts
import { FsAdapter, FsEntry, FsError } from './fs'
import { splitPath, parent, basename, normalize } from './fsPath'

export class OpfsFsAdapter implements FsAdapter {
  private rootPromise: Promise<FileSystemDirectoryHandle> | null = null

  private async root(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootPromise) {
      this.rootPromise = navigator.storage.getDirectory()
    }
    return this.rootPromise
  }

  private async getDirHandle(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    const segs = splitPath(normalize(path))
    let dir = await this.root()
    for (const s of segs) {
      try {
        dir = await dir.getDirectoryHandle(s, { create })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          throw new FsError(`Not found: ${path}`, 'NOT_FOUND')
        }
        if (err instanceof DOMException && err.name === 'TypeMismatchError') {
          throw new FsError(`Not a dir: ${path}`, 'NOT_DIR')
        }
        throw new FsError(String(err), 'IO')
      }
    }
    return dir
  }

  private async getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const dir = await this.getDirHandle(parent(path), create)
    try {
      return await dir.getFileHandle(basename(path), { create })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new FsError(`Not found: ${path}`, 'NOT_FOUND')
      }
      if (err instanceof DOMException && err.name === 'TypeMismatchError') {
        throw new FsError(`Not a file: ${path}`, 'NOT_FILE')
      }
      throw new FsError(String(err), 'IO')
    }
  }

  async readFile(path: string): Promise<string> {
    const handle = await this.getFileHandle(path, false)
    const file = await handle.getFile()
    return file.text()
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = await this.getFileHandle(path, true)
    try {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new FsError('Storage quota exceeded', 'QUOTA')
      }
      throw new FsError(String(err), 'IO')
    }
  }

  async delete(path: string): Promise<void> {
    const p = normalize(path)
    if (p === '/') throw new FsError('Cannot delete root', 'IO')
    const dir = await this.getDirHandle(parent(p), false)
    try {
      await dir.removeEntry(basename(p), { recursive: true })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') return
      throw new FsError(String(err), 'IO')
    }
  }

  async rename(from: string, to: string): Promise<void> {
    // OPFS にはネイティブ rename がないため copy + delete で実装
    const f = normalize(from)
    const t = normalize(to)
    if (await this.exists(t)) throw new FsError(`Exists: ${t}`, 'EXISTS')
    await this.copy(f, t)
    await this.delete(f)
  }

  private async copy(from: string, to: string): Promise<void> {
    const fromExists = await this.exists(from)
    if (!fromExists) throw new FsError(`Not found: ${from}`, 'NOT_FOUND')

    // Determine if from is file or dir
    try {
      const content = await this.readFile(from)
      await this.writeFile(to, content)
      return
    } catch (err) {
      if (err instanceof FsError && err.code === 'NOT_FILE') {
        // It's a directory
        await this.mkdir(to)
        const entries = await this.list(from)
        for (const entry of entries) {
          await this.copy(entry.path, normalize(to + '/' + entry.name))
        }
        return
      }
      throw err
    }
  }

  async mkdir(path: string): Promise<void> {
    await this.getDirHandle(path, true)
  }

  async list(dirPath: string): Promise<FsEntry[]> {
    const dir = await this.getDirHandle(dirPath, false)
    const out: FsEntry[] = []
    const base = normalize(dirPath)
    for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      out.push({
        name,
        path: base === '/' ? `/${name}` : `${base}/${name}`,
        kind: handle.kind === 'directory' ? 'dir' : 'file',
      })
    }
    return out
  }

  async exists(path: string): Promise<boolean> {
    const p = normalize(path)
    if (p === '/') return true
    try {
      await this.getFileHandle(p, false)
      return true
    } catch {
      try {
        await this.getDirHandle(p, false)
        return true
      } catch {
        return false
      }
    }
  }
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/fsOpfs.ts
git commit -m "feat: OpfsFsAdapter（OPFS の async API ラッパー）"
```

---

## Task 5: WorkspaceStore（ツリーキャッシュ + 購読 + CRUD）

**Files:**
- Create: `src/lib/workspace.ts`
- Test: `src/lib/__tests__/workspace.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/workspace.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { WorkspaceStore } from '../workspace'
import { MemoryFsAdapter } from '../fsMemory'

describe('WorkspaceStore', () => {
  let fs: MemoryFsAdapter
  let store: WorkspaceStore

  beforeEach(async () => {
    fs = new MemoryFsAdapter()
    await fs.writeFile('/workspace/App.tsx', 'export default () => null')
    await fs.writeFile('/workspace/components/Counter.tsx', 'export const Counter = () => null')
    await fs.mkdir('/workspace/lib')
    store = new WorkspaceStore(fs, '/workspace')
    await store.init()
  })

  it('init 後にツリーが構築される', () => {
    expect(store.tree.kind).toBe('dir')
    expect(store.tree.path).toBe('/workspace')
    const names = store.tree.children.map((c) => c.name).sort()
    expect(names).toEqual(['App.tsx', 'components', 'lib'])
  })

  it('createFile でファイル追加 + ツリー更新', async () => {
    await store.createFile('/workspace/lib/util.ts', 'export const x = 1')
    const lib = store.tree.children.find((c) => c.name === 'lib')!
    expect(lib.kind).toBe('dir')
    if (lib.kind === 'dir') {
      const names = lib.children.map((c) => c.name)
      expect(names).toContain('util.ts')
    }
  })

  it('createFolder で空フォルダ追加', async () => {
    await store.createFolder('/workspace/newfolder')
    const names = store.tree.children.map((c) => c.name)
    expect(names).toContain('newfolder')
  })

  it('deleteNode で削除 + ツリー更新', async () => {
    await store.deleteNode('/workspace/App.tsx')
    const names = store.tree.children.map((c) => c.name)
    expect(names).not.toContain('App.tsx')
  })

  it('renameNode でリネーム + ツリー更新', async () => {
    await store.renameNode('/workspace/App.tsx', '/workspace/Main.tsx')
    const names = store.tree.children.map((c) => c.name)
    expect(names).toContain('Main.tsx')
    expect(names).not.toContain('App.tsx')
  })

  it('subscribe で変更通知が届く', async () => {
    let count = 0
    store.subscribe(() => { count++ })
    await store.createFile('/workspace/x.ts', 'x')
    expect(count).toBeGreaterThan(0)
  })

  it('toggleExpand でフォルダの展開状態を変更', () => {
    const components = store.tree.children.find((c) => c.name === 'components')!
    if (components.kind === 'dir') {
      const initial = components.expanded
      store.toggleExpand('/workspace/components')
      const after = (store.tree.children.find((c) => c.name === 'components') as { kind: 'dir'; expanded: boolean }).expanded
      expect(after).toBe(!initial)
    }
  })

  it('readFile / writeFile はそのまま FsAdapter に委譲', async () => {
    expect(await store.readFile('/workspace/App.tsx')).toContain('export default')
    await store.writeFile('/workspace/App.tsx', 'changed')
    expect(await store.readFile('/workspace/App.tsx')).toBe('changed')
  })

  it('hidden プレフィックスのフォルダはツリーに含めない', async () => {
    await fs.writeFile('/workspace/.browser-ide/session.json', '{}')
    await store.refresh()
    const names = store.tree.children.map((c) => c.name)
    expect(names).not.toContain('.browser-ide')
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/workspace.test.ts
```

期待: `Cannot find module '../workspace'`

- [ ] **Step 3: `src/lib/workspace.ts` を実装**

```ts
import { FsAdapter } from './fs'
import { basename, parent, isWithin, pathJoin } from './fsPath'

export type TreeNode =
  | { kind: 'file'; path: string; name: string }
  | { kind: 'dir';  path: string; name: string; children: TreeNode[]; expanded: boolean }

const HIDDEN_PREFIX = '.browser-ide'

export class WorkspaceStore {
  tree: Extract<TreeNode, { kind: 'dir' }>
  private listeners = new Set<() => void>()
  private expanded = new Set<string>()

  constructor(private fs: FsAdapter, private root: string) {
    this.tree = {
      kind: 'dir',
      path: root,
      name: basename(root) || 'workspace',
      children: [],
      expanded: true,
    }
    this.expanded.add(root)
  }

  async init(): Promise<void> {
    await this.fs.mkdir(this.root)
    await this.refresh()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  async refresh(): Promise<void> {
    this.tree = await this.buildNode(this.root)
    this.notify()
  }

  private async buildNode(path: string): Promise<Extract<TreeNode, { kind: 'dir' }>> {
    const entries = await this.fs.list(path)
    const visible = entries.filter((e) => !this.isHidden(e.path))
    const children: TreeNode[] = []
    for (const e of visible) {
      if (e.kind === 'dir') {
        if (this.expanded.has(e.path)) {
          children.push(await this.buildNode(e.path))
        } else {
          children.push({ kind: 'dir', path: e.path, name: e.name, children: [], expanded: false })
        }
      } else {
        children.push({ kind: 'file', path: e.path, name: e.name })
      }
    }
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return {
      kind: 'dir',
      path,
      name: basename(path) || 'workspace',
      children,
      expanded: this.expanded.has(path),
    }
  }

  private isHidden(path: string): boolean {
    return basename(path) === HIDDEN_PREFIX || path.includes(`/${HIDDEN_PREFIX}/`)
  }

  toggleExpand(path: string): void {
    if (this.expanded.has(path)) {
      this.expanded.delete(path)
    } else {
      this.expanded.add(path)
    }
    void this.refresh()
  }

  expandTo(path: string): void {
    let p = parent(path)
    while (p && p !== '/' && isWithin(p, this.root)) {
      this.expanded.add(p)
      p = parent(p)
    }
    void this.refresh()
  }

  async createFile(path: string, content = ''): Promise<void> {
    await this.fs.writeFile(path, content)
    this.expandTo(path)
    await this.refresh()
  }

  async createFolder(path: string): Promise<void> {
    await this.fs.mkdir(path)
    this.expandTo(pathJoin(path, '.placeholder'))
    this.expanded.add(path)
    await this.refresh()
  }

  async deleteNode(path: string): Promise<void> {
    await this.fs.delete(path)
    this.expanded.delete(path)
    await this.refresh()
  }

  async renameNode(from: string, to: string): Promise<void> {
    await this.fs.rename(from, to)
    if (this.expanded.has(from)) {
      this.expanded.delete(from)
      this.expanded.add(to)
    }
    await this.refresh()
  }

  async readFile(path: string): Promise<string> {
    return this.fs.readFile(path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.fs.writeFile(path, content)
    // No refresh needed since file existence didn't change
  }

  /** Walk tree synchronously and find a node by path (or null) */
  findNode(path: string): TreeNode | null {
    const walk = (node: TreeNode): TreeNode | null => {
      if (node.path === path) return node
      if (node.kind === 'dir') {
        for (const c of node.children) {
          const found = walk(c)
          if (found) return found
        }
      }
      return null
    }
    return walk(this.tree)
  }
}
```

- [ ] **Step 4: テスト実行で 9 件 pass 確認**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx vitest run src/lib/__tests__/workspace.test.ts
```

期待: 9 件 pass

- [ ] **Step 5: コミット**

```bash
git add src/lib/workspace.ts src/lib/__tests__/workspace.test.ts
git commit -m "feat: WorkspaceStore（ツリーキャッシュ + 購読 + CRUD）"
```

---

## Task 6: 初回起動時の seed bootstrap

**Files:**
- Create: `src/lib/seed.ts`

- [ ] **Step 1: `src/lib/seed.ts` を実装**

```ts
import { FsAdapter } from './fs'

const SEED_FLAG_KEY = 'bide.seeded.v1'

const SEED_FILES: Record<string, string> = {
  '/workspace/App.tsx': `import { Counter } from './components/Counter'

export default function App() {
  return (
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>BrowserIDE へようこそ</h1>
      <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
        左のファイルツリーからファイルを選んで編集できます。
      </p>
      <Counter />
    </div>
  )
}
`,
  '/workspace/components/Counter.tsx': `import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button
      onClick={() => setCount(c => c + 1)}
      style={{
        padding: '8px 20px',
        background: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      クリック: {count}
    </button>
  )
}
`,
  '/workspace/importmap.json': `{
  "imports": {
    "react": "https://esm.sh/react@19",
    "react-dom/client": "https://esm.sh/react-dom@19/client"
  }
}
`,
}

/** Seed only on first run. Idempotent thanks to localStorage flag. */
export async function seedIfNeeded(fs: FsAdapter): Promise<boolean> {
  if (localStorage.getItem(SEED_FLAG_KEY)) return false
  for (const [path, content] of Object.entries(SEED_FILES)) {
    await fs.writeFile(path, content)
  }
  localStorage.setItem(SEED_FLAG_KEY, 'true')
  return true
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/seed.ts
git commit -m "feat: 初回起動時のサンプルプロジェクト bootstrap"
```

---

## Task 7: useWorkspace フック

**Files:**
- Create: `src/hooks/useWorkspace.ts`

- [ ] **Step 1: `src/hooks/useWorkspace.ts` を実装**

```ts
import { useEffect, useState, useRef, useCallback } from 'react'
import { WorkspaceStore, type TreeNode } from '../lib/workspace'
import { OpfsFsAdapter } from '../lib/fsOpfs'
import { seedIfNeeded } from '../lib/seed'

export type UseWorkspace = {
  ready: boolean
  tree: Extract<TreeNode, { kind: 'dir' }> | null
  store: WorkspaceStore | null
  refresh: () => Promise<void>
  toggleExpand: (path: string) => void
  createFile: (path: string, content?: string) => Promise<void>
  createFolder: (path: string) => Promise<void>
  deleteNode: (path: string) => Promise<void>
  renameNode: (from: string, to: string) => Promise<void>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
}

const ROOT = '/workspace'

export function useWorkspace(): UseWorkspace {
  const storeRef = useRef<WorkspaceStore | null>(null)
  const [tree, setTree] = useState<Extract<TreeNode, { kind: 'dir' }> | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const init = async () => {
      const fs = new OpfsFsAdapter()
      await seedIfNeeded(fs)
      const store = new WorkspaceStore(fs, ROOT)
      await store.init()
      if (cancelled) return
      storeRef.current = store
      setTree(store.tree)
      setReady(true)
      unsubscribe = store.subscribe(() => {
        setTree({ ...store.tree })
      })
    }
    void init()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const refresh = useCallback(async () => {
    await storeRef.current?.refresh()
  }, [])

  const toggleExpand = useCallback((path: string) => {
    storeRef.current?.toggleExpand(path)
  }, [])

  const createFile = useCallback(async (path: string, content = '') => {
    await storeRef.current?.createFile(path, content)
  }, [])

  const createFolder = useCallback(async (path: string) => {
    await storeRef.current?.createFolder(path)
  }, [])

  const deleteNode = useCallback(async (path: string) => {
    await storeRef.current?.deleteNode(path)
  }, [])

  const renameNode = useCallback(async (from: string, to: string) => {
    await storeRef.current?.renameNode(from, to)
  }, [])

  const readFile = useCallback(async (path: string) => {
    if (!storeRef.current) throw new Error('workspace not ready')
    return storeRef.current.readFile(path)
  }, [])

  const writeFile = useCallback(async (path: string, content: string) => {
    await storeRef.current?.writeFile(path, content)
  }, [])

  return {
    ready,
    tree,
    store: storeRef.current,
    refresh,
    toggleExpand,
    createFile,
    createFolder,
    deleteNode,
    renameNode,
    readFile,
    writeFile,
  }
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useWorkspace.ts
git commit -m "feat: useWorkspace フック（OPFS + WorkspaceStore + seed の React 統合）"
```

---

## Task 8: TreeNode コンポーネント

**Files:**
- Create: `src/components/TreeNode.tsx`

- [ ] **Step 1: `src/components/TreeNode.tsx` を実装**

```tsx
import { ChevronRight, ChevronDown, FileCode2, FolderClosed, FolderOpen } from 'lucide-react'
import type { TreeNode } from '../lib/workspace'

type Props = {
  node: TreeNode
  depth: number
  activePath: string | null
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  onDragStart: (e: React.DragEvent, node: TreeNode) => void
  onDragOver: (e: React.DragEvent, node: TreeNode) => void
  onDrop: (e: React.DragEvent, node: TreeNode) => void
  dragOverPath: string | null
}

export function TreeNodeRow(props: Props) {
  const { node, depth, activePath } = props
  const isActive = node.kind === 'file' && node.path === activePath
  const isDragOver = props.dragOverPath === node.path

  const onClick = () => {
    if (node.kind === 'dir') props.onToggle(node.path)
    else props.onSelect(node.path)
  }

  const indent = 8 + depth * 14

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          props.onContextMenu(e, node)
        }}
        draggable
        onDragStart={(e) => props.onDragStart(e, node)}
        onDragOver={(e) => props.onDragOver(e, node)}
        onDrop={(e) => props.onDrop(e, node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          paddingLeft: indent,
          fontSize: 12,
          color: isActive ? 'var(--text)' : 'var(--text-muted)',
          background: isActive ? 'var(--amber-glow)' : isDragOver ? 'var(--amber-dim)' : 'transparent',
          borderLeft: isActive ? '2px solid var(--amber-strong)' : '2px solid transparent',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface3)'
        }}
        onMouseLeave={(e) => {
          if (!isActive && !isDragOver) (e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        {node.kind === 'dir' ? (
          <>
            <span style={{ display: 'inline-flex', width: 12, color: 'var(--text-muted)' }}>
              {node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <span style={{ display: 'inline-flex', color: isActive ? 'var(--amber)' : 'var(--text-muted)' }}>
              {node.expanded ? <FolderOpen size={12} /> : <FolderClosed size={12} />}
            </span>
          </>
        ) : (
          <>
            <span style={{ width: 12 }} />
            <span style={{ display: 'inline-flex', color: isActive ? 'var(--amber)' : 'var(--text-muted)' }}>
              <FileCode2 size={12} />
            </span>
          </>
        )}
        <span>{node.name}</span>
      </div>
      {node.kind === 'dir' && node.expanded && node.children.map((c) => (
        <TreeNodeRow key={c.path} {...props} node={c} depth={depth + 1} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/TreeNode.tsx
git commit -m "feat: TreeNode コンポーネント（再帰描画 + drag/drop ハンドラ受け取り）"
```

---

## Task 9: FileTreeContextMenu コンポーネント

**Files:**
- Create: `src/components/FileTreeContextMenu.tsx`

- [ ] **Step 1: `src/components/FileTreeContextMenu.tsx` を実装**

```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { TreeNode } from '../lib/workspace'

export type ContextMenuTarget = {
  node: TreeNode | null  // null = ルート空白の右クリック
  x: number
  y: number
}

type Action =
  | 'newFile'
  | 'newFolder'
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'copyPath'

type Props = {
  target: ContextMenuTarget | null
  onClose: () => void
  onAction: (action: Action, node: TreeNode | null) => void
}

const itemStyle: React.CSSProperties = {
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--text)',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  width: '100%',
  display: 'block',
}

export function FileTreeContextMenu({ target, onClose, onAction }: Props) {
  useEffect(() => {
    if (!target) return
    const onDocClick = () => onClose()
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [target, onClose])

  if (!target) return null

  const { node, x, y } = target
  const isFile = node?.kind === 'file'
  const isDir = node?.kind === 'dir'
  const isRoot = node === null

  const items: { label: string; action: Action; show: boolean }[] = [
    { label: '新規ファイル',   action: 'newFile',   show: isDir || isRoot },
    { label: '新規フォルダ',   action: 'newFolder', show: isDir || isRoot },
    { label: 'リネーム',       action: 'rename',    show: isFile || isDir },
    { label: '複製',           action: 'duplicate', show: isFile },
    { label: 'パスをコピー',   action: 'copyPath',  show: isFile || isDir },
    { label: '削除',           action: 'delete',    show: isFile || isDir },
  ]

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: 'var(--surface2)',
        border: '1px solid var(--border2)',
        borderRadius: 4,
        minWidth: 180,
        zIndex: 1000,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.filter((i) => i.show).map((item) => (
        <button
          key={item.action}
          style={itemStyle}
          onClick={() => { onAction(item.action, node); onClose() }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--amber-glow)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/FileTreeContextMenu.tsx
git commit -m "feat: FileTreeContextMenu（右クリックメニュー、Portal 描画）"
```

---

## Task 10: FileTree コンポーネント本体

**Files:**
- Create: `src/components/FileTree.tsx`

- [ ] **Step 1: `src/components/FileTree.tsx` を実装**

```tsx
import { useState, useCallback } from 'react'
import { TreeNodeRow } from './TreeNode'
import { FileTreeContextMenu, type ContextMenuTarget } from './FileTreeContextMenu'
import type { TreeNode } from '../lib/workspace'
import { pathJoin, parent, basename, extname } from '../lib/fsPath'
import { key } from '../lib/platform'

type Props = {
  tree: Extract<TreeNode, { kind: 'dir' }> | null
  ready: boolean
  activePath: string | null
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onCreateFile: (path: string, content?: string) => Promise<void>
  onCreateFolder: (path: string) => Promise<void>
  onDelete: (path: string) => Promise<void>
  onRename: (from: string, to: string) => Promise<void>
  onReadFile: (path: string) => Promise<string>
  onClose: () => void
}

export function FileTree(props: Props) {
  const [menu, setMenu] = useState<ContextMenuTarget | null>(null)
  const [dragSrc, setDragSrc] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

  const onDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
    setDragSrc(node.path)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, node: TreeNode) => {
    if (node.kind !== 'dir' || !dragSrc) return
    if (node.path === dragSrc) return
    if (node.path.startsWith(dragSrc + '/')) return // can't drop into descendant
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPath(node.path)
  }, [dragSrc])

  const onDrop = useCallback(async (e: React.DragEvent, node: TreeNode) => {
    e.preventDefault()
    setDragOverPath(null)
    const src = e.dataTransfer.getData('text/plain')
    if (!src || node.kind !== 'dir') return
    if (node.path === parent(src)) return
    const newPath = pathJoin(node.path, basename(src))
    try {
      await props.onRename(src, newPath)
    } catch (err) {
      console.error('rename failed', err)
    }
    setDragSrc(null)
  }, [props])

  const onContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    setMenu({ node, x: e.clientX, y: e.clientY })
  }, [])

  const onRootContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ node: null, x: e.clientX, y: e.clientY })
  }, [])

  const onAction = useCallback(async (action: string, node: TreeNode | null) => {
    const targetDir = node?.kind === 'dir' ? node.path : node ? parent(node.path) : (props.tree?.path ?? '/workspace')
    try {
      if (action === 'newFile') {
        const name = window.prompt('新規ファイル名', 'untitled.tsx')
        if (!name) return
        await props.onCreateFile(pathJoin(targetDir, name), '')
      } else if (action === 'newFolder') {
        const name = window.prompt('新規フォルダ名', 'newfolder')
        if (!name) return
        await props.onCreateFolder(pathJoin(targetDir, name))
      } else if (action === 'rename' && node) {
        const next = window.prompt('新しい名前', node.name)
        if (!next || next === node.name) return
        await props.onRename(node.path, pathJoin(parent(node.path), next))
      } else if (action === 'delete' && node) {
        if (!window.confirm(`「${node.name}」を削除しますか？`)) return
        await props.onDelete(node.path)
      } else if (action === 'duplicate' && node && node.kind === 'file') {
        const ext = extname(node.name)
        const stem = ext ? node.name.slice(0, -ext.length) : node.name
        const newName = `${stem}-copy${ext}`
        const content = await props.onReadFile(node.path)
        await props.onCreateFile(pathJoin(parent(node.path), newName), content)
      } else if (action === 'copyPath' && node) {
        await navigator.clipboard.writeText(node.path)
      }
    } catch (err) {
      console.error('action failed', err)
      window.alert(`操作に失敗しました: ${err instanceof Error ? err.message : err}`)
    }
  }, [props])

  if (!props.ready || !props.tree) {
    return (
      <div className="flex flex-col h-full w-full min-w-0" style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
        <Header onClose={props.onClose} />
        <div className="flex-1 flex items-center justify-center p-4">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>読込中…</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full w-full min-w-0"
      style={{ background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}
      onContextMenu={(e) => {
        // Only fire for blank space (not on TreeNodeRow which calls stopPropagation via setMenu inside its handler)
        if (e.target === e.currentTarget) onRootContextMenu(e)
      }}
    >
      <Header onClose={props.onClose} />

      <div className="flex-1 overflow-auto" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {props.tree.children.map((c) => (
          <TreeNodeRow
            key={c.path}
            node={c}
            depth={0}
            activePath={props.activePath}
            onSelect={props.onSelect}
            onToggle={props.onToggle}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            dragOverPath={dragOverPath}
          />
        ))}
        {/* Spacer for blank-space right-click */}
        <div
          style={{ minHeight: 100 }}
          onContextMenu={onRootContextMenu}
          onClick={() => setMenu(null)}
        />
      </div>

      <FileTreeContextMenu
        target={menu}
        onClose={() => setMenu(null)}
        onAction={(action, node) => onAction(action, node)}
      />
    </div>
  )
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="px-3 flex items-center justify-between shrink-0"
      style={{ height: '34px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}
    >
      <span className="font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', fontSize: 12 }}>
        EXPLORER
      </span>
      <button
        onClick={onClose}
        className="press"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 4px',
        }}
        title={`閉じる (${key('Mod', 'B')})`}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/components/FileTree.tsx
git commit -m "feat: FileTree コンポーネント本体（DnD + 右クリックメニュー統合）"
```

---

## Task 11: App.tsx を WorkspaceStore に接続

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: import を更新**

`src/App.tsx` の冒頭の import 群:

```tsx
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Editor } from './components/Editor'
import { Preview, type PreviewStatus } from './components/Preview'
import { ChatPanel, type Message } from './components/ChatPanel'
import { ModelPicker } from './components/ModelPicker'
import { Splitter } from './components/Splitter'
import { Console } from './components/Console'
import { FileTree } from './components/FileTree'
import { ActivityBar } from './components/ActivityBar'
import { EditorTabs, type TabKind } from './components/EditorTabs'
import { ResizableHandle } from './components/ResizableHandle'
import { ToastProvider, useToast } from './components/Toast'
import { useLlmModel, type ModelState } from './hooks/useLlmModel'
import { useWorkspace } from './hooks/useWorkspace'
import { key } from './lib/platform'
import './index.css'
```

`FileTreePlaceholder` の import を削除し、`FileTree` と `useWorkspace` を追加。

- [ ] **Step 2: AppInner 内に workspace 連携 state を追加**

`AppInner` 関数の上部、既存の `useState` 群の付近に以下を追加:

```tsx
const workspace = useWorkspace()
const [activePath, setActivePath] = useState<string | null>(null)

// Load active file content when activePath changes
useEffect(() => {
  if (!workspace.ready || !activePath) return
  let cancelled = false
  workspace.readFile(activePath)
    .then((content) => { if (!cancelled) setCode(content) })
    .catch((err) => {
      console.error(err)
      toast.show('error', `読込失敗: ${err instanceof Error ? err.message : err}`)
    })
  return () => { cancelled = true }
}, [workspace, activePath, toast])

// Auto-pick first file once workspace is ready and no file is active
useEffect(() => {
  if (!workspace.ready || !workspace.tree || activePath) return
  const findFirstFile = (node: import('./lib/workspace').TreeNode): string | null => {
    if (node.kind === 'file') return node.path
    if (node.kind === 'dir') {
      for (const c of node.children) {
        const found = findFirstFile(c)
        if (found) return found
      }
    }
    return null
  }
  const first = findFirstFile(workspace.tree)
  if (first) setActivePath(first)
}, [workspace.ready, workspace.tree, activePath])
```

- [ ] **Step 3: 自動保存（800ms デバウンス）を追加**

```tsx
// Auto-save active file to OPFS (800ms debounce)
useEffect(() => {
  if (!workspace.ready || !activePath) return
  const timer = setTimeout(() => {
    workspace.writeFile(activePath, code).catch((err) => {
      console.error('save failed', err)
      toast.show('error', `保存失敗: ${err instanceof Error ? err.message : err}`)
    })
  }, 800)
  return () => clearTimeout(timer)
}, [code, activePath, workspace, toast])
```

- [ ] **Step 4: FileTreePlaceholder を FileTree に置換**

`showExplorer && (...)` のブロック内の `<FileTreePlaceholder onClose={...} />` を以下に書き換え:

```tsx
{showExplorer && (
  <>
    <div
      className="overflow-hidden flex shrink-0"
      style={{ width: explorerWidth, minWidth: 0 }}
    >
      <FileTree
        ready={workspace.ready}
        tree={workspace.tree}
        activePath={activePath}
        onSelect={setActivePath}
        onToggle={workspace.toggleExpand}
        onCreateFile={workspace.createFile}
        onCreateFolder={workspace.createFolder}
        onDelete={workspace.deleteNode}
        onRename={workspace.renameNode}
        onReadFile={workspace.readFile}
        onClose={() => setShowExplorer(false)}
      />
    </div>
    <ResizableHandle
      orientation="vertical"
      onResize={(dx) => setExplorerWidth((w) => clamp(w + dx, EXPLORER_MIN, EXPLORER_MAX))}
    />
  </>
)}
```

- [ ] **Step 5: EditorTabs のタブ名を activePath ベースに変更**

EditorArea コンポーネントを呼ぶ箇所で、ファイル名表示を変える。EditorArea が現状 `main.tsx` を固定で表示しているなら、Props に `activeFileName` を追加するか、main タブのラベルを動的にする。

最小変更案: `EditorArea` の Props に `fileName?: string` を追加して、デフォルト 'main.tsx' から `basename(activePath ?? '')` に切替。

```tsx
// App.tsx の editorArea 計算箇所
const editorArea = (
  <EditorArea
    activeTab={activeTab}
    fileName={activePath ? activePath.split('/').pop() ?? 'main.tsx' : 'main.tsx'}
    previewOpen={previewOpen}
    onSelectTab={handleSelectTab}
    onClosePreview={closePreviewTab}
    onRun={runPreview}
    code={code}
    onCodeChange={setCode}
    onCursorChange={handleCursorChange}
    cursor={cursor}
    lineCount={lineCount}
    charCount={charCount}
    previewCode={previewCode}
    onPreviewStatus={setPreviewStatus}
    editorFlashKey={editorFlashKey}
    statusInfo={statusInfo}
  />
)
```

`EditorAreaProps` 型に `fileName: string` を追加し、`EditorArea` 内では使用しない（タブ名は EditorTabs に渡す）。代わりに EditorTabs にも `fileName` を渡す。

- [ ] **Step 6: EditorTabs に fileName プロパティを追加**

`src/components/EditorTabs.tsx` の Props に `fileName: string` を追加し、`<Tab ... label={fileName} />` に。

```tsx
type Props = {
  active: TabKind
  fileName: string
  previewOpen: boolean
  onSelect: (tab: TabKind) => void
  onClosePreview: () => void
  onRun: () => void
}

export function EditorTabs({ active, fileName, previewOpen, onSelect, onClosePreview, onRun }: Props) {
  return (
    <div ...>
      <Tab
        active={active === 'main'}
        onClick={() => onSelect('main')}
        icon={<FileCode2 size={12} />}
        label={fileName}
      />
      ...
    </div>
  )
}
```

そして EditorArea 内の `<EditorTabs ... />` に `fileName={props.fileName}` を渡す。

- [ ] **Step 7: 型チェック + ビルド**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit && npm run build 2>&1 | tail -3
```

期待: 型エラーなし、ビルド成功

- [ ] **Step 8: コミット**

```bash
git add src/App.tsx src/components/EditorTabs.tsx
git commit -m "feat: App.tsx を WorkspaceStore に接続、800ms 自動保存、active file タブ名"
```

---

## Task 12: 旧 FileTreePlaceholder 削除

**Files:**
- Delete: `src/components/FileTreePlaceholder.tsx`

- [ ] **Step 1: 残存参照がないか確認**

```bash
grep -r "FileTreePlaceholder" src/ docs/ 2>&1 | head -10
```

期待: docs/ のドキュメントは残っていてよいが src/ には参照がない

- [ ] **Step 2: ファイルを削除**

```bash
git rm src/components/FileTreePlaceholder.tsx
```

- [ ] **Step 3: 型チェック**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx tsc -b --noEmit
```

期待: エラーなし

- [ ] **Step 4: コミット**

```bash
git commit -m "chore: 旧 FileTreePlaceholder を削除（FileTree に置換済み）"
```

---

## Task 13: 動作検証 — golden path 通し確認

**Files:** （変更なし、検証のみ）

- [ ] **Step 1: テスト全件実行**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run test:run
```

期待: 既存 12 件 + 新規（fsPath 17 件 + fsMemory 11 件 + workspace 9 件 = 37 件）= 49 件 pass

- [ ] **Step 2: ビルド**

```bash
npm run build 2>&1 | tail -5
```

期待: 成功

- [ ] **Step 3: dev server 起動**

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開く。**初回はブラウザの DevTools → Application → Storage → Clear site data** で localStorage と OPFS をリセットしてから検証。

| # | 操作 | 期待 |
|---|---|---|
| 1 | 初回ロード | Explorer に `App.tsx` / `components/` / `importmap.json` が並ぶ（seed 結果） |
| 2 | `App.tsx` をクリック | エディタに seed の中身が表示、タブ名が `App.tsx` |
| 3 | `components/` フォルダのキャレットをクリック | フォルダ展開、`Counter.tsx` が見える |
| 4 | `Counter.tsx` クリック | エディタ内容が切り替わる、タブ名が `Counter.tsx` |
| 5 | エディタを編集 → 1 秒待つ | OPFS に自動保存（DevTools の OPFS で確認可） |
| 6 | リロード | 編集内容が**保持**される（OPFS 永続化） |
| 7 | ファイルを右クリック → 「リネーム」 | prompt が出る、新名前を入力 → ツリーに反映 |
| 8 | フォルダを右クリック → 「新規ファイル」 | prompt → 入力後ツリーに新規ファイル追加、自動的にそのファイルへ切替 |
| 9 | フォルダを右クリック → 「新規フォルダ」 | prompt → 空フォルダ作成、ツリーに反映 |
| 10 | ファイルをドラッグ → 別フォルダにドロップ | ファイル移動、ツリー更新 |
| 11 | ファイルを右クリック → 「削除」 | confirm 後に削除、ツリー更新 |
| 12 | ファイルを右クリック → 「パスをコピー」 | `/workspace/...` がクリップボードに |
| 13 | リロード | フォルダの展開状態は失われるが、ファイル構成は保たれる（展開状態の永続化は Week 3 のセッション復元で対応） |
| 14 | ハードリロード（⌘Shift+R）| seed が再実行されない（`bide.seeded.v1` フラグ） |

すべて期待通りなら検証完了。

- [ ] **Step 4: 検証メモ**

```bash
cat > docs/superpowers/plans/week2-verification.md <<'EOF'
# Week 2 動作検証メモ

実施日: YYYY-MM-DD
検証環境: macOS / Chrome [version]

| 項目 | 結果 |
|---|---|
| 初回 seed | ✓ |
| ファイル選択でエディタ切替 | ✓ |
| 800ms 自動保存 + リロード復元 | ✓ |
| 右クリック CRUD | ✓ |
| DnD ファイル移動 | ✓ |
| Console / Chat への影響なし | ✓ |

## 既知の問題
（あれば記載）

## Week 3 への引き継ぎ事項
（あれば記載）
EOF
```

- [ ] **Step 5: 検証コミット**

```bash
git add docs/superpowers/plans/week2-verification.md
git commit -m "docs: Week 2 動作検証メモ"
```

---

## Week 2 完了基準

- [ ] Task 1〜13 すべて完了
- [ ] テスト 49 件 pass（既存 12 + 新規 37）
- [ ] ビルド成功
- [ ] dev server で Task 13 の golden path 通り動作
- [ ] git log で Task 単位のコミット
- [ ] ロードマップの Week 2 ステータスを「完了」に更新

ロードマップ更新コミット例:

```bash
# docs/superpowers/plans/2026-04-27-roadmap.md の進捗管理表を更新
git add docs/superpowers/plans/2026-04-27-roadmap.md
git commit -m "docs: Week 2 完了をロードマップに反映"
```

その後 Week 3 詳細プランを `2026-MM-DD-week3-tabs-bundler-console.md` として作成する。

---

## 想定外時のフォールバック

| 問題 | 対応 |
|---|---|
| OPFS が動かない（古いブラウザ）| `OpfsFsAdapter` 内で `navigator.storage` の存在を検出して MemoryFsAdapter フォールバック |
| ドラッグ中の ghost image が崩れる | `e.dataTransfer.setDragImage(emptyDiv, 0, 0)` でカスタム image を渡す |
| `prompt()` が UX 悪い | Phase 2 でカスタムモーダルに置換、Week 2 は妥協 |
| ファイル数が多すぎてツリー描画が重い | `useDeferredValue` か仮想化（react-window）— Week 5 で必要なら検討 |
| OPFS への書き込みが reload 中で失われる | `beforeunload` でフラッシュする処理を Week 3 で追加 |
| TreeNode の DnD で「自身の子フォルダにドロップ」できてしまう | FileTree 内 onDragOver で `node.path.startsWith(dragSrc + '/')` チェック済み（Task 10） |

---

## Week 2 の数値目標

- 新規ファイル: 10（src 配下）
- 新規テスト: 37 件（純関数 + WorkspaceStore）
- 新規依存: なし（既存の lucide-react / react のみ）
- 想定実装期間: 5〜7 日（subagent 駆動なら 3〜4 日）
