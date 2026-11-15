'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Arena,SKINS}=require('./game-core.cjs');
const arena=new Arena();
const sessions=new Map();
arena.state='playing';arena.botCount=4;
for(let i=0;i<4;i++)arena.spawnBot(i);
for(let i=0;i<900;i++)arena.addFish(arena.randomPoint(35));
const html=fs.readFileSync(path.join(__dirname,'..','index.html'));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>2048)req.destroy()});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch{reject(new Error('bad JSON'))}});req.on('error',reject)})}
function remove(s){if(!s)return;if(s.stream){s.stream.end();s.stream=null}arena.cats=arena.cats.filter(c=>c!==s.cat);sessions.delete(s.token)}
function trimBots(){let bots=arena.cats.filter(c=>c.alive&&!c.human);const target=Math.max(0,Math.min(4,80-sessions.size));while(bots.length>target){const c=bots.pop();arena.cats=arena.cats.filter(x=>x!==c)}}
function join(req,res,data){
 if(sessions.size>=80)return json(res,409,{error:'地图已满'});
 const token=crypto.randomBytes(24).toString('hex'),pos=arena.findSpawn(),name=String(data.name||'小鱼收集家').trim().slice(0,10)||'小鱼收集家';
 const skin=SKINS.some(s=>s.id===data.skin)?data.skin:'orange';
 const c=arena.makeCat({...pos,name,skin,angle:Math.random()*Math.PI*2});c.human=true;
 sessions.set(token,{token,cat:c,last:Date.now(),stream:null});trimBots();json(res,200,{token});
}
function snapshot(session){
 const me=session.cat,r=1800;
 const visible=arena.cats.filter(c=>c===me||c.alive&&c.segments.some(p=>Math.abs(p.x-me.x)<r&&Math.abs(p.y-me.y)<r));
 return {me:me.id,totalCats:arena.cats.filter(c=>c.alive).length,onlinePlayers:sessions.size,time:arena.time,width:arena.width,height:arena.height,mapCats:arena.cats.filter(c=>c.alive).map(c=>({id:c.id,x:c.x,y:c.y})),cats:visible.map(c=>({id:c.id,x:c.x,y:c.y,angle:c.angle,targetAngle:c.targetAngle,skin:c.skin,name:c.name,alive:c.alive,radius:c.radius,segments:c.segments,length:c.length,fish:c.fish,kills:c.kills,boost:c.boost,sprinting:c.sprinting,grace:c.grace,blink:c.blink,skillCooldown:c.skillCooldown,reason:c.reason,killerName:c.killerName})),food:arena.food.filter(f=>Math.abs(f.x-me.x)<r&&Math.abs(f.y-me.y)<r)};
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html)}
 if(req.method==='GET'&&u.pathname==='/api/events'){
  const s=sessions.get(u.searchParams.get('token'));if(!s)return json(res,404,{error:'请重新加入'});
  if(s.stream)s.stream.end();res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});s.stream=res;s.last=Date.now();res.write('data: '+JSON.stringify(snapshot(s))+'\n\n');req.on('close',()=>{if(s.stream===res)s.stream=null});return;
 }
 if(req.method==='POST'&&['/api/join','/api/input','/api/leave'].includes(u.pathname)){
  let d;try{d=await body(req)}catch{return json(res,400,{error:'请求无效'})}
  if(u.pathname==='/api/join')return join(req,res,d);
  const s=sessions.get(d.token);if(!s)return json(res,404,{error:'请重新加入'});
  if(u.pathname==='/api/leave'){remove(s);return json(res,200,{ok:true})}
  s.last=Date.now();if(Number.isFinite(d.angle))s.cat.targetAngle=d.angle;s.cat.sprinting=!!d.boost;if(d.skill)arena.activateSkill(s.cat);return json(res,200,{ok:true});
 }
 json(res,404,{error:'页面不存在'});
});
let tick=0;const interval=setInterval(()=>{
 const dt=.05;arena.time+=dt;
 for(const c of arena.cats){if(!c.alive)continue;if(!c.human){arena.steerAI(c,dt);if(c.skillCooldown<=0&&Math.random()<.01)arena.activateSkill(c)}arena.moveCat(c,dt)}
 const deaths=arena.collisionDeaths();for(const d of deaths){d.cat.reason=d.reason;d.cat.killerName=d.killer?.name||'';arena.killCat(d.cat,d.reason,d.killer)}
 for(const c of arena.cats)if(c.alive)arena.eat(c);
 arena.respawns=arena.respawns.filter(r=>{if(r.at>arena.time)return true;if(arena.cats.filter(c=>c.alive&&!c.human).length<Math.min(4,80-sessions.size))arena.spawnBot(r.index);return false});
 for(const s of sessions.values())if(Date.now()-s.last>30000)remove(s);
if(tick%100===0){const need=Math.max(0,Math.min(4,80-sessions.size)-arena.cats.filter(c=>c.alive&&!c.human).length);for(let i=0;i<need;i++)arena.spawnBot(i)}
 arena.cats=arena.cats.filter(c=>c.alive||c.human);
 for(let i=0;i<8&&arena.food.length<900;i++)arena.addFish(arena.randomPoint(30));
 arena.particles=[];
 if(++tick%2===0)for(const s of sessions.values())if(s.stream&&!s.stream.destroyed)s.stream.write('data: '+JSON.stringify(snapshot(s))+'\n\n');
},50);
server.on('close',()=>clearInterval(interval));
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`猫猫大作战多人服务已启动： http://localhost:${port}`));
