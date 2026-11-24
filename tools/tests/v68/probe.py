"""v68 원인 조사: 블루스(두 사람 상호작용) 중 떨림·관통을 프레임 단위로 기록하고, 하위 시스템을 하나씩 끄며 원인을 분리"""
import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
ACTS = sys.argv[1].split(',') if len(sys.argv) > 1 else ['hold','waist','hug','kiss','dip']
CFGS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['base','noSep','noContact','noFoot','noLife']
PORT = sys.argv[3] if len(sys.argv) > 3 else '3100'
PIDX = int(sys.argv[4]) if len(sys.argv) > 4 else 0
PROBE = r"""(()=>{ const V=()=>new NC.THREE.Vector3(); window._R=null;
 NC.tickers.push(()=>{ const R=window._R; if(!R) return; const BL=NC.Karaoke.BL; if(!BL.n) return; const a=BL.act, e=a?(performance.now()-a.t0)/1000:BL.t;
   if(R.k==='hold'){ if(a||BL.t<R.t0||BL.t>R.t1) return; } else { if(!a||a.k!==R.k&&!(R.k==='panty'&&a.k==='undress')) return; if(a.k==='spin'?(e<a.hit+.3||e>a.dur-.3):(e<a.hit+.35||e>a.dur-1.0)) return; }
   const pts=[]; for(const g of [NC.player.group, BL.n.g]){ const r=g.userData.real; if(!r||r.pending) return; const B=r.Bn; for(const k of ['hips','handL','handR','head']){ const o=B[k]; if(!o){pts.push(0,0,0);continue;} const p=o.getWorldPosition(V()); pts.push(p.x,p.y,p.z);} pts.push(g.position.x,g.position.y,g.position.z); }
   let pen=9; const RH=NC.RealHuman; for(const [ga,gb] of [[NC.player.group,BL.n.g],[BL.n.g,NC.player.group]]){ const B=ga.userData.real.Bn; for(const k of ['handL','handR','laL','laR']){ const o=B[k]; if(!o) continue; const p=o.getWorldPosition(V()); pen=Math.min(pen, RH.norm(gb,p,['torso','neck','head'])); } }
   const D=[]; for(const g of [NC.player.group, BL.n.g]){ const r=g.userData.real, u=g.userData; D.push(+r.sep.x.toFixed(4), +r.sep.z.toFixed(4), +(r.fpW||0).toFixed(3), +r.holder.position.x.toFixed(4), +r.holder.position.z.toFixed(4), +r.holder.position.y.toFixed(4), u.swayOff?+u.swayOff.x.toFixed(4):0, u.swayOff?+u.swayOff.z.toFixed(4):0, +u.rig.hips.rotation.z.toFixed(4), +u.rig.torso.rotation.x.toFixed(4), u.footPlant?+(u.footPlant.w??1):-1, r.fp&&r.fp.step?1:0, +(NC.RealHuman.stats.pen||0).toFixed(4), u.moving?1:0, u.mBase||'', +u.rig.body.position.y.toFixed(4), u.footPlant?+(u.footPlant.drop||0).toFixed(4):0, u.footPlant?+(u.footPlant.toe||0).toFixed(4):0, u.walkSlow||0); }
   (R.d||(R.d=[])).push(D);
   R.f.push(pts.concat([pen])); });
})()"""
NAMES = ['P.hips','P.handL','P.handR','P.head','P.root','N.hips','N.handL','N.handR','N.head','N.root']
def stats(F):
    out = {}
    if len(F) < 6: return {'frames': len(F)}
    for i, nm in enumerate(NAMES):
        P = [f[i*3:i*3+3] for f in F]
        acc = []
        for t in range(2, len(P)):
            acc.append([P[t][j] - 2*P[t-1][j] + P[t-2][j] for j in range(3)])
        mag = sorted((sum(x*x for x in a) ** .5) * 1000 for a in acc)
        osc = sum(1 for t in range(1, len(acc)) if sum(acc[t][j]*acc[t-1][j] for j in range(3)) < 0 and (sum(x*x for x in acc[t])**.5) > .001) / max(1, len(acc)-1)
        out[nm] = (round(sum(mag)/len(mag), 2), round(mag[int(len(mag)*.95)], 2), round(osc, 2))
    pens = [f[-1] for f in F]; out['pen_min'] = round(min(pens), 3); out['pen_lt1'] = round(sum(1 for p in pens if p < 1) / len(pens), 2); out['frames'] = len(F)
    return out
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':480,'height':400})).new_page(); pg.set_default_timeout(1200000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(f'http://localhost:{PORT}/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("NC.renderer.setPixelRatio(.4)")
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[%d]; window._n=n; const P=NC.player;
          P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); NC.npcs.forEach(o=>{ if(o!==n) { o.cool=999; } }); })()""" % PIDX)
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&NC.player.group.userData.real&&!NC.player.group.userData.real.pending", timeout=900000, polling=2000)
        print('pair', await pg.evaluate("[NC.player.group.userData.look.height, window._n.g.userData.look.height, window._n.name, window._n.g.userData.real.url]"), flush=True)
        await pg.add_script_tag(content=open('vclock.js').read())
        await pg.evaluate("(()=>{ const a0=performance.now()/1000; Object.defineProperty(BaseAudioContext.prototype,'currentTime',{get(){ return performance.now()/1000-a0; }, configurable:true}); })()")   # 오디오 시계도 가상 시계로(테스트 착시 제거)
        await pg.evaluate(PROBE)
        res = {}
        for cfg in CFGS:
            await pg.evaluate(f"""(()=>{{ const c='{cfg}', RH=NC.RealHuman; RH.noSep=c==='noSep'||c==='allOff'; RH.noFoot=c==='noFoot'||c==='allOff'; NC.Couple.noLife=c==='noLife'||c==='allOff'; NC.Contact.STAT.off=c==='noContact'||c==='allOff'; NC.Karaoke.noMoveFix=c==='oldMove'; }})()""")
            await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; if(K.BL.n) K.endBlues('stop'); n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n); })()""")
            await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>2.5", polling=500)
            for act in ACTS:
                if act == 'hold':
                    await pg.evaluate("window._R={k:'hold',t0:NC.Karaoke.BL.t+.3,t1:NC.Karaoke.BL.t+5,f:[]}")
                    await pg.wait_for_function("NC.Karaoke.BL.t>window._R.t1+.2", polling=500)
                else:
                    await pg.evaluate(f"window._R={{k:'{act}',f:[]}}; NC.Karaoke.bluesAct('{act}')")
                    await pg.wait_for_function("!NC.Karaoke.BL.busy || !NC.Karaoke.BL.n", polling=500)
                    await pg.evaluate("window._wait=performance.now()+1500"); await pg.wait_for_function("performance.now()>window._wait", polling=300)
                F = await pg.evaluate("window._R.f"); s = stats(F); res[f'{cfg}:{act}:{len(res)}'] = s
                Dd = await pg.evaluate("window._R.d||[]"); json.dump(Dd, open(f'./diag_{PORT}_{cfg}_{act}.json','w'))
                print(cfg, act, json.dumps(s), flush=True)
                if not NC_ok(s): pass
        json.dump(res, open(f'./probe_{PORT}_{PIDX}_{"_".join(CFGS)}.json','w'), ensure_ascii=False, indent=1)
        print('errors', errs[:5])
        await b.close()
def NC_ok(s): return True
asyncio.run(main())
