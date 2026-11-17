"""check_commented_code.py — 수정 전/후 JS 를 비교해 '주석에 삼켜진 코드'를 찾음 (v48·v53 에서 실제로 생긴 버그 유형)
사용: python3 tools/tests/check_commented_code.py <이전 폴더> <현재 폴더>
  예) python3 tools/tests/check_commented_code.py ../backup_v52/public public
이전 버전에서 '실행되던 코드 조각'이 새 버전에서는 주석(// 뒤) 안에만 남아 있으면 줄 번호와 함께 출력합니다. 0건이면 통과."""
import os, re, sys

def strip_strings(l):
    return re.sub(r"'(\\.|[^'\\])*'|\"(\\.|[^\"\\])*\"|`(\\.|[^`\\])*`", lambda m: ' ' * len(m.group(0)), l)

def split_code_comment(l):
    s = strip_strings(l); i = s.find('//')
    while i > 0 and s[i - 1] == ':': i = s.find('//', i + 2)   # URL(http://) 은 주석이 아님
    return (l, '') if i < 0 else (l[:i], l[i + 2:])

def code_frags(text):
    out = set()
    for l in text.split('\n'):
        code, _ = split_code_comment(l)
        for f in re.split(r';\s*', code):
            f = f.strip()
            if len(f) >= 10 and re.search(r'[=(]', f): out.add(f)
    return out

def main(old_dir, new_dir):
    hits = 0
    for root, _, files in os.walk(new_dir):
        for fn in files:
            if not fn.endswith('.js'): continue
            new_p = os.path.join(root, fn); old_p = os.path.join(old_dir, os.path.relpath(new_p, new_dir))
            if not os.path.exists(old_p): continue
            A = open(new_p, encoding='utf8').read(); B = open(old_p, encoding='utf8').read().replace('\r', '')
            if A == B: continue
            new_code = code_frags(A)
            comments = [(n, split_code_comment(l)[1]) for n, l in enumerate(A.split('\n'), 1)]
            for f in code_frags(B):
                if f in new_code: continue
                for n, c in comments:
                    if f in c: print(f'{os.path.relpath(new_p, new_dir)}:{n}  주석 안에 갇힌 코드 → {f[:100]}'); hits += 1; break
    print('결과:', '통과(0건)' if not hits else f'{hits}건 — 확인 필요'); return hits

if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1], sys.argv[2]) else 0)
