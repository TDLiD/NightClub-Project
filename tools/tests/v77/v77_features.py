import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1000,'height':640})).new_page(); pg.set_default_timeout(600000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.Escort && NC.Escort.list.length===3", polling=1000)
        R={}
        # 역부킹: 진행 추적
        await pg.evaluate("(()=>{ const P=NC.player; P.x=2; P.z=2; P.group.position.set(2,0,2); NC.Nightlife.reverseBook(); })()")
        trace=[]
        for i in range(12):
            await pg.wait_for_timeout(5000)
            st = await pg.evaluate("(()=>{ const a=(NC.npcs||[]).find(n=>n.state==='path'&&n._revBook!==undefined)||null; const d=NC.Dialog.cur; return {dlg: d&&d.n&&d.n.name, toast:(document.querySelector('.toast')||{}).innerText||'', appr:(NC.npcs||[]).filter(n=>n.aff>=60&&n._revBook).map(n=>n.name+':'+n.state+':'+Math.hypot(n.x-NC.player.x,n.z-NC.player.z).toFixed(1))}; })()")
            trace.append(st)
            if st['dlg']: break
        R['reverseTrace']=trace[-3:]
        await pg.screenshot(path='/tmp/v77s/reverse.png')
        await pg.evaluate("NC.Dialog.cur && NC.Dialog.close && NC.Dialog.close()")
        await pg.wait_for_timeout(1500)
        # 무대 시점
        R['stage']=await pg.evaluate("(async()=>{ const P=NC.player; P.x=6; P.z=4; P.group.position.set(6,0,4); NC.cam.yaw=2.5; NC.cam.dist=11; NC.stageView(); const tw=NC._camTween; const log=[]; for(let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,300)); log.push([+NC.cam.yaw.toFixed(2), +NC.cam.dist.toFixed(2), !!NC._camTween]); } const s=NC.world.zones.stage; return {tw, want:+Math.atan2(P.x-(s.x0+s.x1)/2, P.z-(s.z0+s.z1)/2).toFixed(2), log, dlg:!!NC.Dialog.cur}; })()")
        await pg.screenshot(path='/tmp/v77s/stageview.png')
        # 웨이터 손
        await pg.evaluate("NC.Escort.list.forEach(o=>o.wait=0)")
        await pg.wait_for_function("NC.Escort.list.some(o=>o.state==='escort'&&o.n&&o.w>.9&&o.g.userData.real&&!o.g.userData.real.pending)", polling=500, timeout=240000)
        await pg.evaluate("(()=>{ const o=NC.Escort.list.find(o=>o.state==='escort'&&o.n); window._eo=o; NC.tickers.push(()=>{ const o=window._eo; if(!o||!o.n) return; const fx=Math.sin(o.g.rotation.y), fz=Math.cos(o.g.rotation.y); NC.camera.position.set(o.x+fx*2.6+(-fz)*.5, 1.5, o.z+fz*2.6+fx*.5); NC.camera.lookAt((o.x+o.n.x)/2, 0.95, (o.z+o.n.z)/2); }); })()")
        hs=[]
        for k in range(3):
            await pg.wait_for_timeout(1500)
            hs.append(await pg.evaluate("(()=>{ const o=window._eo; if(!o.n) return 'released'; const a=o.g.userData.real, b=o.n.g.userData.real; if(!a||!b) return 'noreal'; const V=()=>new NC.THREE.Vector3(); let best=9; ['handL','handR'].forEach(x=>['handL','handR'].forEach(y=>{ const d=a.Bn[x].getWorldPosition(V()).distanceTo(b.Bn[y].getWorldPosition(V())); best=Math.min(best,d); })); return {minHandDist:+best.toFixed(3), gap:+Math.hypot(o.n.x-o.x,o.n.z-o.z).toFixed(2), state:o.state, waiterUrl:a.url, girl:o.n.name}; })()"))
            await pg.screenshot(path=f'/tmp/v77s/escort{k}.png')
        R['escortHands']=hs
        R['charchg']=await pg.evaluate("(async()=>{ window._eo=null; const P=NC.player; P.x=0; P.z=6; NC.entry.openStyles(); await new Promise(r=>setTimeout(r,400)); const c=[...document.querySelectorAll('#stGrid .stc')].find(x=>x.dataset.id==='m_13_fat'); if(!c) return 'no card'; c.click(); await new Promise(r=>setTimeout(r,9000)); const u=NC.player.group.userData; return {chosen:'m_13_fat', lookRM:u.look&&u.look.realModel, url:u.real&&u.real.url, bodytype:u.real&&u.real._bt}; })()")
        R['errors']=errs[:6]; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
