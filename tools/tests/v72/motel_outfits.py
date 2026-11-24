"""v72 모텔 객실: 상태별 옷 레이어(외출복→재킷 벗음→편한 차림→상의 벗음→잠옷 차림→가운·실크·슬립·잠옷·수건·이불) — 침대에 나란히 앉은 채 캡처"""
import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'; WHO = sys.argv[2] if len(sys.argv) > 2 else 'hyejung'
STATES = [('street',0,''),('jacketOff',1,''),('barefoot',2,''),('underTop',3,''),('under',4,''),('robe',0,'robe'),('silk',0,'silk'),('slip',0,'slip'),('pajama',0,'pajama'),('towel',0,'towel'),('cover',5,'')]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':560,'height':480})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function(f"NC.player && NC.NPC && NC.NPC.byId && NC.NPC.byId('{WHO}') && NC.Motel && NC.Motel._x", polling=1000)
        await pg.evaluate(f"""(async()=>{{ const S=NC.Motel, n=NC.NPC.byId('{WHO}'); S.n=n; S.hotel={{name:'테스트',k:1,id:'t'}}; S.cat='std'; S.stay='rent'; S.step='corr'; S.busy=false; S.comfort=80; await S._x.enterRoom(); }})()""")
        print("entering", flush=True)
        await pg.wait_for_function("NC.Motel.step==='room' && !NC.Motel.busy", polling=500, timeout=300000)
        print("in room", flush=True)
        await pg.evaluate("(()=>{ const S=NC.Motel; S._x.sitBoth('bed'); window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } }); try{ NC.Dialog.open(S.n); NC.Dialog.close && NC.Dialog.close(); }catch(e){} })()")
        await pg.wait_for_function("(()=>{ const a=NC.player.group.userData.real, b=NC.Motel.n.g.userData.real; return a&&!a.pending&&b&&!b.pending; })()", polling=1000, timeout=300000)
        await pg.evaluate("(()=>{ const S=NC.Motel; S._x.sitBoth('bed'); })()"); await pg.wait_for_timeout(2500)
        print(await pg.evaluate("JSON.stringify({seat:NC.player.seat, pSeated:!!NC.player.group.userData.seated, nState:NC.Motel.n.state, nSeated:!!NC.Motel.n.g.userData.seated, p:[NC.player.x,NC.player.z], n:[NC.Motel.n.x,NC.Motel.n.z]})"), flush=True)
        info = await pg.evaluate("(()=>{ const S=NC.Motel, X=S._x, s=X.RV.seats.bed; return {BX:X.BX, seats:s, me:NC.player.group.userData.real.url, n:S.n.g.userData.real.url, nPos:[S.n.x,S.n.z], pPos:[NC.player.x,NC.player.z]}; })()")
        print(json.dumps(info), flush=True)
        BX=info['BX']; z=90+info['seats'][0]['z']
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        res=[]
        for name,out,wear in STATES:
            await pg.evaluate(f"(()=>{{ const z=NC.Motel._z; for (const w of ['me','n']) z.setOut(w,{out},{json.dumps(wear)}); }})()")
            await pg.evaluate(f"window._cam=[{BX},1.25,{z+2.3},{BX},.8,{z}]"); await pg.wait_for_timeout(2500)
            r = await pg.evaluate("(()=>{ const S=NC.Motel, z=S._z; const f=g=>{ const r=g.userData.real; return r? (r._lyMeshes||[]).map(m=>m.name+':'+m.geometry.index.count/3).join(' ') : 'noreal'; }; return { me:z.stateTxt('me'), n:z.stateTxt('n'), lyMe:f(NC.player.group), lyN:f(S.n.g) }; })()")
            r['state']=name; res.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)
            await pg.screenshot(path=f'/tmp/v72s/{TAG}_{name}.png')
        await pg.evaluate(f"window._cam=[{BX+1.6},1.1,{z+.6},{BX},.8,{z}]"); await pg.wait_for_timeout(2000); await pg.screenshot(path=f'/tmp/v72s/{TAG}_side.png')
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
