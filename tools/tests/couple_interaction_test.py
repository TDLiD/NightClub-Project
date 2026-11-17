import asyncio, sys, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1}));"
MODE = sys.argv[1]           # new | old
SHOTS = len(sys.argv) > 2
ACTS = ['whisper', 'waist', 'spin', 'dip', 'forehead', 'cheek', 'hug', 'backhug', 'kiss']
VCLOCK = "(()=>{ let t=performance.now(); performance.now=()=>t; const Q=[]; const st=window.setTimeout.bind(window); window.setTimeout=(fn,ms,...a)=>{ if(typeof fn!=='function') return st(fn,ms); const id=Math.random(); Q.push({at:t+(ms||0), fn, a, id}); return id; }; const ct=window.clearTimeout.bind(window); window.clearTimeout=id=>{ const i=Q.findIndex(q=>q.id===id); if(i>=0) Q.splice(i,1); else ct(id); }; const raf=window.requestAnimationFrame.bind(window); window.requestAnimationFrame=cb=>raf(()=>{ t+=1000/30; for(let i=Q.length-1;i>=0;i--) if(Q[i].at<=t){ const q=Q.splice(i,1)[0]; try{q.fn(...q.a);}catch(e){console.error(e);} } cb(t); }); })();"
SETUP = """(()=>{ const V=()=>new NC.THREE.Vector3(), RH=NC.RealHuman; window._S=[];
  NC.tickers.push(()=>{ const BL=NC.Karaoke.BL; if(!BL.n) return; const a=BL.act, e=a?(performance.now()-a.t0)/1000:0, tag=a?a.k:'hold';
    if(a && (e<a.hit||e>a.dur-.9)) return; if(!a && BL.t<2.6) return;
    const pg=NC.player.group, n=BL.n, rec={tag, err:0, pen:9, wrist:0, elbow:0, tpen:RH.stats.pen||0};
    for(const [g,o] of [[pg,n.g],[n.g,pg]]){ const r=g.userData.real; if(!r||r.pending) { rec.noreal=1; continue; } const B=r.Bn, D=g.userData.armDbg||{};
      for(const rs of ['L','R']){ const ms=rs==='L'?'R':'L', ua=B['ua'+ms], la=B['la'+ms], h=B['hand'+ms], m1=B['f'+ms+'1_1']; if(!ua||!la||!h) continue;
        const pu=ua.getWorldPosition(V()), pl=la.getWorldPosition(V()), ph=h.getWorldPosition(V()), pm=m1?m1.getWorldPosition(V()):ph.clone();
        const fa=ph.clone().sub(pl).normalize(), hd=pm.clone().sub(ph).normalize(), palm=ph.clone().addScaledVector(hd,.055*r.sc);
        rec.wrist=Math.max(rec.wrist, Math.acos(Math.max(-1,Math.min(1,fa.dot(hd))))*57.3); rec.elbow=Math.max(rec.elbow, Math.acos(Math.max(-1,Math.min(1,pl.clone().sub(pu).normalize().dot(fa))))*57.3);
        const d=D[rs]; if(d && d.w>.95) rec.err=Math.max(rec.err, palm.distanceTo(d.tgt));
        for(let i=1;i<=6;i++){ const p=i<=3? pu.clone().lerp(pl,i/3) : pl.clone().lerp(ph,(i-3)/3); rec.pen=Math.min(rec.pen, RH.norm(o,p,['torso','neck','head'])); } } }
    _S.push(rec); }); })()"""
SUM = """(tag)=>{ const s0=_S.filter(x=>x.tag===tag); if(!s0.length) return {tag,n:0}; const q2=(f,p)=>{const v=s0.map(f).sort((a,b)=>a-b); return +v[Math.min(v.length-1,Math.floor(v.length*p))].toFixed(3);}; return {tag,n:s0.length, err50:q2(x=>x.err,.5), err90:q2(x=>x.err,.9), penMin:q2(x=>x.pen,0), pen10:q2(x=>x.pen,.1), wristMax:q2(x=>x.wrist,1), wrist90:q2(x=>x.wrist,.9), elbowMax:q2(x=>x.elbow,1), torsoPenMax:q2(x=>x.tpen,1), noreal:s0.filter(x=>x.noreal).length}; const s=_S.filter(x=>x.tag===tag); if(!s.length) return {tag,n:0}; const q=(f,p)=>{const v=s.map(f).sort((a,b)=>a-b); return +v[Math.min(v.length-1,Math.floor(v.length*p))].toFixed(3);};
  return {tag, n:s.length, minA:q(x=>x.mA,0), p10A:q(x=>x.mA,.1), minB:q(x=>x.mB,0), p10B:q(x=>x.mB,.1), err50:q(x=>x.err,.5), err90:q(x=>x.err,.9), headGap:q(x=>x.hg,.5), jmp50:q(x=>x.jmp,.5), jmp95:q(x=>x.jmp,.95), jmpMax:q(x=>x.jmp,1), bendMax:q(x=>x.bend,1), dH:+(s[0].hA-s[0].hB).toFixed(2)}; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width':900,'height':600}); pg = await ctx.new_page(); pg.set_default_timeout(900000); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        if MODE == 'old':
            for nm in ['couple','humanglb']:
                src = open(f'/home/claude/{nm}_v46.js', encoding='utf-8').read()
                await pg.route(f'**/js/{nm}.js*', (lambda body: (lambda route: route.fulfill(status=200, content_type='application/javascript', body=body)))(src))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded'); await pg.evaluate("localStorage.clear();"+SESS+"localStorage.setItem('nc_look', JSON.stringify({gender:'m', seed:424242}));"); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(5000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.player.group && NC.npcs && NC.npcs.length>=6", timeout=600000); await pg.wait_for_timeout(2000)
        await pg.add_script_tag(content=VCLOCK)
        if MODE == 'old': await pg.add_script_tag(content=open('/home/claude/tests/poly_old.js').read())
        await pg.evaluate(SETUP)
        for which in (['short'] if len(sys.argv) < 4 else ['short','tall']):
            pick = "a.h-b.h" if which == 'short' else "b.h-a.h"
            info = await pg.evaluate(f"""(()=>{{ const fs=NC.npcs.filter(n=>n.gender==='f'&&n.state!=='seated'&&!n.stay).map(n=>({{n,h:n.g.userData.look.height}})).sort((a,b)=>{pick}); const n=fs[0].n; window._n=n; n.aff=100; n.booked=true;
               NC.npcs.forEach(o=>{{ if(o!==n){{ o.g.visible=false; o.enabled=false; }} }}); n.g.visible=true; n.enabled=true;
               NC.player.x=n.x+.9; NC.player.z=n.z; NC.player.group.position.set(NC.player.x,0,NC.player.z); NC.Dialog.open(n); NC.Karaoke.startBlues(n);
               return [n.name, n.g.userData.look.height.toFixed(2), n.g.userData.look.body||'-', NC.player.group.userData.look.height.toFixed(2)]; }})()""")
            print('[pair]', which, 'partner', info[0], info[1], info[2], '/ player', info[3], flush=True)
            await pg.wait_for_function("NC.Karaoke.BL.n && NC.player.group.userData.real && !NC.player.group.userData.real.pending && NC.Karaoke.BL.n.g.userData.real && !NC.Karaoke.BL.n.g.userData.real.pending && /humans\\/[fm]_\\d+\\.glb/.test(NC.Karaoke.BL.n.g.userData.real.url) && /humans\\/[fm]_\\d+\\.glb/.test(NC.player.group.userData.real.url)", timeout=1500000, polling=2000)
            print('   real models', await pg.evaluate("[NC.player.group.userData.real.url, NC.Karaoke.BL.n.g.userData.real.url]"), flush=True)
            await pg.wait_for_function("NC.Karaoke.BL.t>2.6", timeout=900000)
            print('  ', await pg.evaluate(SUM, 'hold'), flush=True)
            for k in ACTS:
                await pg.evaluate("(()=>{ const r={out:'accept', d:0, e:'smile', line:'…'}; if ('%s'==='kiss') r.kiss=2.6; NC.Karaoke.bluesAct('%s', r); })()" % (k, k))
                if SHOTS and which == 'short' and k in ('hug', 'kiss', 'dip', 'backhug', 'waist', 'whisper'):
                    hit = await pg.evaluate("NC.Karaoke.ACT['%s'].hit" % k)
                    await pg.wait_for_function("NC.Karaoke.BL.act && (performance.now()-NC.Karaoke.BL.act.t0)/1000 > %f" % (hit + .7), timeout=900000)
                    for nm, ang in [('front', 1.57), ('side', 0), ('q3', .8), ('back', -1.57)]:
                        await pg.evaluate("""(()=>{ const c=NC.Karaoke.BL.c, gy=NC.groundY(c.x,c.z), ry=NC.player.group.rotation.y+%f; window._cam=[c.x+Math.sin(ry)*2.4, gy+1.45, c.z+Math.cos(ry)*2.4, c.x, gy+1.2, c.z]; window._camHold=true; if(!window._camT){ window._camT=1; NC.tickers.push(()=>{ if(window._cam){ const q=_cam; NC.camera.position.set(q[0],q[1],q[2]); NC.camera.lookAt(q[3],q[4],q[5]); } }); } })()""" % ang)
                        await pg.evaluate("(async()=>{ const f0=performance.now(); await new Promise(r=>{ const g=()=>{ if(performance.now()-f0>60) r(); else requestAnimationFrame(g); }; requestAnimationFrame(g); }); })()")
                        await pg.evaluate("document.querySelectorAll('#talk,#hud,#top,#bar,#chat,#mini,.toast,#guestPanel,#profCard').forEach(e=>e&&(e.style.visibility='hidden'))")
                        await pg.screenshot(path=f"/home/claude/tests/v47_{MODE}_{k}_{nm}.png")
                    await pg.evaluate("window._cam=null")
                await pg.wait_for_function("!NC.Karaoke.BL.act", timeout=900000)
                print('  ', await pg.evaluate(SUM, k), flush=True)
            # 동작 중 전환: kiss 도중 hug
            await pg.evaluate("NC.Karaoke.bluesAct('kiss', {out:'accept',d:0,e:'smile',line:'…',kiss:2.6})")
            await pg.wait_for_function("NC.Karaoke.BL.act && (performance.now()-NC.Karaoke.BL.act.t0)/1000 > 1.3", timeout=900000)
            await pg.evaluate("NC.Karaoke.bluesAct('hug', {out:'accept',d:0,e:'smile',line:'…'})")
            print('   switch kiss→hug: now', await pg.evaluate("NC.Karaoke.BL.act && NC.Karaoke.BL.act.k"), flush=True)
            await pg.wait_for_function("!NC.Karaoke.BL.act", timeout=900000)
            print('  ', await pg.evaluate(SUM, 'hug'), '(hug 누적)', flush=True)
            await pg.evaluate("_S.length=0; NC.Karaoke.endBlues('stop'); NC.Dialog.cur && NC.Dialog.close('bye')")
            await pg.wait_for_timeout(1500)
        print('NOALL' or 'ALLFRAMES', await pg.evaluate("(()=>{ const o={}; (window._JA||[]).forEach(x=>{ const r=o[x.k]||(o[x.k]={n:0,max:0,big:0,bend:0}); r.n++; r.max=Math.max(r.max,+x.jm.toFixed(1)); if(x.jm>25) r.big++; r.bend=Math.max(r.bend,+x.bd.toFixed(0)); }); return JSON.stringify(o); })()"))
        print('errs', errs[:5]); await b.close()
asyncio.run(main())
