"""Test E: 동작 중단(다가가는 중·닿은 직후·유지 중·떨어지는 중)과 블루스 종료 후 두 사람이 정상 자세로 돌아오는지"""
import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
CASES = [('hug',.4,'cancel'),('kiss',1.0,'cancel'),('dip',2.2,'cancel'),('backhug',3.8,'cancel'),('spin',1.2,'switch:hug'),('waist',1.5,'end'),('deepkiss',2.0,'end'),('dip',1.8,'end')]
CHECK = r"""(()=>{ const P=NC.player, n=window._n, out={}; for(const [nm,g] of [['P',P.group],['N',n.g]]){ const u=g.userData, R=u.rig, r=u.real;
   out[nm]={bAct:!!u.bAct, kissK:+(u.kissK||0).toFixed(2), ikLock:!!(u.ikLock&&(u.ikLock.L>.05||u.ikLock.R>.05)), cfix:!!u.cfix, tiltX:+g.rotation.x.toFixed(3), tiltZ:+g.rotation.z.toFixed(3),
     hips:+Math.hypot(R.hips.rotation.x,R.hips.rotation.z).toFixed(3), torso:+Math.hypot(R.torso.rotation.x,R.torso.rotation.z).toFixed(3), sep:r?+r.sep.length().toFixed(3):0, fpW:r?+(r.fpW||0).toFixed(2):0,
     mc:r&&r.mc&&r.mc.layers?r.mc.layers.length:-1, base:u.mBase, moving:!!u.moving, lease: NC.Pose&&NC.Pose.leases?NC.Pose.leases(g):null }; }
   out.BL={n:!!NC.Karaoke.BL.n, busy:!!NC.Karaoke.BL.busy, gap:+(NC.Karaoke.BL.gap||0).toFixed(3)}; out.nState=n.state; out.dist=+Math.hypot(P.x-n.x,P.z-n.z).toFixed(2); return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':400,'height':300})).new_page(); pg.set_default_timeout(1200000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[0]; window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); NC.npcs.forEach(o=>{ if(o!==n) o.cool=999; }); })()""")
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&NC.player.group.userData.real&&!NC.player.group.userData.real.pending", timeout=900000, polling=2000)
        await pg.add_script_tag(content=open('vclock.js').read())
        await pg.evaluate("(()=>{ const a0=performance.now()/1000; Object.defineProperty(BaseAudioContext.prototype,'currentTime',{get(){ return performance.now()/1000-a0; }, configurable:true}); })()")
        await pg.evaluate("window._w=s=>{ window._wt=performance.now()+s*1000; }")
        async def wait(s):
            await pg.evaluate(f"window._w({s})"); await pg.wait_for_function("performance.now()>window._wt", polling=300)
        async def start():
            await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; if(K.BL.n) K.endBlues('stop'); n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n); })()""")
            await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>2.6", polling=400)
        print('baseline hold', json.dumps(await (start() or pg.evaluate(CHECK)) if False else None))
        await start(); base = await pg.evaluate(CHECK); print('HOLD', json.dumps(base))
        res=[]
        for act, at, how in CASES:
            if not await pg.evaluate("!!NC.Karaoke.BL.n"): await start()
            await pg.evaluate(f"NC.Karaoke.bluesAct('{act}')"); await wait(at)
            if how=='cancel': await pg.evaluate("NC.Karaoke.K_cancel ? 0 : 0; (()=>{ const c=[...document.querySelectorAll('button')].find(b=>/지금 동작 멈추기/.test(b.textContent)); if(c) c.click(); else NC.Karaoke.endBlues('stop'); })()")
            elif how.startswith('switch:'): await pg.evaluate(f"NC.Karaoke.bluesAct('{how[7:]}')")
            else: await pg.evaluate("NC.Karaoke.endBlues('stop')")
            await wait(how.startswith('switch') and 5.0 or 2.5)
            c = await pg.evaluate(CHECK); res.append((act, at, how, c)); print(act, at, how, json.dumps(c), flush=True)
        json.dump(res, open('./interrupt.json','w'), ensure_ascii=False, indent=1)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
