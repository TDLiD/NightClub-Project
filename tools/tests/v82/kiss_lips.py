import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':900,'height':560})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started && NC.player.group.userData.real", polling=1000)
        await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe).length>=1", polling=2000, timeout=600000)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=3; P.z=-6; P.group.position.set(3,0,-6); const n=NC.npcs.find(n=>n.gender==='f'&&n.role!=='staff'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe); n.x=3.6; n.z=-6; n.g.position.set(3.6,0,-6); n.aff=100; n.bl=n.bl||{}; window._bn=n; })()")
        await pg.evaluate("NC.Karaoke.startBlues(window._bn)"); await pg.wait_for_timeout(8000)
        await pg.evaluate("window._bn.bl.kissed=true; NC.Karaoke.bluesAct('deepkiss')")
        await pg.evaluate("""window._log=[]; NC.tickers.push(()=>{ const BL=NC.Karaoke.BL; if(!(BL.kiss>0)) return; const h=g=>{const r=g.userData.real; return r&&r.Bn.head?r.Bn.head.getWorldPosition(new NC.THREE.Vector3()):null}; const a=h(NC.player.group), c=h(window._bn.g); const u=NC.player.group.userData; window._log.push([+BL.kiss.toFixed(2), a&&c?+a.distanceTo(c).toFixed(3):null, u.faceTgt?+u.faceTgt.tilt.toFixed(2):null, u.faceTgt?+(u.faceTgt.w||0).toFixed(2):null]); });""")
        for i in range(6):
            await pg.wait_for_timeout(9000); await pg.screenshot(path=f'/tmp/v80s/klip_{i}.png')
        lg=await pg.evaluate("window._log")
        step=max(1,len(lg)//14)
        print(json.dumps({'n':len(lg),'log':lg[::step],'errors':errs[:4]}, ensure_ascii=False)); await b.close()
asyncio.run(main())
