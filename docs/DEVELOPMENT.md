# 開発ガイド

GALACTYPE の開発者向けドキュメントです。遊び方は [README](../README.md)、文章セットの詳細と出典は [CONTENT.md](CONTENT.md)、採点の詳細は [SCORING.md](SCORING.md) を参照してください。

## 目次

- [セットアップ](#セットアップ)
- [コマンド](#コマンド)
- [技術スタック](#技術スタック)
- [ソースコードの構成](#ソースコードの構成)
- [問題データ](#問題データ)
- [出題バージョンとシード](#出題バージョンとシード)
- [入力判定](#入力判定)
- [保存データ](#保存データ)
- [背景の描画](#背景の描画)
- [テスト](#テスト)
- [開発フロー](#開発フロー)

## セットアップ

Node.js 26（推奨バージョンは `.node-version`）、pnpm 12.16.1、Python 3（データ再生成とそのテストのみ）を使います。Node.js を用意してから次のコマンドを実行します。

```sh
npm install --global pnpm@12.16.1
pnpm install --frozen-lockfile
pnpm dev
```

http://localhost:5173 を開きます。`pnpm build` の出力 `dist/` を静的HTTPサーバーに置けば動作します（ルートパス配信を想定）。実行時の外部通信やバックエンドはありません。

## コマンド

| コマンド                                                 | 内容                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                               | 開発サーバー                                     |
| `pnpm build` / `pnpm preview`                            | 型チェック付きビルド / ビルド結果の確認          |
| `pnpm lint`                                              | oxlint                                           |
| `pnpm fmt` / `pnpm fmt --check`                          | Oxfmt で整形 / 整形の確認                        |
| `pnpm typecheck`                                         | `tsc -b`                                         |
| `pnpm test`                                              | Vitest（`src/` のユニットテスト）                |
| `pnpm test:e2e`                                          | Playwright（ビルドしてポート4173で起動して検証） |
| `python3 -m unittest discover -s scripts -p 'test_*.py'` | データ再生成スクリプトのテスト                   |
| `python3 scripts/rebuild-data.py [--check]`              | 問題データの一括再生成 / 変更せずに照合          |

初回の e2e の前に `pnpm exec playwright install chromium` を実行してください。

## 技術スタック

React / TypeScript / Vite+ / Tailwind CSS v4 / Three.js / Lucide。Vite+ に含まれる Vite、Vitest、Oxlint、Oxfmt で開発・ビルド・単体テスト・lint・整形を行い、E2E は Playwright で検証します。

## ソースコードの構成

エントリーポイントは `src/main.tsx` です。画面（features）と、Reactに依存しない処理（domain）を分けています。

| 場所                              | 責務                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `src/app/`                        | Appの組み立て、アプリ全体のスタイル、背景                                      |
| `src/features/practice/`          | 通常練習・一文練習の選択・プレビュー・入力・統計、セッション制御・計時・シード |
| `src/features/battle/`            | CPU・ゴースト対戦の画面と対戦用ガイド                                          |
| `src/features/history/`           | 記録一覧・詳細分析・リプレイ表示、履歴購読・書出し・削除                       |
| `src/features/settings/`          | 設定の保存・設定ダイアログ                                                     |
| `src/features/favorites/`         | お気に入りの登録ボタン・サイドバー・保存制御                                   |
| `src/features/library/`           | 文章セットの選択とカテゴリ                                                     |
| `src/features/results/`           | 各モード共通の結果表示                                                         |
| `src/domain/typing/`              | 入力判定・配列・読み位置・採点・単語境界                                       |
| `src/domain/content/`             | 文章セット定義、本文・読み、出題順・シード                                     |
| `src/domain/battle/`              | CPUとゴーストの対戦ルール・進行                                                |
| `src/domain/records/`             | 記録の型、集計、トレース、リプレイ計算                                         |
| `src/infrastructure/persistence/` | localStorage・IndexedDBへの保存                                                |
| `src/shared/typing/`              | 練習・対戦・リプレイで共有する本文・読み・キーボード表示                       |
| `src/shared/ui/`                  | 機能を知らない汎用UI部品                                                       |
| `src/data/generated/`             | `data/sources/` から生成したアプリ用JSON（直接編集しない）                     |
| `data/sources/`                   | 問題データの原本・再生成用データ                                               |
| `scripts/`                        | 問題データの取り込み・再生成スクリプト（Python標準ライブラリのみ）             |
| `e2e/`                            | Playwright のE2Eテスト                                                         |

### 依存の方向

- `app → features → shared / domain / infrastructure`、`infrastructure → domain` を基本とします。
- domain は React や保存実装を import しません（保存との結合テストを除く）。
- shared は features や app に依存しません。
- 機能どうしの相互 import は増やさず、画面間の接続は App が担当します。各機能から共通の結果・履歴表示は利用できます。
- 新規ファイルはまず担当機能に置き、複数機能で共有する純粋処理を domain、ブラウザの保存APIを扱う処理を infrastructure に置きます。
- ユニットテストは対象モジュールと同じ場所に置きます。

### App と各機能の境界

`app/App.tsx` は画面の接続を担当し、`AppShell` が背景・ナビゲーション・ヘッダーを描画します。練習・履歴の hook は App の寿命で保持します。通常練習から別画面へ移動すると進行中のゲームを取り消し、戻ったときは文章選択から始めます。CPU・ゴースト画面は離れるとアンマウントします。

| モジュール                                                  | 役割                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `usePracticeSession`                                        | 入力エンジン、状態遷移、採点、完了の一回性。UIには読み取り用の状態と操作だけを返す    |
| `usePracticeClock` / `usePracticeFocus` / `usePracticeSeed` | 計時とカウントダウン、カルーセル移動後のフォーカス、保存済みシードと出題バージョン    |
| `domain/content/practiceDocument.ts` / `practicePreview.ts` | 出題の選択とプレビューの本文・読み対応                                                |
| `domain/records/practiceResult.ts`                          | 計測済みの入力から保存用記録を組み立てる                                              |
| `useFavorites`                                              | お気に入りの保持。シードは保存せず、呼び出しは App から各機能のリセット処理へ接続する |
| `useHistory`                                                | 記録・ベスト・保存失敗分の所有者。購読・保存・書出し・削除と詳細選択を一箇所で扱う    |
| `useSettings` / 各ダイアログ                                | 設定の保存とダイアログUI。`useModalFocus` がフォーカスの循環と復帰を担当する          |

## 問題データ

外部由来・提供された問題集は、原本・再生成用データ（`data/sources/`）と、アプリが読み込む生成JSON（`src/data/generated/`）に分けています。各ディレクトリの由来は [data/sources/README.md](../data/sources/README.md) にまとめています。

| 文章セット                   | 原本・再生成用データ                               | スクリプト                          |
| ---------------------------- | -------------------------------------------------- | ----------------------------------- |
| RTC                          | `data/sources/rtc/*.zip`（Git管理対象外）          | `scripts/import-rtc.py`             |
| e-typing                     | `data/sources/etyping/`（XML・取得一覧・文節情報） | `scripts/import-etyping.py`         |
| English                      | `data/sources/english/`（TypeLighter ZIP）         | `scripts/import-english.py`         |
| 打鍵トレーナー               | `data/sources/trainers/`                           | `scripts/import-trainers.py`        |
| 日本国憲法                   | `data/sources/constitution/`                       | `scripts/import-constitution.py`    |
| タイプウェル                 | `data/sources/typewell/`                           | `scripts/import-typewell.py`        |
| 宇宙の名前（追加分）         | `data/sources/space/`                              | `scripts/import-space-catalogue.py` |
| オリジナル長文               | `data/sources/original-long/`                      | `scripts/import-original-long.py`   |
| 歴史・文学・科学の追加セット | `data/sources/themes/`                             | `scripts/rebuild-data.py`           |

次のセットは TypeScript で直接管理します。

- オリジナル6編：`src/domain/content/passages.ts`。漢字の読み対応は `passageReadings.ts` に明示し、全文との一致をテストしています。文章を追加するときは読み対応も追加してください（助詞「は」は `ha`）。
- RTCオリジナル200文：`src/domain/content/rtcOriginal.ts`。旧CPU対戦の20文は旧記録の再現用に `battlePrompts.ts` に残しています。
- 宇宙の名前（初期64語）：`src/domain/content/spaceWords.ts`

### 再生成

```sh
# Python 3 の標準ライブラリのみ使用。ネット接続は不要
python3 scripts/rebuild-data.py
# 一時ディレクトリに再生成して照合。保存済みファイルは書き換えない
python3 scripts/rebuild-data.py --check
# RTC の全ZIP原本も必須にして再生成・照合
python3 scripts/rebuild-data.py --require-rtc-sources
python3 scripts/rebuild-data.py --check --require-rtc-sources
```

- 修正は `data/sources/` または `scripts/import-*.py` の読み対応で行い、一括再生成後に入力と生成JSONをまとめてコミットします。
- 通常の再生成では Web から再取得しません。タイプウェルと追加の恒星・星座は、各 import スクリプトでオンライン再取得でき、スナップショットと生成JSONを両方更新します。e-typing の追加取得と文節情報の更新は [data/sources/etyping/README.md](../data/sources/etyping/README.md) を参照してください。
- RTC公式ZIPは再配布の許諾を確認できていないためコミットしません（`.gitignore` 対象）。配置手順は [data/sources/rtc/README.md](../data/sources/rtc/README.md) を参照してください。ZIPがそろわない場合は登録済みの `rtc.json` を維持し、照合をスキップした旨を表示します。
- CI では同梱された再生成用データと生成JSONの一致を検証します。RTC の生成データの構造・読み対応・シード再現性は常にテストし、ZIPがある場合は原本の SHA-256 と XML との一致も検証します。
- 本文と読みの対応は推測せず明示的に保持し、本文・読みの一致、単語境界、ローマ字／かなでの到達可能性をテストしています。単語境界は `Intl.Segmenter` を基準に、確認済みの区切り（e-typing は Sudachi mode C 基準の文節情報）で補正します。

## 出題バージョンとシード

ランダム出題は FNV-1a + Mulberry32 による乱数で、文章セットID・出題バージョン・シード（・配列）から出題を決めます。記録にはシードと出題バージョンを保存し、履歴から同じ出題を再現します。

- 文章の内容・語順・抽出手順を変えると旧記録のシードで別の問題になるため、**出題バージョンを上げて旧バージョンの処理を残します**。文節情報だけの修正など、出題順が変わらない変更はバージョンを上げません。
- 現在のバージョン：タイプウェル v2（v1 は旧シード処理・旧64語辞書）、打鍵トレーナー v2（v1 は旧抽選方式）、CPU対戦のRTCオリジナル v2（v1 は旧20文）、CPU対戦のタイプウェル v2（複数語を1問に連結。v1 は1語1問）。e-typing・RTC・通常練習のRTCオリジナル・憲法条文集は v1 です。
- お気に入りはシードを保存せず、呼び出すたびに新しいシードを使います。

## 入力判定

- ローマ字は固定の正解文字列と比較せず、読み位置と未完の綴りを持つ候補集合で判定します。対応表は [src/domain/typing/engine.ts](../src/domain/typing/engine.ts)、回帰例は [engine.test.ts](../src/domain/typing/engine.test.ts) にあります。綴りを追加するときは判定表とテストを組で追加してください。
- QWERTY JIS は `KeyboardEvent.key` を使います。その他の配列は `KeyboardEvent.code`（物理キー位置）をアプリ内で選択配列に変換します。
- 配列の定義は [Colemak公式のUnix定義](https://colemak.com/Unix)、[Workman公式のXKB定義](https://github.com/workman-layout/Workman/blob/master/xorg/workman)、[大西配列公式](https://o24.works/layout/)、[Microsoft French Legacy（KLID 0000040C）](https://learn.microsoft.com/en-us/globalization/keyboards/kbdfr)、[Norman公式](https://normanlayout.info/)、[ks250206/keyboard-layout の F5-Pair](https://github.com/ks250206/keyboard-layout/blob/ec596b262328ce66629c4f56874dffb364395e7d/layouts/f5/full_layers.json)（2026-10-31取得）と照合しています。定義はアプリに同梱し、実行時に外部へアクセスしません。
- e-typing・タイプウェルの非公開の判定仕様との完全一致は保証していません。JIS実機のメーカー固有キー、OS/ブラウザ差、IME固有の拡張は未検証です。

## 保存データ

| 保存先                                  | 内容                                         |
| --------------------------------------- | -------------------------------------------- |
| localStorage `yohaku.history.v1`        | 完了した全記録の要約（苦手ワード練習を除く） |
| localStorage `galactype.bests.v1`       | 歴代TOP10                                    |
| localStorage `yohaku.settings.v1`       | 表示・入力の設定                             |
| localStorage `yohaku.cpu.v1`            | CPU対戦の設定                                |
| localStorage `galactype.cpu-prompts.v1` | CPU対戦の文章セット・シード                  |
| IndexedDB `galactype.telemetry.v1`      | 全打鍵の詳細ログ                             |

- 既存の設定・履歴を引き継ぐため、`yohaku.*` のキー名は変更しません。
- 履歴の追加・削除は Web Locks API で複数タブ間の書き込みを排他します（HTTPS / localhost の対応ブラウザ）。非対応環境でも保存直前に最新履歴へ統合しますが、排他は保証しません。
- 読み込み時に壊れたデータは読み飛ばします。保存が拒否された場合はメモリ内で動作を続け、JSONで書き出せるようにします。

## 背景の描画

- Three.js は遅延ロードし、3D背景OFF時はロードしません。惑星のテクスチャは端末内で生成し、画像を外部から取得しません。
- 描画は最大30fps、ピクセル比1.5・描画面積160万画素を上限とし、非表示タブでは停止します。`prefers-reduced-motion` では静止し、リサイズ時のみ再描画します。
- WebGL が使えない・コンテキストを失った場合は CSS の惑星に切り替えます。背景OFF・アンマウント時に描画ループ・イベント監視・ジオメトリ・マテリアル・テクスチャを解放します。

## テスト

- **Vitest**：入力判定・配列・全文の到達可能性・採点・集計・保存障害などを `src/` のユニットテストで検証します。
- **Playwright**：本番ビルドを専用ポート4173で起動し、各モードの完走・一時停止・記録・書出し・削除、390px幅、複数タブの同期、WebGL不可時の代替表示などを検証します。スクリーンショットは `artifacts/` に出力します。
- **CI**（`.github/workflows/ci.yml`）：PR と `main` への push で、Python のテスト・lint・typecheck・Vitest・ビルド・Playwright を実行します。

## 開発フロー

Issue → feature ブランチ → PR → CI → レビュー → `main` の順に進めます。初期の設計は [Issues #1〜#6](https://github.com/ks250206/typing/issues?q=is%3Aissue+is%3Aclosed) を参照してください。
