# 問題集の原本・再生成用データ

このディレクトリは開発時の入力です。アプリは `src/data/generated/` の生成JSONだけを読み込みます。

| ディレクトリ                                                       | 内容・由来                                                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `rtc/`                                                             | RTC公式ZIPのローカル保存先。再配布の許諾を確認できていないため `*.zip` はGit管理対象外。配置手順は [rtc/README.md](rtc/README.md) を参照。 |
| `etyping/`                                                         | ユーザー提供のXML原本7ファイル。取得元は https://uaaaaaaaa.com/typing/word 。同一内容のバレンタイン2ファイルも保管しています。             |
| `trainers/trainer-*.json`                                          | 保存HTMLから抽出した本文・読み・文字対応・制限時間。元ファイル名・URL・文字コード・SHA-256付き。元HTML自体は同梱していません。             |
| `trainers/sakusaku-trainer.json`                                   | ユーザー提供のさくさく15文と読み、確認済みの漢字の読み区切り。参照単語帳のURL付き。HTMLから抽出したデータではありません。                  |
| `constitution/preamble.json` / `articles.json`                     | 衆議院掲載本文の保存スナップショット。条文には取得元URL・HTMLのSHA-256を記録しています。                                                   |
| `constitution/preamble-annotations.json` / `article-readings.json` | 確認済みの本文と読みの対応・歴史的仮名遣いの読み・条文の見出し。生成時に保存本文との一致を検証します。                                     |
| `typewell/typewell.json`                                           | 公開17ページから集約した登録済み単語・読みのスナップショット。語順・重複を保持。取得HTML原本ではありません。                               |
| `space/spaceCatalogue.json`                                        | 恒星・星座の登録済み名前と読みのスナップショット。取得HTML原本ではありません。                                                             |
| `original-long/` | ユーザー提供のオリジナル長文21編のJSON原本と、追加した明示的な読み対応。本文とSHA-256を照合します。 |

再生成: `python3 scripts/rebuild-data.py`。変更せずに照合: `python3 scripts/rebuild-data.py --check`。どちらもPython 3標準ライブラリだけで動き、ネット接続は不要です。RTCの全ZIPがそろっていない場合は登録済みの `rtc.json` を維持し、原本照合をスキップした旨を表示します。RTCも必ず原本から生成・照合するには `--require-rtc-sources` を追加してください。

詳細な出典・オンラインでの再取得手順・出題バージョンの扱いはルートのREADMEを参照してください。
