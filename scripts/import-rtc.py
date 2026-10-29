"""Import supplied RTC ZIP snapshots. Never extract paths or execute archive contents.
Run: python3 scripts/import-rtc.py
"""
from functools import lru_cache
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
FILES = {
    'RTC2018-Words.zip': [('00RTC ALLE.xml','2018-all'),('01RTC EsportsC.xml','2018-esports'),('02RTC GenkiC.xml','2018-genki'),('03RTC TypingD.xml','2018-typing')],
    'RTC2024word.zip': [('RTC2024word/RTC2024ALLWord2.xml','2024-all'),('RTC2024word/RTC2024LifeWord2.xml','2024-life'),('RTC2024word/RTC2024NittereWord2.xml','2024-nittere'),('RTC2024word/RTC2024RyokoWord2.xml','2024-travel')],
    'RTC2025word.zip': [('RTC2025word/RTC2025_all_word.xml','2025-all'),('RTC2025word/RTC2025_genki_word.xml','2025-genki'),('RTC2025word/RTC2025_business_word.xml','2025-business'),('RTC2025word/RTC2025_sports_word.xml','2025-sports')],
}
# Explicitly reviewed ambiguous kana anchors; populated from the supplied readings.
REVIEWED = {'自分の可能性を':'じぶん/かのうせい','ローマ字入力に最適な':'じにゅうりょく/さいてき','箱根駅伝で疾走した':'はこねえきでん/しっそう','遥か彼方の':'はる/かなた'}
def norm(s):
    s=unicodedata.normalize('NFKC',s)
    return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c.lower() if 'A'<=c<='Z' else c for c in s)
@lru_cache(None)
def align(text, raw):
    reading=norm(raw)
    if text == 'また笑えばいい ': return [*align(text[:-1],raw), (' ','')]
    parts=re.findall(r'[一-龯々ヶ]+|.',text)
    fixed=iter(REVIEWED.get(text,'').split('/'))
    known={i:next(fixed) for i,p in enumerate(parts) if text in REVIEWED and re.match(r'[一-龯々ヶ]',p)}
    @lru_cache(None)
    def find(i,offset):
        if i==len(parts): return [()] if offset==len(reading) else []
        part=parts[i]
        if i in known: choices=[offset+len(known[i])] if reading.startswith(known[i],offset) else []
        elif re.match(r'[一-龯々ヶ]',part): choices=range(offset+1,len(reading)+1)
        else:
            literal=norm(part)
            choices=[offset+len(literal)] if reading.startswith(literal,offset) else []
        found=[]
        for end in choices:
            for rest in find(i+1,end):
                found.append(((part,reading[offset:end]),)+rest)
                if len(found)==2:return found
        return found
    solutions=find(0,0)
    if not solutions:
        raise ValueError(f'Unaligned: {text!r} / {raw!r}')
    if len(solutions)>1: raise ValueError(f'Ambiguous: {text!r}')
    return solutions[0]
def main():
    result=[]
    for archive, entries in FILES.items():
        path=ROOT/'src/data/rtc-sources'/archive
        with ZipFile(path) as z:
            for member, identifier in entries:
                raw=z.read(member);root=ET.fromstring(raw)
                parts=[]
                for part in root.findall('Part'):
                    rows=[]
                    for word in part.findall('Word'):
                        text,reading=word.findtext('Display'),word.findtext('Characters')
                        if not text or not reading: raise ValueError(member)
                        rows.append([text,reading,align(text,reading)])
                    if not rows:raise ValueError('Empty part: '+member)
                    parts.append(rows)
                result.append({'id':'rtc-'+identifier,'title':root.findtext('Name'),'author':root.findtext('Author'),'source':{'archive':archive,'member':member,'zipSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'xmlSha256':hashlib.sha256(raw).hexdigest()},'parts':parts})
    (ROOT/'src/data/rtc.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Imported',len(result),'sets',sum(len(p) for s in result for p in s['parts']),'fragments')
if __name__=='__main__': main()
