"""v77 체형 캐릭터 18종: 실제 앱에서 전신·얼굴 촬영 → 캐릭터 고르기 썸네일(full)·프로필 사진"""
import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':720,'height':720})).new_page(); pg.set_default_timeout(600000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.BodyType", polling=1000)
        ids = await pg.evaluate("NC.RealHuman.cfg.models.filter(m=>m.body).map(m=>[m.id,m.gender])")
        await pg.evaluate("""(()=>{ const T=NC.THREE; NC.NPC.setCrowdEnabled && NC.NPC.setCrowdEnabled(false); (NC.npcs||[]).forEach(n=>{ if(n.g){ n.g.visible=false; n.x=60; n.z=60; n.g.position.set(60,0,60);} }); (NC.Escort&&NC.Escort.list||[]).forEach(o=>{ o.x=60; o.z=62; });
          const bg=new T.Mesh(new T.PlaneGeometry(8,8), new T.MeshBasicMaterial({color:0x3b2a52})); bg.position.set(0,2,1.2); NC.scene.add(bg); const fl=new T.Mesh(new T.PlaneGeometry(8,8), new T.MeshBasicMaterial({color:0x36264c})); fl.rotation.x=-Math.PI/2; fl.position.set(0,.012,3); NC.scene.add(fl); NC.player.x=0; NC.player.z=9; NC.player.group.position.set(0,0,9); NC.player.group.visible=false;
          window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } }); })()""")
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        res=[]
        import sys
        only = sys.argv[1].split(',') if len(sys.argv)>1 else None
        for mid,g in ids:
            if only and mid not in only: continue
            await pg.evaluate(f"""(()=>{{ if(window._av){{ NC.scene.remove(window._av); }} const look={{gender:'{g}', realModel:'{mid}', height:{1.62 if g=='f' else 1.75}}}; const a=NC.Avatar.create({{name:'', look, seed:7, expr:'smile'}}); a.traverse(o=>{{ if(o.isSprite) o.visible=false; }}); a.position.set(0,0,2.2); a.rotation.y=0; NC.scene.add(a); window._av=a; window._pg0=window._pg0||NC.player.group; NC.player.group=a; NC.player.x=0; NC.player.z=2.2; NC.player.ry=0;   /* 시험: 플레이어로 취급(얼굴 중복 교체 방지) */ a.userData.lookAt=null; }})()""")
            await pg.evaluate("window._cam=[0,0.95,6.4,0,.88,2.2]")
            try: await pg.wait_for_function("(()=>{ const r=window._av.userData.real; return r&&!r.pending; })()", polling=500, timeout=90000)
            except Exception: print(json.dumps({'id':mid,'fail':await pg.evaluate("(()=>{ const u=window._av.userData; return {real:!!u.real, pend:u.real&&u.real.pending, parent:!!window._av.parent}; })()")}), flush=True); continue
            try: await pg.wait_for_function("(()=>{ const r=window._av.userData.real; return r&&!r.pending&&!/_lod/.test(r.url); })()", polling=500, timeout=25000)
            except Exception: pass
            await pg.wait_for_timeout(1200)
            info = await pg.evaluate("(()=>{ const r=window._av.userData.real; return {url:r.url, bt:r._bt, hs:r.holder.scale.toArray().map(v=>+v.toFixed(3))}; })()")
            await pg.evaluate("window._cam=[0,0.92,5.0,0,.86,2.2]"); await pg.wait_for_timeout(900); await pg.screenshot(path=f'/tmp/v77s/cap/{mid}_full.png')
            hy = 1.5 if g=='f' else 1.62
            await pg.evaluate(f"window._cam=[0,{hy},3.25,0,{hy-.06},2.2]"); await pg.wait_for_timeout(900); await pg.screenshot(path=f'/tmp/v77s/cap/{mid}_face.png')
            info['id']=mid; res.append(info); print(json.dumps(info), flush=True)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
