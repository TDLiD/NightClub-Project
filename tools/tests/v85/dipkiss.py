from h import *
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,480,320)
        R={}
        await pg.evaluate(f"(()=>{{ const n={GIRL}; n.aff=100; window._k=n; NC.account=NC.account||{{uid:'u'}}; NC.Wallet.add(3000,'t'); NC.Karaoke.enter({{comp:n}}); }})()")
        await pg.wait_for_function("NC.Karaoke.inRoom", polling=500, timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("NC.Dialog.open(window._k)"); await pg.wait_for_timeout(500)
        await pg.evaluate("NC.Karaoke.startBlues(window._k)"); await pg.wait_for_timeout(4000)
        await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#tChips button')].find(b=>/로맨틱 딥/.test(b.textContent)); b.click(); })()")
        await pg.evaluate(HIDE)
        R['s']=[]
        for i in range(8):
            await pg.wait_for_timeout(700)
            R['s'].append(await pg.evaluate("""(()=>{ const RH=NC.RealHuman, a=NC.player.group.userData.real, b=window._k.g.userData.real, A=NC.Karaoke.BL.act; const f=NC.player.group.userData.faceTgt; return {e:A?+((performance.now()-A.t0)/1000).toFixed(1):null, k:A&&A.k, kissy:A&&A.kissy, lips:+RH.facePt(a,'lips').distanceTo(RH.facePt(b,'lips')).toFixed(3), ft:f?f.mode+':'+(+f.w).toFixed(2):null, kiss:+NC.Karaoke.BL.kiss.toFixed(1)}; })()"""))
            await pg.screenshot(path=f'/tmp/v85s/dk_{i}.png')
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
