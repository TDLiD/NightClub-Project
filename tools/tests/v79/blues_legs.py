import asyncio, json, sys
from playwright.async_api import async_playwright
TAG = sys.argv[1] if len(sys.argv)>1 else 'before'
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
KNEE = """(()=>{ const out=[]; const RH=NC.RealHuman||NC.RH; const P=NC.player, n=window._bn; for (const [nm,g] of [['me',P.group],[n.name,n.g]]) { const r=g.userData.real; if(!r||!r.Bn) { out.push(nm+':noreal'); continue; } const B=r.Bn, T=NC.THREE; const fw=new T.Vector3(Math.sin(g.rotation.y),0,Math.cos(g.rotation.y)); const res={nm};
  for (const sd of ['L','R']) { const a=B['ul'+sd].getWorldPosition(new T.Vector3()), b=B['ll'+sd].getWorldPosition(new T.Vector3()), c=B['foot'+sd].getWorldPosition(new T.Vector3()); const ac=c.clone().sub(a), ab=b.clone().sub(a); const t=ab.dot(ac)/ac.lengthSq(); const off=ab.clone().sub(ac.clone().multiplyScalar(t)); const ang=Math.PI-b.clone().sub(a).negate().angleTo(c.clone().sub(b).negate().negate()) ;
    const ba=a.clone().sub(b), bc=c.clone().sub(b); const knee=Math.PI-ba.angleTo(bc); const side=new T.Vector3().crossVectors(new T.Vector3(0,1,0),fw); res[sd]={bend:+knee.toFixed(2), fwd:+off.dot(fw).toFixed(3), side:+off.dot(side).toFixed(3)}; }
  out.push(res);} return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1000,'height':620})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.player.group.userData.real", polling=1000)
        await pg.evaluate(CAM)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=3; P.z=-6; P.group.position.set(3,0,-6); const n=NC.npcs.find(n=>n.gender==='f'&&n.role!=='staff'&&n.state==='wander'&&!n.g.userData.wardrobe); n.x=3.6; n.z=-6; n.g.position.set(3.6,0,-6); n.aff=90; window._bn=n; })()")
        await pg.wait_for_function("window._bn.g.userData.real && !window._bn.g.userData.real.pending", polling=1000, timeout=300000)
        await pg.evaluate("NC.Karaoke.startBlues(window._bn)")
        await pg.wait_for_timeout(15000)
        R={'samples':[]}
        await pg.evaluate("(()=>{ const P=NC.player,n=window._bn; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, dx=n.x-P.x, dz=n.z-P.z, l=Math.hypot(dx,dz)||1; window._cam=[mx+(-dz/l)*2.3, .8, mz+(dx/l)*2.3, mx, .6, mz]; window._camF=[mx+(dx/l)*0+(-dz/l)*0, .8, mz, mx,.6,mz]; })()")
        for k in range(4):
            await pg.wait_for_timeout(3500); R['samples'].append(await pg.evaluate(KNEE)); await pg.screenshot(path=f'/tmp/v79s/blues_{TAG}_{k}.png')
        R['bl']=await pg.evaluate("!!(NC.Karaoke.BL&&NC.Karaoke.BL.n)")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
