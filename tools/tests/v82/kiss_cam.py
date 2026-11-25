import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1100,'height':640})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started && NC.player.group.userData.real", polling=1000)
        await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe).length>=1", polling=2000, timeout=600000)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=3; P.z=-6; P.group.position.set(3,0,-6); const n=NC.npcs.find(n=>n.gender==='f'&&n.role!=='staff'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe); n.x=3.6; n.z=-6; n.g.position.set(3.6,0,-6); n.aff=100; window._bn=n; })()")
        await pg.evaluate("NC.Karaoke.startBlues(window._bn)")
        await pg.wait_for_timeout(8000)
        R={}
        await pg.screenshot(path='/tmp/v80s/kiss_0_before.png')
        # 첫 키스(💋 칩 클릭)
        R['pre']=await pg.evaluate("({bl:!!NC.Karaoke.BL.n, dlg:!!NC.Dialog.cur, chips:[...document.querySelectorAll('#dlg button')].map(b=>b.textContent).slice(0,14)})")
        print(json.dumps(R, ensure_ascii=False), flush=True)
        R['chip']=await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#dlg button')].find(b=>/키스하기/.test(b.textContent)); if(b){b.click(); return true;} NC.Karaoke.bluesAct('kiss'); return 'direct'; })()")
        await pg.wait_for_timeout(4000)
        R['post']=await pg.evaluate("({kiss:NC.Karaoke.BL.kiss, busy:NC.Karaoke.BL.busy, act:NC.Karaoke.BL.act&&NC.Karaoke.BL.act.k, last:[...document.querySelectorAll('#dlg .say, #dlg .msg')].map(e=>e.textContent).slice(-3)})")
        print(json.dumps(R, ensure_ascii=False), flush=True)
        await pg.wait_for_function("NC.Karaoke.BL.kiss>0", polling=100, timeout=120000)
        shots=[]
        for i in range(6):
            await pg.wait_for_timeout(500)
            shots.append(await pg.evaluate("(()=>{ const c=NC.camera.position, BL=NC.Karaoke.BL; const m=window._bn.g.position; return {kiss:+BL.kiss.toFixed(2), deep:!!BL.deep, camDist:+Math.hypot(c.x-m.x,c.z-m.z).toFixed(2), camY:+c.y.toFixed(2), dlg:document.getElementById('dlg')&&document.getElementById('dlg').style.opacity}; })()"))
            await pg.screenshot(path=f'/tmp/v80s/kiss_1_{i}.png')
        R['kiss1']=shots
        await pg.wait_for_function("NC.Karaoke.BL.kiss<=0 && !NC.Karaoke.BL.busy", polling=300, timeout=200000)
        await pg.wait_for_timeout(3000)
        R['after']=await pg.evaluate("(()=>{ const c=NC.camera.position, m=window._bn.g.position; return {camDist:+Math.hypot(c.x-m.x,c.z-m.z).toFixed(2), dlg:document.getElementById('dlg').style.opacity}; })()")
        await pg.screenshot(path='/tmp/v80s/kiss_2_after.png')
        # 두 번째 💋 → 딥키스
        R['chip2']=await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#dlg button')].find(b=>/키스하기/.test(b.textContent)); if(b){b.click(); return true;} NC.Karaoke.bluesAct('deepkiss'); return 'direct'; })()")
        await pg.wait_for_function("NC.Karaoke.BL.kiss>0", polling=100, timeout=120000)
        sh2=[]
        for i in range(5):
            await pg.wait_for_timeout(700)
            sh2.append(await pg.evaluate("(()=>{ const BL=NC.Karaoke.BL, u=NC.player.group.userData; return {kiss:+BL.kiss.toFixed(2), deep:!!BL.deep, tilt:u.faceTgt?+u.faceTgt.tilt.toFixed(3):null, gap:u.faceTgt?+u.faceTgt.gap.toFixed(3):null}; })()"))
            await pg.screenshot(path=f'/tmp/v80s/kiss_3_{i}.png')
        R['deep']=sh2
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
