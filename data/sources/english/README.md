# 英語文章データ

出典は [physics-HTFI / TypeLighter](https://github.com/physics-HTFI/TypeLighter) の付属ワードです。取得コミットは `08fd32e0e692126fadaba4fdd0f14adfd1a0389e`、[ZIP原本](https://github.com/physics-HTFI/TypeLighter/blob/08fd32e0e692126fadaba4fdd0f14adfd1a0389e/html/TypeLighter.zip) とSHA-256・取得日を `manifest.json` に保存しています。TypeLighterのソフトウェアに付属するMITライセンス原文は `TypeLighter-LICENSE.txt` に保持しています。e-typingとTypeWellの出題データは、それぞれの問題集に由来します。

ZIPに入っている英語e-typingは2012年の第1〜38回です。2025〜2026年の一年分ではありません。ユーザー確認に基づき、この指定ZIP内の最新の収録範囲を採用しました。同じタイトルの回は最新の回を選び、19タイトル・1,540文へ整理しています。TypeWellはTWEW215の基本英単語・拡張基本英単語A–F/G–P/Q–Zの4辞書、各1,500語、計6,000語です。

`python3 scripts/import-english.py` はZIPをオフラインで読み、`src/data/generated/english.json` を作ります。各セットには採用した元ファイル、SHA-256、回番号、元の件数と別回の一覧を保存します。セット内は完全一致で重複を取り除きます。大文字・小文字・句読点・スペースは元のXMLの `roman` 属性のままです。日本語用のローマ字を英語として流用せず、英語ディレクトリとTWEW215だけを読みます。

e-typingの安定IDは同タイトルの最初の回を使い、出題順は `english-v1/<id>/<seed>` で再現します。TypeWellは半角スペースも含めた400打の単語列で、末尾が語の途中になる場合もあります。これはこのアプリの練習ルールで、元ソフトの完全互換を意味しません。オリジナル英語4編・長文2編は別途 `src/domain/content/englishOriginal.ts` に記述した独自原稿です。

一括再生成は `python3 scripts/rebuild-data.py`、照合は `python3 scripts/rebuild-data.py --check`。元XMLとの一致、採用回、重複除去、ZIPのSHA-256を `scripts/test_english.py` で確認します。
