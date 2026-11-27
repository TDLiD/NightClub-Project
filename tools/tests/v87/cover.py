from h import *
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,700,500)
        await pg.wait_for_timeout(45000)
        r=await pg.evaluate("""(()=>{ const out={real:0, proc:[], hidden:0}; const seen=new Set(); NC.scene.traverse(o=>{ const u=o.userData; if(!u||!u.rig||seen.has(o)) return; seen.add(o); let vis=o.visible; for(let p=o.parent;vis&&p;p=p.parent) vis=p.visible; if(!vis){ out.hidden++; return; } if(u.real&&!u.real.pending) out.real++; else { const n=(NC.npcs||[]).find(n=>n.g===o); out.proc.push([n?String(n.id||n.name):(o===NC.player.group?'PLAYER':(String(u.label||u.name||o.name)||'?')), n?String(n.role):'', u.vrm?'vrm':'', u.realBad?[...u.realBad].join(","):(u.real?"pending:"+u.real.url:"none"), String(u.customModel||""), String(o.name||""), +o.position.x.toFixed(1), +o.position.z.toFixed(1)]); } }); return out; })()""")
        r['stats']=await pg.evaluate("JSON.parse(JSON.stringify({near:NC.RealHuman.stats.near,mid:NC.RealHuman.stats.mid,att:NC.RealHuman.stats.attached}))")
        r['errs']=errs; out(r); await b.close()
asyncio.run(main())
