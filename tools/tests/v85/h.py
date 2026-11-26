import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=typeof window._cam==='function'?window._cam():window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
GIRL = "NC.npcs.find(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe)"
def out(R): print(json.dumps(R, ensure_ascii=False), flush=True)
async def boot(p, w=480, h=300):
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = await (await b.new_context(viewport={'width':w,'height':h})).new_page(); pg.set_default_timeout(900000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
    await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
    await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started && NC.player.group.userData.real", polling=1000)
    await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
    await pg.wait_for_function(f"!!({GIRL})", polling=2000, timeout=600000)
    return b, pg, errs
HIDE = "(()=>{ const s=document.createElement('style'); s.id='hideui'; s.textContent='body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}'; document.head.appendChild(s); })()"
SHOWUI = "document.getElementById('hideui')&&document.getElementById('hideui').remove()"
