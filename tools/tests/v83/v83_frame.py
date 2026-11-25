import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1280,'height':680})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real).length>=16 ", polling=2000, timeout=700000)
        R={}
        # 5) 대화창 프레이밍
        await pg.evaluate("(()=>{ const P=NC.player; P.x=0; P.z=-3; P.group.position.set(0,0,-3); const n=NC.npcs.find(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real); n.x=.7; n.z=-3.2; n.g.position.set(.7,0,-3.2); window._dn=n; NC.Dialog.open(n); })()")
        await pg.wait_for_timeout(5000)
        R['frame']=await pg.evaluate("""(()=>{ const P=NC.player, n=window._dn, v=new NC.THREE.Vector3((P.x+n.x)/2, 1.3, (P.z+n.z)/2).project(NC.camera); const gl=document.getElementById('guestList'), dl=document.getElementById('dlg'); return {pairNdcX:+v.x.toFixed(2), freeCenter:+NC.freeCenterX().toFixed(2), guestRight:gl?Math.round(gl.getBoundingClientRect().right):null, dlgLeft:dl?Math.round(dl.getBoundingClientRect().left):null, W:innerWidth}; })()""")
        await pg.screenshot(path='/tmp/v83s/dialog.png')
        await pg.evaluate("NC.Dialog.close && NC.Dialog.close('bye'); window._dn.aff=100; NC.Karaoke.startBlues(window._dn)")
        await pg.wait_for_timeout(7000)
        await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#dlg button')]; return b.length; })()")
        R['frameBlues']=await pg.evaluate("""(()=>{ const P=NC.player, n=window._dn, v=new NC.THREE.Vector3((P.x+n.x)/2, 1.3, (P.z+n.z)/2).project(NC.camera); return {pairNdcX:+v.x.toFixed(2), freeCenter:+NC.freeCenterX().toFixed(2), dlg:!!NC.Dialog.cur}; })()""")
        await pg.screenshot(path='/tmp/v83s/blues_frame.png')
        R['errors']=errs[:6]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
