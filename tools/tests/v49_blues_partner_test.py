import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for vp, tag in (((1000,640),'pc'), ((390,760),'mob')):
            pg = await b.new_page(viewport={'width':vp[0],'height':vp[1]}); pg.set_default_timeout(1800000); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
            await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
            await pg.evaluate("localStorage.clear(); localStorage.setItem('nc_quality', JSON.stringify('high')); localStorage.setItem('nc_session', JSON.stringify({uid:'u_t',id:'tester',nickname:'테스터',gender:'남성',characterNo:13}))"); await pg.reload(wait_until='domcontentloaded')
            await pg.wait_for_function("NC.dataReady && document.querySelector('#go')", timeout=900000); await pg.wait_for_timeout(8000)
            await pg.evaluate("window._off=null; new MutationObserver(()=>{ if(!document.getElementById('enterOv') && NC.player.group && _off==null) _off=1 }).observe(document.body,{childList:true}); document.querySelector('#go').click()")
            await pg.wait_for_function("window._off!=null", timeout=900000); await pg.wait_for_timeout(2000)
            await pg.evaluate("""(()=>{ const h=NC.npcs.find(n=>n.def&&n.def.id==='hyejung'); const P=NC.player; P.x=h.x+1; P.z=h.z; P.group.position.set(P.x,P.group.position.y,P.z); h.aff=100; h.affinity=100; h.cool=0; NC.Dialog.open(h); NC.Karaoke.startBlues(h); for(let i=0;i<12;i++){ const z=document.querySelector('#zIn'); z.dispatchEvent(new PointerEvent('pointerdown')); z.dispatchEvent(new PointerEvent('pointerup')); } })()""")
            st = "(()=>{ const h=NC.npcs.find(n=>n.def&&n.def.id==='hyejung'); const r=h.g.userData.real; const cp=NC.camera.position; const close=NC.npcs.filter(n=>n.g.visible&&n.g.position.distanceTo(cp)<10); return [r?(r.pending?'pend ':'')+(r.url||'').split('/').pop():'PROC', 'BL:'+!!(NC.Karaoke.BL.n), 'procWithin10m:'+close.filter(n=>!n.g.userData.real).map(n=>n.name).join(',')+'/'+close.length] })()"
            for i in range(4):
                await pg.wait_for_timeout(9000); print(tag, i, await pg.evaluate(st), flush=True)
            await pg.screenshot(path=f'/home/claude/tests/probe48c_{tag}.png'); print(tag, 'errs', errs[:4]); await pg.close()
        await b.close()
asyncio.run(main())
