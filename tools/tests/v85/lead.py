from h import *
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,560,360)
        R={}
        # 플레이어를 테이블존에, 여자도 옆에
        await pg.evaluate(f"(()=>{{ const P=NC.player; P.x=-14; P.z=0; P.group.position.set(-14,0,0); const n={GIRL}; n.x=-13.4; n.z=.3; n.g.position.set(-13.4,0,.3); n.aff=90; window._k=n; NC.Dialog.open(n); }})()")
        await pg.wait_for_timeout(1500)
        R['zone']=await pg.evaluate("NC.player.zone")
        await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/브루스 추실래요/.test(b.textContent)); b?b.click():NC.Karaoke.startBlues(window._k); })()")
        await pg.wait_for_timeout(2500)
        R['walk']=await pg.evaluate("({lead:!!NC.Karaoke.BL.lead, pw:NC.PairWalk.n===window._k, style:NC.PairWalk.style, auto:!!NC.player.autoPath, sp:NC.player.autoSpeed})")
        await pg.evaluate(HIDE)
        await pg.evaluate("window._cam=()=>{ const P=NC.player, n=window._k; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, f=P.group.rotation.y; return [mx+Math.sin(f)*2.4, 1.6, mz+Math.cos(f)*2.4, mx, 1.0, mz]; }")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v85s/lead_walk.png')
        await pg.wait_for_function("NC.Karaoke.BL.n===window._k", polling=500, timeout=400000)
        R['arrive']=await pg.evaluate("({where:NC.Karaoke.BL.where, zone:NC.player.zone, c:NC.Karaoke.BL.c, dlg:!!NC.Dialog.cur})")
        await pg.wait_for_timeout(4000); await pg.evaluate(SHOWUI); await pg.screenshot(path='/tmp/v85s/lead_blues.png')
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
