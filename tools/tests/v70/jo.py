"""v70b: npcs.json no19(조여사 슬롯 jo) → 블루스 19+ 칩·모텔 19+ 패널 숨김, 다른 NPC 영향 없음 — 실제 앱"""
import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
CHIPS = "(()=>[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/엉덩이|가슴 주물|팬티|19\\+ 스킨십/.test(t)))()"
async def blues(pg, expr):
    await pg.evaluate(f"""(()=>{{ const n={expr}; window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); n.state='wander'; n.aff=100; n.bl={{kissed:true,warned:0}}; NC.Dialog.open(n); NC.Karaoke.startBlues(n); }})()""")
    await pg.wait_for_function("NC.Karaoke.BL.n===window._n && NC.Karaoke.BL.t>1.5", polling=500)
    await pg.evaluate("NC.Dialog.chips()"); await pg.wait_for_timeout(300)
    r = {'name': await pg.evaluate("window._n.name"), 'no19': await pg.evaluate("NC.RealHuman.no19(window._n.g)"), 'chips19': await pg.evaluate(CHIPS),
         'kiss': await pg.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('키스하기'))"),
         'motel': await pg.evaluate("(()=>{ const S=NC.Motel; const s0=S.step,n0=S.n; S.step='room'; S.n=window._n; const h=S.extPanel(); S.step=s0; S.n=n0; return h.length; })()")}
    await pg.evaluate("NC.Karaoke.BL.n && (()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('브루스 그만')); b&&b.click(); })()"); await pg.wait_for_timeout(1500)
    return r
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':560,'height':560})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.NPC && NC.NPC.byId && NC.NPC.byId('jo')", timeout=600000, polling=1000)
        R = {'jo': await blues(pg, "NC.NPC.byId('jo')")}
        R['other'] = await blues(pg, "NC.npcs.find(n=>n.id!=='jo'&&n.gender==='f'&&n.g.visible&&n.state==='wander')")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
