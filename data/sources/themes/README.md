# テーマ別の追加原稿

`themes.json` は本文・読み・ふりがな区切りを収録した編集用原稿です。`scripts/rebuild-data.py` が同じ内容を `src/data/generated/themes.json` へコピーします。再生成に辞書やネットワークは不要です。

歴史・科学の5長文、サイリーナスを題材にした詩、トレーナー短文、RTC風のフレーズはGALACTYPE用の独自原稿です。サイリーナスはダン・シモンズ作品の架空の詩人を題材とする非公式の創作で、原作の引用や作者による文章ではありません。キーツの「バッタとコオロギについて」は著作権保護期間を満了した原詩からの独自訳で、既存の日本語訳は使用していません。SF単語集は作品名のみで、長編と短編集を含みます。

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

## 科学者1,000人

既存110人に890人を追加しました。追加分の日本語カタカナ名と人物IDはWikidataの職業データから取得し、カタカナをひらがなへ変換して読みを固定しています。物理・化学・数学・生物・天文学・地学などを含みます。新規分は人物IDと正規化した名前で重複を除き、既存の略称・姓との重複候補も除外しています。漢字の人名に機械的な読み推測は追加していません。

追加890人の名前・読み・人物ID・抽出分野は `scientists-provenance.json` に保存しています。参照先は `https://www.wikidata.org/wiki/` に人物IDを付けたURLです。Wikidata構造化データは[CC0](https://www.wikidata.org/wiki/Wikidata:Licensing)。一部の候補確認には日本語Wikipediaの[物理学者](https://ja.wikipedia.org/wiki/物理学者の一覧)・[化学者](https://ja.wikipedia.org/wiki/化学者の一覧)・[数学者](https://ja.wikipedia.org/wiki/数学者の一覧)等の人物一覧を使いました。説明文・伝記本文は収録していません。取得日は2026-10-31です。アプリ実行・JSON再生成で外部アクセスは行いません。

## スポーツチーム500件

サッカー107・野球107・バスケットボール95・アメリカンフットボール96・アイスホッケー95の500件です。Wikidataのチーム種別と日本語名を参照し、同じチームのID・表示名の重複を除いて収録しています。旧名・活動終了チームも含み、現在の所属リーグ一覧ではありません。出典のチームID・競技・名前・読みは `sports-provenance.json` に保存しています。構造化データのライセンスはCC0です。追加した日本語名24件の読みは明示的に指定し、カタカナ名はひらがなに変換しています。

サイリーナスの詩は、老詩人の毒舌・自嘲・酒・喪失感・詩への執念を題材とした非公式の独自詩です。原作の詩の引用や翻訳ではありません。1文を1段落・1問として収録します。
