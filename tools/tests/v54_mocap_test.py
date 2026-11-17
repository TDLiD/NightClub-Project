import asyncio, json, sys
from playwright.async_api import async_playwright
SHOTS = '/home/claude/tests/'
ENTER = """window._off=null; new MutationObserver(()=>{ if(!document.getElementById('enterOv') && NC.player.group && _off==null) _off=1 }).observe(document.body,{childList:true}); document.querySelector('#go').click()"""
CAM = """window._cam=null; if(!window._camT){ window._camT=1; NC.tickers.push(()=>{ if(window._cam){ const q=_cam; NC.camera.position.set(q[0],q[1],q[2]); NC.camera.lookAt(q[3],q[4],q[5]); } }); }"""
STATS = """(()=>{ const MC=NC.RealHuman.MC, L=NC.RealHuman.list; const cnt={}; let on=0; L.forEach(r=>{ const m=r.mc; if(m&&m.w>.5){ on++; const t=m.layers[m.layers.length-1]; const k=(r.u.mBase||'?')+':'+(t?t.name.replace(/^[fm]_/,''):'-'); cnt[k]=(cnt[k]||0)+1; } else { const k='OFF:'+(r.u.mBase||'?'); cnt[k]=(cnt[k]||0)+1; } });
  return {real:L.length, mocapOn:on, loads:MC.stats.loads, meta:!!MC.meta, states:cnt}; })()"""
# 대상 찾기: 실사 + 모션캡처 활성 + 주어진 기본 상태
FIND = """((base)=>{ const L=NC.RealHuman.list.filter(r=>r.mc&&r.mc.w>.9&&r.u.mBase===base&&!r.pending); const cp=NC.camera.position; L.sort((a,b)=>a.root.position.distanceTo(cp)-b.root.position.distanceTo(cp)); const r=L[0]; if(!r) return null; window._tgt=r; return r.u.name||r.root.name||'?'; })"""
# 발 미끄러짐: 걷는 사람의 발이 바닥에 닿은 동안(가장 낮은 발) 수평 속도 vs 몸 속도
SLIDE = """(()=>new Promise(res=>{ const r=window._tgt; const B=r.Bn, T=NC.THREE; const a=new T.Vector3(), b=new T.Vector3(), rp=new T.Vector3(); let last=null, n=0, slide=0, body=0, st=0; const t0=performance.now();
  const f=()=>{ r.root.getWorldPosition(rp); B.footL.getWorldPosition(a); B.footR.getWorldPosition(b); const now=performance.now(); const low=a.y<b.y?a.clone():b.clone(), side=a.y<b.y?'L':'R';
    if(last&&last.side===side){ const dt=(now-last.t)/1000; if(dt>0){ slide+=Math.hypot(low.x-last.p.x, low.z-last.p.z)/dt; body+=Math.hypot(rp.x-last.r.x, rp.z-last.r.z)/dt; n++; } }
    last={p:low, r:rp.clone(), t:now, side}; if(now-t0<2500) requestAnimationFrame(f); else res({frames:n, stanceFootSpeed:+(slide/Math.max(1,n)).toFixed(3), bodySpeed:+(body/Math.max(1,n)).toFixed(3), clip:r.mc.layers[r.mc.layers.length-1].name, ts:+(r.mc.v).toFixed(2)}); };
  requestAnimationFrame(f); }))()"""
SEAT = """(()=>{ const r=window._tgt, T=NC.THREE, v=new T.Vector3(), a=new T.Vector3(), b=new T.Vector3(); r.root.getWorldPosition(v); const pel=r.mc.B.get('Bip01_Pelvis'); const p=new T.Vector3(); pel.getWorldPosition(p); r.Bn.footL.getWorldPosition(a); r.Bn.footR.getWorldPosition(b);
  return {seatH:r.u.seatH, pelvisAboveFloor:+(p.y-v.y).toFixed(3), pelvisAboveSeat:+(p.y-v.y-r.u.seatH).toFixed(3), footL:+(a.y-v.y).toFixed(3), footR:+(b.y-v.y).toFixed(3), clip:r.mc.layers[r.mc.layers.length-1].name}; })()"""
AIM = """((d,h,ang)=>{ const r=window._tgt, T=NC.THREE, v=new T.Vector3(); r.root.getWorldPosition(v); const ry=r.root.rotation.y+ang; window._cam=[v.x+Math.sin(ry)*d, v.y+h, v.z+Math.cos(ry)*d, v.x, v.y+h*.62, v.z]; })"""

async def main():
    vp = (1280, 760)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': vp[0], 'height': vp[1]}); pg.set_default_timeout(1800000); errs = []; warns = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('console', lambda m: (warns.append(m.text[:200]) if m.type in ('warning', 'error') else None))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear(); localStorage.setItem('nc_quality', JSON.stringify('high')); localStorage.setItem('nc_session', JSON.stringify({uid:'u_t',id:'tester',nickname:'테스터',gender:'남성',characterNo:13}))")
        await pg.reload(wait_until='domcontentloaded')
        await pg.wait_for_function("NC.dataReady && document.querySelector('#go')", timeout=900000); await pg.wait_for_timeout(6000)
        await pg.evaluate(ENTER); await pg.wait_for_function("window._off!=null", timeout=900000)
        await pg.evaluate(CAM)
        for i in range(3):
            await pg.wait_for_timeout(12000); print('stats', i, json.dumps(await pg.evaluate(STATS), ensure_ascii=False), flush=True)
        res = {}
        for base, d, h, angs in (('walk', 2.6, 1.5, (0, 1.57)), ('sit', 2.2, 1.2, (0.4, 1.57)), ('groove', 2.8, 1.6, (0, 2.3)), ('idle', 2.4, 1.5, (0,)), ('stageDance', 3.2, 1.7, (0,))):
            nm = await pg.evaluate(FIND + "('%s')" % base); print(base, 'target', nm, flush=True)
            if not nm: continue
            if base == 'walk': res['walk'] = await pg.evaluate(SLIDE); print('walk slide', res['walk'], flush=True)
            if base == 'sit': res['sit'] = await pg.evaluate(SEAT); print('sit', res['sit'], flush=True)
            for k, a in enumerate(angs):
                await pg.evaluate(AIM + "(%f,%f,%f)" % (d, h, a)); await pg.wait_for_timeout(1800)
                await pg.screenshot(path=f'{SHOTS}m54_{base}_{k}.png')
            await pg.evaluate("window._cam=null")
        print('errs', errs[:5]); print('warns', [w for w in warns if 'mocap' in w or 'Bip01' in w or 'binding' in w.lower()][:8], len(warns))
        await b.close()
asyncio.run(main())
