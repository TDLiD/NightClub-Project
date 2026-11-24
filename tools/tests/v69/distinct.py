import json, itertools, math, sys
def vec(d):
    v=[]
    for k in sorted(d):
        if k=='dist': continue
        x=d[k]; w = .4 if k.endswith('fwd') else 1.0
        v += [c*w for c in x]
    return v
def dist(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b))/ (len(a)/3))
for tag in sys.argv[1:]:
    R=json.load(open(f'actions_{tag}.json')); V={k:vec(v['desc']) for k,v in R.items() if 'desc' in v}
    ks=list(V); print('==',tag)
    near=[]
    for a in ks:
        if a=='hold': continue
        others=[(dist(V[a],V[b]),b) for b in ks if b!=a]; m=min(others)
        near.append(m[0]); print(f"{a:9s} nearest {m[1]:9s} {m[0]*100:5.1f}cm   vs hold {dist(V[a],V['hold'])*100:5.1f}cm")
    print('mean nearest', round(sum(near)/len(near)*100,1),'cm  min', round(min(near)*100,1))
