from h import *
ELB = """(()=>{ const V=NC.THREE.Vector3, f=(g)=>{ const B=g.userData.real.Bn; const o={}; for(const s of ['L','R']){ const ua=B['ua'+s], fa=ua&&ua.children.find(c=>c.isBone), hd=B['hand'+s]; if(!ua||!fa||!hd) continue; const a=ua.getWorldPosition(new V()), b=fa.getWorldPosition(new V()), c=hd.getWorldPosition(new V()); o[s]=+(180-a.sub(b).angleTo(c.clone().sub(b))*180/Math.PI).toFixed(0); } return o; }; return {me:f(NC.player.group), her:f(window._k.g), style:NC.PairWalk.style, rel:(()=>{ const P=NC.player,n=window._k,f=P.ry,dx=n.x-P.x,dz=n.z-P.z; return [+(dx*Math.sin(f)+dz*Math.cos(f)).toFixed(2), +(-dx*Math.cos(f)+dz*Math.sin(f)).toFixed(2), +(P.group.rotation.y-f).toFixed(2)]; })(), w:+NC.PairWalk.w.toFixed(2)}; })()"""
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,640,420)
        R={}
        await pg.evaluate(f"(()=>{{ const P=NC.player, Z=NC.world.zones.dance, x0=Z.x0+1, z0=(Z.z0+Z.z1)/2; P.x=x0; P.z=z0; P.group.position.set(x0,0,z0); P.ry=Math.PI/2; const n={GIRL}; n.x=x0; n.z=z0+.45; n.g.position.set(x0,0,z0+.45); window._tg={{x:Z.x1-1,z:z0}}; n.aff=75; window._k=n; NC.PairWalk.start(n,'arm'); }})()")
        await pg.wait_for_timeout(3000)
        R['still']=await pg.evaluate(ELB); await pg.evaluate(HIDE)
        await pg.evaluate("window._cam=()=>{ const P=NC.player, n=window._k; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, f=P.ry; return [mx+Math.sin(f)*1.5, 1.4, mz+Math.cos(f)*2.2, mx, 1.0, mz]; }")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v85s/arm_still.png')
        await pg.evaluate("NC.player.target=window._tg")
        await pg.wait_for_timeout(2000)
        R['walk']=await pg.evaluate(ELB)
        await pg.screenshot(path='/tmp/v85s/arm_walk.png')
        await pg.evaluate("window._cam=()=>{ const P=NC.player, n=window._k; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, f=P.ry+Math.PI/2; return [mx+Math.sin(f)*1.5, 1.3, mz+Math.cos(f)*2.2, mx, 1.0, mz]; }")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v85s/arm_side.png')
        await pg.evaluate("window._cam=()=>{ const P=NC.player, n=window._k; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, f=P.ry, lx=-Math.cos(f), lz=Math.sin(f); return [mx+Math.sin(f)*1.3+lx*1.1, 1.35, mz+Math.cos(f)*1.3+lz*1.1, mx, 1.05, mz]; }")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v85s/arm_34.png')
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
