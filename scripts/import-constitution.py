"""Generate runtime constitution data from offline official snapshots and reviewed readings."""
from pathlib import Path
from data_paths import generated_path
import json
import re
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/sources/constitution'

def read(name):
    return json.loads((SOURCE/name).read_text())

def norm(text):
    return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in text)

def paragraph(segments):
    return {'text': ''.join(s['text'] for s in segments), 'reading': ''.join(s['reading'] for s in segments), 'segments': segments}

def write(name, data):
    generated_path(name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')

def main():
    annotation = read('preamble-annotations.json')
    paragraphs = []
    for text in annotation['annotated']:
        segments = []
        for match in re.finditer(r'〈([^|〉]+)\|([^〉]+)〉|([^〈]+)', text):
            if match[1]: segments.append({'text': match[1], 'reading': match[2]})
            else:
                if re.search('[一-龯々]', match[3]): raise ValueError('Missing preamble reading')
                segments.extend({'text': c, 'reading': norm(c)} for c in match[3])
        paragraphs.append(paragraph(segments))
    if [p['text'] for p in paragraphs] != read('preamble.json'): raise ValueError('Preamble source mismatch')
    write('constitutionPreamble.json', {'source': annotation['source'], 'paragraphs': paragraphs})
    official, reviewed = read('articles.json'), read('article-readings.json')
    articles = []
    for article in official['articles']:
        segments = []
        for text in article['paragraphs']:
            annotated = re.sub(r'与へ|伴は|行は|負ふ|あつ', lambda m: '〈'+m[0]+'|'+reviewed['historical'][m[0]]+'〉', text)
            part = []
            for match in re.finditer(r'〈([^|]+)\|([^〉]+)〉|([一-龯々]+|.)', annotated):
                word = match[1] or match[3]
                kana = match[2] or (reviewed['readings'][word] if re.fullmatch('[一-龯々]+', word) else norm(word))
                part.append({'text': word, 'reading': kana})
            if paragraph(part)['text'] != text: raise ValueError('Article source mismatch')
            segments.extend(part)
        title, keywords = reviewed['topics'][str(article['number'])]
        articles.append({'number': article['number'], 'title': title, 'keywords': keywords, **paragraph(segments), 'label': f"第{article['number']}条 · {title}", 'note': '覚えるキーワード：'+keywords})
    write('constitutionArticles.json', {'source': official['source'], 'articles': articles})
    print('Constitution: 4 preamble paragraphs,',len(articles),'articles')
if __name__ == '__main__': main()
