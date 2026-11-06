"""대화 코퍼스 빌드: tools/conv_src/*.txt → public/data/conversations.json
사용법:  python tools/build_conv.py
 - 문장을 추가/수정한 뒤 이 스크립트를 실행하고, 생성된 json 을 커밋하면 됩니다.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC, OUT = ROOT / 'conv_src', ROOT.parent / 'public' / 'data' / 'conversations.json'
TRAITS = {'o': 'outgoing', 's': 'shy', 'p': 'playful', 'c': 'cool'}

intents, followups, errors = [], {}, []
cur = None
for f in sorted(SRC.glob('*.txt')):
    for ln, raw in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        where = f'{f.name}:{ln}'
        if line.startswith('@'):
            parts = [p.strip() for p in line[1:].split('|')]
            if len(parts) < 4:
                errors.append(f'{where} 헤더 형식 오류'); cur = None; continue
            cur = {'id': parts[0], 'k': [k.strip().lower() for k in parts[1].split(',') if k.strip()],
                   'ex': [e.strip() for e in parts[2].split(';') if e.strip()], 'e': parts[3] or 'neutral',
                   'fu': (parts[4] if len(parts) > 4 and parts[4] not in ('', 'none') else None), 'r': {}, '_src': where}
            intents.append(cur)
        elif line.startswith('%'):
            cur = {'r': {}, '_src': where}; followups[line[1:].strip()] = cur
        elif re.match(r'^[ospc]:', line):
            if cur is None:
                errors.append(f'{where} 헤더 없이 문장이 나옴'); continue
            cur['r'][TRAITS[line[0]]] = [x.strip() for x in line[2:].split(' / ') if x.strip()]
        else:
            errors.append(f'{where} 알 수 없는 줄: {line[:30]}')

ids = set()
for it in intents:
    if it['id'] in ids: errors.append(f"{it['_src']} 중복 id {it['id']}")
    ids.add(it['id'])
    if it['fu'] and it['fu'] not in followups: errors.append(f"{it['_src']} 없는 후속 뱅크 {it['fu']}")
for blk in intents + list(followups.values()):
    for t in TRAITS.values():
        if not blk['r'].get(t): errors.append(f"{blk['_src']} '{t}' 문장 없음")

if errors:
    print('\n'.join(errors)); sys.exit(1)

for blk in intents + list(followups.values()):
    blk.pop('_src', None)
n_int = sum(len(v) for it in intents for v in it['r'].values())
n_fu = sum(len(v) for b in followups.values() for v in b['r'].values())
n_ex = sum(len(it['ex']) for it in intents)
data = {'_설명': '자동 생성 파일 — 수정은 tools/conv_src/*.txt 에서 하고 tools/build_conv.py 를 실행하세요.',
        'stats': {'intents': len(intents), 'replies': n_int, 'followupReplies': n_fu, 'playerExamples': n_ex, 'pairs': n_int + n_fu},
        'intents': intents, 'followups': followups}
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'의도 {len(intents)}개 · NPC 응답 {n_int}개 + 후속 반응 {n_fu}개 = 대화쌍 {n_int + n_fu}개 · 플레이어 예문 {n_ex}개')
print(f'→ {OUT} ({OUT.stat().st_size // 1024} KB)')
