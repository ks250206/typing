# RTC公式ZIP（ローカル専用）

RTC公式で公開されたZIPは再配布の許諾を確認できていないため、Gitには含めません。このディレクトリの `*.zip` は `.gitignore` の対象です。

再生成・原本照合を行う場合は、手元の以下のファイルをここに配置してください。

- `RTC2018-Words.zip`
- `RTC2019word5.zip`
- `RTC2023word2.zip`
- `RTC2024word.zip`
- `RTC2025word.zip`

`python3 scripts/rebuild-data.py --require-rtc-sources` で全原本から再生成、`--check --require-rtc-sources` で書き換えずに照合します。個別生成は `python3 scripts/import-rtc.py` です。いずれも5ファイルすべてが必要です。

原本がそろっていない通常のチェックアウト・CIでは、登録済みの `src/data/generated/rtc.json` をそのまま使い、ZIPとの照合をスキップした旨を表示します。生成JSONの構造・読み対応・全配列での入力・シード再現性は通常のテストで検証します。ZIPがローカルにある場合は、そのファイルのSHA-256とXML内容の照合も実施します。

ZIPはアプリ実行・通常のビルドには不要です。過去のGit履歴は変更していません。
