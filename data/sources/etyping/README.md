# e-typing / Weather Typing用データ

提供元: https://uaaaaaaaa.com/typing/word

2026年11月1日（日本時間）に公開されていた最新52回、第1281〜1332回を採用しています。公開一覧の取得時刻（UTC）は `weekly-catalog.json` の `retrieved_at` に保存しています。一覧に開催日付はないため、回番号から日付を推定していません。

52回のタイトルは26種類です。既存6セットを保持し、新規20セット・4,110文を追加して計5,687文にしています。同タイトルの別開催回は同内容と扱い、比較のために全52個のZIPを取得することはしていません。未登録タイトルだけ対象期間内の最新回を取得しています。文単位の重複は元データのまま保持します。

| ファイル                  | 内容                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------- |
| 既存の `*.xml` 7ファイル  | 従来の原本。バレンタイン2ファイルは同一内容で、出題は1セット                            |
| `annual-*.xml` 20ファイル | 追加取得したZIP内XMLの原本。ファイル名だけ安定したセットIDに変更                        |
| `weekly-index.html`       | 取得時点の公開一覧HTML                                                                  |
| `weekly-catalog.json`     | 全52回のタイトル・URL・正規セットID・採用XML、ZIP/XML/一覧のSHA-256                     |
| `reviewed-readings.json`  | 漢字の読み分け・数詞・連濁等の確認済み対応                                              |
| `word-segmentation.json`  | 全XMLの本文／読み5,341種類に対する文節・ふりがな対応。原本と確認済み対応のSHA-256も保存 |

各XMLの `Display` / `Characters`、問題順を変えずに生成します。既存タイトルのID・原本・出題順は維持し、同タイトルが再登場しても置き換えません。生成JSONは `src/data/generated/etyping.json` です。旧バレンタインの重複原本を除いた出題数が5,687文、全原本間で同一の本文／読みを共有する文節情報が5,341件です。

文節はSudachiPy 0.7.0 / SudachiDict core 20261015のmode Cを基準に保存しています。辞書の読みでXMLの読みを書き換えません。XMLに合う読みの位置を特定できない場合は処理を失敗させ、確認済み対応に追加します。「みたらしだんご」「ぴよりん」「ねるねるねるね」「ぷるぷる」「さっくり」等の細切れも防ぎます。ブラウザの辞書差によらず、本文・かな・ローマ字に同じ区切りを使い、保存ログにも区切りを残します。

通常の再生成はPython標準ライブラリだけで、ネットワークも不要です。

```sh
python3 scripts/import-etyping.py
python3 scripts/rebuild-data.py --check
python3 -m unittest discover -s scripts -p 'test_*.py'
```

公開一覧を更新するときは、最初に取得スクリプトのタイトルと安定IDの対応を確認します。未登録のタイトルはIDを割り当てるまで失敗します。保存済みXMLは再利用し、同タイトルの新しい回で上書きしません。

```sh
python3 scripts/fetch-etyping-year.py
uv run --python 3.12 --with sudachipy==0.7.0 --with sudachidict_core==20261015 python scripts/segment-etyping.py
python3 scripts/import-etyping.py
```

形態素解析はこの更新作業だけの依存で、アプリ・CI・オフライン再生成には不要です。文節の確認が必要な文は `reviewed-readings.json` に追記し、文節生成を再実行します。[SudachiのPython API](https://worksapplications.github.io/sudachi.rs/python/api/sudachipy.html)を参照してください。取得対象の回・タイトル・件数が変わったら、テストの収録範囲とREADMEも更新してください。
