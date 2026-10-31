# テーマ別の追加原稿

`themes.json` は本文・読み・ふりがな区切りを収録した編集用原稿です。`scripts/rebuild-data.py` が同じ内容を `src/data/generated/themes.json` へコピーします。再生成に辞書やネットワークは不要です。

歴史・科学の5長文、サイリーナスを題材にした随想、トレーナー短文、RTC風のフレーズはGALACTYPE用の独自原稿です。サイリーナスはダン・シモンズ作品の架空の詩人を題材とする非公式の創作で、原作の引用や作者による文章ではありません。キーツの「バッタとコオロギについて」は著作権保護期間を満了した原詩からの独自訳で、既存の日本語訳は使用していません。SF単語集は作品名のみで、長編と短編集を含みます。

読みの初稿にはpykakasiを用い、人名・作品名・文脈依存の読みを修正してJSONに固定しています。アプリと再生成処理は自動読み変換を行いません。

参考資料（2026-10-31確認）：

- キュリー: https://www.nobelprize.org/prizes/physics/1903/marie-curie/facts/
- 湯川: https://www-yukawa.phys.sci.osaka-u.ac.jp/en/yukawahideki
- ポエニ戦争: https://academic.oup.com/edited-volume/61673/chapter-abstract/552821643
- ソクラテス: https://plato.stanford.edu/entries/socrates/
- フォンノイマン: https://www.ias.edu/ideas/electronic-computer-project
- キーツ原詩: https://www.poetryfoundation.org/poems/53210/on-the-grasshopper-and-cricket
- シェイクスピア作品: https://www.folger.edu/explore/shakespeares-works/
- ノーベル記念経済学賞の位置づけ: https://www.nobelprize.org/uploads/2018/07/NobelPrizeLessons_2017_Economics_Text-for-pupils.pdf
