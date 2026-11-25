import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
POSE = """(()=>{ const out=[]; for (const pr of NC.Party.pairs.filter(p=>p.on).slice(0,8)) { const R=pr.m.g.userData.rig, R2=pr.f.g.userData.rig; if(!R) continue;
  out.push({st:pr.st&&pr.st.style, rot:pr.st&&+pr.st.rot.toFixed(2), bx:+R.body.position.x.toFixed(3), bz:+R.body.position.z.toFixed(3), kn:+(R.knL?R.knL.rotation.x:0).toFixed(2), legL:+(R.legL?R.legL.rotation.x:0).toFixed(2), fbx:+(R2?R2.body.position.x:0).toFixed(3)}); } return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1100,'height':620})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real).length>=16", polling=2000, timeout=600000)
        R={}
        # 1) 댄싱 킹/퀸 끝내기 버튼
        R['dkStart']=await pg.evaluate("NC.Events.start('dk',true)")
        await pg.wait_for_timeout(3000)
        R['dkBtns']=await pg.evaluate("[...document.querySelectorAll('#dkBar button')].map(b=>b.textContent+':'+getComputedStyle(b).display)")
        await pg.screenshot(path='/tmp/v80s/dk_bar.png')
        await pg.evaluate("document.querySelector('#dkBar [data-a=stop]').click()"); await pg.wait_for_timeout(1500)
        R['dkAfterStop']=await pg.evaluate("({phase:NC.DanceKing.phase, bar:document.querySelector('#dkBar').style.display, ev:!!NC.Events.cur, left:NC.npcs.filter(n=>n._dk).length})")
        # 2) 블루스 타임
        await pg.evaluate("NC.Party.start('blues')")
        await pg.wait_for_function("NC.Party.pairs.filter(p=>p.on).length>=3", polling=1000, timeout=500000)
        await pg.wait_for_timeout(6000)
        R['bluesPose1']=await pg.evaluate(POSE); await pg.wait_for_timeout(1500); R['bluesPose2']=await pg.evaluate(POSE)
        await pg.evaluate("(()=>{ const ps=NC.Party.pairs.filter(p=>p.on); const xs=ps.map(p=>p.c.x), zs=ps.map(p=>p.c.z); const cx=xs.reduce((a,b)=>a+b,0)/xs.length, cz=zs.reduce((a,b)=>a+b,0)/zs.length; window._cam=[cx, 3.0, cz+6.5, cx, .9, cz]; })()")
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v80s/blues1.png')
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v80s/blues2.png')
        await pg.evaluate("NC.Party.stop('user'); window._cam=null"); await pg.wait_for_timeout(2000)
        # 3) 디스코 타임
        await pg.evaluate("NC.Party.start('disco')")
        await pg.wait_for_function("NC.npcs.filter(n=>n.state==='party').length>=10", polling=1000, timeout=500000)
        await pg.wait_for_timeout(8000)
        samp = """(()=>{ const ds=NC.npcs.filter(n=>n.state==='party'&&n.g.userData.real&&n.g.userData.real.mc&&n.g.userData.real.mc.layers&&n.g.userData.real.mc.layers.length); const clips={}; const ph=[]; ds.forEach(n=>{ const L=n.g.userData.real.mc.layers; const top=L[L.length-1]; clips[top.name]=(clips[top.name]||0)+1; ph.push(+(top.t%4).toFixed(2)); }); return {n:ds.length, clips, phases:ph.slice(0,12)}; })()"""
        R['disco1']=await pg.evaluate(samp); await pg.wait_for_timeout(6000); R['disco2']=await pg.evaluate(samp)
        R['spins']=await pg.evaluate("(async()=>{ let c=0, seen=new Set(); for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,250)); NC.npcs.forEach(n=>{ /* spin 감지: 회전 변화 큼 */ const y=n.g.rotation.y; if(n._ly!=null && Math.abs(y-n._ly)>.25 && !n.g.userData.moving && n.state==='party') seen.add(n.name); n._ly=y; }); } return [...seen]; })()")
        await pg.evaluate("(()=>{ const F=NC.world.zones.dance; window._cam=[(F.x0+F.x1)/2, 3.4, (F.z0+F.z1)/2+7, (F.x0+F.x1)/2, .9, (F.z0+F.z1)/2]; })()")
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v80s/disco1.png')
        await pg.wait_for_timeout(3000); await pg.screenshot(path='/tmp/v80s/disco2.png')
        R['errors']=errs[:6]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
