"""v74 객실 5종: 입구 → 침대 앞까지 걸어갈 수 있는지(반경 0.38m, 0.05m 격자 BFS, 실제 ROOM.rects) + 자쿠지 스위트 위에서 본 캡처"""
import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':600,'height':560})).new_page(); pg.set_default_timeout(600000)
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.Motel && NC.Motel._x && NC.Motel._x.ROOM", polling=1000)
        r = await pg.evaluate("""(()=>{ const X=NC.Motel._x, R=X.ROOM, RV=X.RV, out={}; const RHX=4.4, RHZ=3.8, rad=.38, st=.05;
          for (const cat of ['std','dlx','rom','vip','jac']) { X.buildRoom(cat); const rects=R.rects.slice(); const free=(x,z)=>{ if (x<-RHX+rad||x>RHX-rad||z<-RHZ+rad||z>RHZ-rad) return false; for (const [a,b,c,d] of rects){ const cx=Math.max(a,Math.min(c,x)), cz=Math.max(b,Math.min(d,z)); if (Math.hypot(x-cx,z-cz)<rad) return false; } return true; };
            const s=R.entry, key=(i,j)=>i+','+j, I=x=>Math.round(x/st), seen=new Set(), q=[[I(s.x),I(s.z)]]; seen.add(key(...q[0])); const startFree=free(s.x,s.z);
            while(q.length){ const [i,j]=q.shift(); for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni=i+di,nj=j+dj,k=key(ni,nj); if(seen.has(k)) continue; if(!free(ni*st,nj*st)) continue; seen.add(k); q.push([ni,nj]); } }
            const bed=RV.seats.bed[0], tgt=[bed.x, bed.z+.15]; let best=9; seen.forEach(k=>{ const [i,j]=k.split(',').map(Number); best=Math.min(best, Math.hypot(i*st-tgt[0], j*st-tgt[1])); });
            out[cat]={ entryFree:startFree, reachableCells:seen.size, distToBedFront:+best.toFixed(2), jac:RV.jacC||null, rects:rects.length }; }
          return JSON.stringify(out); })()""")
        print(r, flush=True)
        # 자쿠지 스위트를 실제로 열고 위에서 촬영
        await pg.evaluate("""(async()=>{ const S=NC.Motel, n=NC.npcs.find(x=>x.gender==='f'); S.n=n; S.hotel={name:'테스트',k:1,id:'t'}; S.cat='jac'; S.stay='rent'; S.step='corr'; S.busy=false; await S._x.enterRoom(); })()""")
        await pg.wait_for_function("NC.Motel.step==='room' && !NC.Motel.busy", polling=500)
        await pg.evaluate("(()=>{ const BX=NC.Motel._x.BX; NC.tickers.push(()=>{ NC.camera.position.set(BX+.2, 8.5, 90+3.2); NC.camera.lookAt(BX, 0, 90); }); })()")
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v74_jac_top.png')
        await pg.evaluate("(()=>{ const BX=NC.Motel._x.BX, P=NC.player; NC.tickers.length && NC.tickers.pop(); NC.tickers.push(()=>{ NC.camera.position.set(BX+3.9, 1.7, 90+3.5); NC.camera.lookAt(BX-.5, .8, 90-1.5); }); })()")
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v74_jac_entry.png')
        await b.close()
asyncio.run(main())
