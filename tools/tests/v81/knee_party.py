import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
MEAS = """(()=>{ const T=NC.THREE; let back=0, tot=0, worst=0, lod=0; const bad=[]; for (const pr of NC.Party.pairs.filter(p=>p.on)) for (const n of [pr.m,pr.f]) { const g=n.g, r=g.userData.real; if(!r||!r.Bn||!r.Bn.ulL) continue; if(r.lod) lod++; r.model.updateMatrixWorld(true);
  const fw=new T.Vector3(Math.sin(r.root.rotation.y),0,Math.cos(r.root.rotation.y)); for (const sd of ['L','R']) { const a=r.Bn['ul'+sd].getWorldPosition(new T.Vector3()), b=r.Bn['ll'+sd].getWorldPosition(new T.Vector3()), c=r.Bn['foot'+sd].getWorldPosition(new T.Vector3());
  const ax=c.clone().sub(a).normalize(); const k=b.clone().sub(a); k.addScaledVector(ax,-k.dot(ax)); const bend=Math.PI-a.clone().sub(b).angleTo(c.clone().sub(b)); const f=k.dot(fw); tot++; if (bend>.1 && f<-.01) { back++; bad.push(n.name+sd+':'+(pr.st&&pr.st.style)+':'+f.toFixed(3)); } worst=Math.min(worst,f); } }
  return {tot, back, worst:+worst.toFixed(3), lod, bad:bad.slice(0,6)}; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1000,'height':620})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real).length>=16", polling=2000, timeout=600000)
        await pg.evaluate("NC.Party.start('blues')")
        await pg.wait_for_function("NC.Party.pairs.filter(p=>p.on).length>=4", polling=1000, timeout=500000)
        await pg.wait_for_timeout(5000)
        R={'off':[], 'on':[]}
        await pg.evaluate("NC.RealHuman.noLeg=true"); await pg.wait_for_timeout(1500)
        for i in range(5): R['off'].append(await pg.evaluate(MEAS)); await pg.wait_for_timeout(1200)
        await pg.evaluate("(()=>{ const pr=NC.Party.pairs.filter(p=>p.on).find(p=>p.m.g.userData.real)||NC.Party.pairs[0]; window._pr=pr; const a=pr.m, b=pr.f, mx=(a.x+b.x)/2, mz=(a.z+b.z)/2, dx=b.x-a.x, dz=b.z-a.z, l=Math.hypot(dx,dz)||1; window._cam=[mx+(-dz/l)*2.2,.9,mz+(dx/l)*2.2,mx,.65,mz]; })()")
        await pg.wait_for_timeout(2000); await pg.screenshot(path='/tmp/v80s/knee_off.png')
        await pg.evaluate("NC.RealHuman.noLeg=false"); await pg.wait_for_timeout(1500)
        for i in range(5): R['on'].append(await pg.evaluate(MEAS)); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/tmp/v80s/knee_on.png')
        R['styles']=await pg.evaluate("NC.Party.pairs.filter(p=>p.on).map(p=>p.st&&p.st.style)")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
