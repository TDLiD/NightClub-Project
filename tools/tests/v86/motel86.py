from h import *
ENTER = """(async()=>{ const S=NC.Motel, n=%s; window._k=n; n.aff=100; S.n=n; S.hotel={name:'테스트',k:1,id:'t'}; S.cat='std'; S.stay='night'; S.step='corr'; S.busy=false; S.on=true; S.comfort=90; await S._x.enterRoom(); })()"""
ST = """(()=>{ const S=NC.Motel, Z=S.x19.Z, p=NC.player, n=S.n, X=S._x; return {lie:!!Z.lie, lk:!!Z.lkiss, duvet:X.RV.duvet&&X.RV.duvet.visible, out:[Z.out.me,Z.out.n], wear:[Z.wear.me,Z.wear.n], pseat:!!p.seat, pSeated:!!p.group.userData.seated, nstate:n.state, nSeated:!!n.g.userData.seated, prx:+p.group.rotation.x.toFixed(2), nrx:+n.g.rotation.x.toFixed(2), py:+p.group.position.y.toFixed(2), ny:+n.g.position.y.toFixed(2), p:[+(p.x-X.BX).toFixed(2),+(p.z-90).toFixed(2)], n:[+(n.x-X.BX).toFixed(2),+(n.z-90).toFixed(2)], run:!!Z.running, acts:document.querySelector('#actBtn')?document.querySelector('#actBtn').textContent:''}; })()"""
def x19(k): return f"(()=>{{ const it=NC.Motel.extActs.find(a=>a[0]==='x19_{k}'); it[2](); }})()"
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,640,420)
        R={}
        await pg.evaluate(ENTER % GIRL)
        await pg.wait_for_function("NC.Motel.step==='room' && !NC.Motel.busy", polling=500, timeout=300000)
        await pg.wait_for_function("(()=>{ const a=NC.player.group.userData.real, b=NC.Motel.n.g.userData.real; return a&&!a.pending&&b&&!b.pending; })()", polling=1000, timeout=300000)
        await pg.evaluate("NC.Motel.x19.Z.adult=true; try{ localStorage.setItem('nc_adult19','1'); }catch(e){}")
        await pg.evaluate(HIDE)
        X=await pg.evaluate("NC.Motel._x.BX")
        cam_bed=f"window._cam=[{X}+1.9,1.7,90-3.8+2.6,{X},.6,90-3.8+1.0]"
        # 1 눕기
        await pg.evaluate(x19('lie')); await pg.wait_for_timeout(4000)
        R['lie']=await pg.evaluate(ST); await pg.evaluate(cam_bed); await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v86s/lie.png')
        # 2 침대에 앉기 (E 제공자)
        await pg.evaluate("window._cam=null")
        R['prov']=await pg.evaluate("NC.interactProviders.flatMap(f=>{ try{ return (f()||[]).map(x=>x.label); }catch(e){ return ['ERR']; } })")
        await pg.evaluate("(()=>{ const x=NC.interactProviders.flatMap(f=>f()||[]).find(x=>/침대에 앉기|나란히 앉기/.test(x.label)); x&&x.run(); })()"); await pg.wait_for_timeout(3000)
        R['sit']=await pg.evaluate(ST); await pg.evaluate(cam_bed); await pg.wait_for_timeout(1200); await pg.screenshot(path='/tmp/v86s/sit.png')
        # 3 침대 키스
        await pg.evaluate(x19('lkiss')); await pg.wait_for_timeout(1500)
        await pg.evaluate("window._cam=null")
        R['ks']=[]
        for i in range(4):
            await pg.wait_for_timeout(1000)
            R['ks'].append(await pg.evaluate("(()=>{ const RH=NC.RealHuman, a=NC.player.group.userData.real, b=NC.Motel.n.g.userData.real; return {lk:!!NC.Motel.x19.Z.lkiss, lips:+RH.facePt(a,'lips').distanceTo(RH.facePt(b,'lips')).toFixed(3), cam:+NC.camera.position.distanceTo(RH.facePt(a,'lips')).toFixed(2), cp:NC.camera.position.toArray().map(v=>+v.toFixed(2)), lp:RH.facePt(a,'lips').toArray().map(v=>+v.toFixed(2)), co:(()=>{ const c=NC.camOverride&&NC.camOverride(); return c&&[c.cx,c.cy,c.cz,c.tx,c.ty,c.tz].map(v=>+v.toFixed(2)); })(), look:NC._look&&NC._look.toArray().map(v=>+v.toFixed(2)), lastF:NC._lastF}; })()"))
            await pg.screenshot(path=f'/tmp/v86s/kiss_{i}.png')
        await pg.wait_for_function("!NC.Motel.x19.Z.running", polling=500, timeout=120000)
        # 4 일어나기
        await pg.evaluate("(()=>{ const x=NC.interactProviders.flatMap(f=>f()||[]).find(x=>/일어나기/.test(x.label)); window._lab=x&&x.label; x&&x.run(); })()"); await pg.wait_for_timeout(3000)
        R['up']=await pg.evaluate(ST); R['upLab']=await pg.evaluate("window._lab")
        await pg.evaluate(cam_bed); await pg.wait_for_timeout(1200); await pg.screenshot(path='/tmp/v86s/up.png'); await pg.evaluate("window._cam=null")
        # 5 카메라 고정
        await pg.evaluate("NC.cam.yaw+=1.3"); await pg.wait_for_timeout(4000)
        R['camHold']=await pg.evaluate("[+NC.cam.yaw.toFixed(2), !!NC._camHold]")
        await pg.wait_for_timeout(3000); R['camHold2']=await pg.evaluate("+NC.cam.yaw.toFixed(2)")
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
