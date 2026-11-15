(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatArena=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const SKINS=[
    {id:'orange',name:'奶油橘猫',need:0,body:'#f2bd7e',light:'#ffe2ac',dark:'#d98c4b',ear:'#ecafa0'},
    {id:'tuxedo',name:'燕尾服猫',need:15,body:'#495354',light:'#f3f1e6',dark:'#303c40',ear:'#d69fa5'},
    {id:'tabby',name:'银灰虎斑',need:40,body:'#a9b9b9',light:'#e4e9df',dark:'#718b8c',ear:'#d8afa9'},
    {id:'calico',name:'三花猫',need:80,body:'#f4ecdc',light:'#fff8e8',dark:'#5d6059',ear:'#e7b1a0'},
    {id:'siamese',name:'暹罗猫',need:140,body:'#dcc9ab',light:'#f1e4cc',dark:'#796b68',ear:'#b29995'},
    {id:'blue',name:'海蓝猫',need:180,body:'#85bada',light:'#d4f0ff',dark:'#5487a5',ear:'#e5b0c4'},
    {id:'cow',name:'奶牛猫',need:220,body:'#f1eee6',light:'#ffffff',dark:'#3d4a52',ear:'#eabac0'},
    {id:'rainbow',name:'炫彩猫',need:240,body:'#b4d3bc',light:'#e5efc3',dark:'#99bda0',ear:'#dfb1c9'},
    {id:'black',name:'黑夜猫',need:300,body:'#43415e',light:'#d1cdec',dark:'#29263c',ear:'#b998b2'},
    {id:'pink',name:'樱花猫',need:380,body:'#eeb9c8',light:'#fff0f0',dark:'#c887a2',ear:'#f5d1dd'},
    {id:'gold',name:'阳光猫',need:480,body:'#f3ca69',light:'#fff0b1',dark:'#ca9544',ear:'#e7a8a2'}
  ];
  const SKILLS={orange:['橘子冲刺',2.8,14,{speed:1.55}],tuxedo:['绅士吸鱼',5,17,{magnet:75}],tabby:['灵巧转弯',5,15,{turn:1.8}],calico:['双倍成长',5,20,{growth:2}],siamese:['活力充电',1,18,{refill:100}],blue:['海浪冲刺',4,19,{speed:1.3,turn:1.25}],cow:['奶牛寻鱼',4,18,{magnet:48,speed:1.15}],rainbow:['彩虹盛宴',5,25,{growth:2,magnet:45}],black:['夜行疾风',3,19,{speed:1.38,turn:1.45}],pink:['樱花补给',4,19,{refill:55,magnet:35}],gold:['阳光加速',3,19,{refill:40,speed:1.3}]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
  const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const unlocked=(total)=>SKINS.filter(s=>total>=s.need);
  const nextSkin=(total)=>SKINS.find(s=>s.need>total)||null;
  const rainbowHue=(index,time=0)=>(index*10+time*22)%360;
  const DEFAULT_PROFILE={totalFish:0,bestLength:16,totalKills:0,runs:0,skin:'orange',name:'小鱼收集家',sound:false};
  function cleanProfile(p){
    const q={...DEFAULT_PROFILE};
    if(!p||typeof p!=='object')return q;
    for(const k of ['totalFish','bestLength','totalKills','runs'])if(Number.isFinite(p[k]))q[k]=Math.max(k==='bestLength'?16:0,Math.floor(p[k]));
    if(typeof p.name==='string')q.name=p.name.slice(0,10)||q.name;
    if(typeof p.sound==='boolean')q.sound=p.sound;
    if(SKINS.some(s=>s.id===p.skin&&s.need<=q.totalFish))q.skin=p.skin;
    return q;
  }
  class Arena{
    constructor(options={}){
      this.width=options.width||7200;this.height=options.height||4800;this.random=options.random||Math.random;
      this.onEat=options.onEat||(()=>{});this.onDeath=options.onDeath||(()=>{});this.onKill=options.onKill||(()=>{});
      this.cats=[];this.food=[];this.particles=[];this.time=0;this.state='lobby';this.nextId=0;this.botCount=6;this.player=null;this.respawns=[];this.speedFactor=1;this.botStartLength=16;this.lowQuality=false;
    }
    randomPoint(pad=65){return{x:pad+this.random()*(this.width-2*pad),y:pad+this.random()*(this.height-2*pad)}}
    makeCat({x,y,angle=0,skin='orange',name='小猫',player=false,length=16}){
      const c={id:this.nextId++,x,y,angle,targetAngle:angle,skin,name,player,alive:true,radius:12,segments:[],length,fish:0,kills:0,boost:100,sprinting:false,boostLocked:false,skillTime:0,skillCooldown:0,skillEffect:null,aiClock:0,aiTarget:null,grace:1.5,blink:this.random()*5};
      for(let i=0;i<length;i++)c.segments.push({x:x-Math.cos(angle)*i*7,y:y-Math.sin(angle)*i*7});
      this.cats.push(c);if(player)this.player=c;return c;
    }
    findSpawn(){
      for(let n=0;n<100;n++){const p=this.randomPoint(180);if(this.cats.every(c=>!c.alive||c.segments.every(s=>dist2(s,p)>200**2)))return p;}
      return this.randomPoint(180);
    }
    spawnBot(i=0){
      const p=this.findSpawn();
      const names=['鱼丸同学','芝麻糊','摸鱼队长','小年糕','布丁不加糖','彩虹屁屁'];
      return this.makeCat({...p,angle:Math.atan2(this.height/2-p.y,this.width/2-p.x),skin:SKINS[i%SKINS.length].id,name:names[i%6],length:this.botStartLength});
    }
    addFish(p,loot=false){this.food.push({x:p.x,y:p.y,phase:this.random()*TAU,rotation:this.random()*TAU,loot,value:1})}
    reset(skin='orange',name='小鱼收集家',lobby=false){
      this.cats=[];this.food=[];this.particles=[];this.time=0;this.respawns=[];this.nextId=0;this.state=lobby?'lobby':'playing';
      this.makeCat({x:this.width/2,y:this.height/2,angle:-.15,skin,name,player:true});
      for(let i=0;i<this.botCount;i++)this.spawnBot(i);
      for(let i=0;i<900;i++)this.addFish(this.randomPoint(35));
      // A welcoming fish trail, clear of the player's initial body.
      for(let i=0;i<9;i++)this.addFish({x:this.width/2+75+i*34,y:this.height/2-12-Math.sin(i*.4)*26});
      return this.player;
    }
    steerAI(c,dt){
      c.aiClock-=dt;if(c.aiClock>0)return;c.aiClock=.12+this.random()*.08;
      let best=null,bestD=Infinity;
      for(const f of this.food){const d=dist2(c,f);if(d<bestD){best=f;bestD=d}}
      let desired=best?Math.atan2(best.y-c.y,best.x-c.x):c.angle;
      let scoreBest=-Infinity,target=c.angle;
      const others=this.cats.filter(o=>o!==c&&o.alive&&o.grace<=0);
      for(let k=0;k<25;k++){
        const a=k===0?desired:c.angle+(k-12)*Math.PI/12;
        const turn=Math.abs(angleDiff(a,c.angle));
        let score=Math.cos(angleDiff(a,desired))*54-turn*8;
        for(const look of [36,76,125]){
          const p={x:c.x+Math.cos(a)*look,y:c.y+Math.sin(a)*look};
          const edge=Math.min(p.x,p.y,this.width-p.x,this.height-p.y);
          if(edge<22)score-=1700+(22-edge)*20;else if(edge<95)score-=(95-edge)*.65;
          for(const o of others){
            const headFuture={x:o.x+Math.cos(o.angle)*look*.55,y:o.y+Math.sin(o.angle)*look*.55};
            const hd=dist2(p,headFuture);if(hd<62**2)score-=(62-Math.sqrt(hd))*6;
            for(let j=0;j<o.segments.length;j+=3){const d=dist2(p,o.segments[j]);if(d<48**2)score-=(48-Math.sqrt(d))*9;}
          }
        }
        if(score>scoreBest){scoreBest=score;target=a}
      }
      c.targetAngle=target;c.sprinting=c.boost>30&&bestD>210**2&&scoreBest>35&&this.random()>.65;
    }
    activateSkill(c){const d=SKILLS[c.skin];if(!c.alive||c.skillCooldown>0||!d)return false;c.skillTime=d[1];c.skillCooldown=d[2];c.skillEffect=d[3];if(d[3].refill)c.boost=clamp(c.boost+d[3].refill,0,100);return true}
    moveCat(c,dt){
      c.skillTime=Math.max(0,c.skillTime-dt);c.skillCooldown=Math.max(0,c.skillCooldown-dt);if(c.skillTime<=0)c.skillEffect=null;
      c.grace=Math.max(0,c.grace-dt);
      c.angle+=clamp(angleDiff(c.targetAngle,c.angle),-3.9*(c.skillEffect?.turn||1)*dt,3.9*(c.skillEffect?.turn||1)*dt);
      if(c.boost<=0)c.boostLocked=true;
      if(c.boostLocked&&c.boost>=25)c.boostLocked=false;
      const fast=c.sprinting&&!c.boostLocked&&c.boost>0;
      c.boost=clamp(c.boost+(fast?-34:23)*dt,0,100);
      if(c.boost<=0)c.boostLocked=true;
      c.fast=fast;
      const speed=(fast?205:115)*this.speedFactor*(c.skillEffect?.speed||1);
      c.x+=Math.cos(c.angle)*speed*dt;c.y+=Math.sin(c.angle)*speed*dt;
      c.segments[0]={x:c.x,y:c.y};
      while(c.segments.length<c.length){const tail=c.segments[c.segments.length-1];c.segments.push({...tail})}
      for(let i=1;i<c.segments.length;i++){
        const p=c.segments[i],prev=c.segments[i-1],dx=prev.x-p.x,dy=prev.y-p.y,d=Math.hypot(dx,dy);
        if(d>7){p.x+=dx*(d-7)/d;p.y+=dy*(d-7)/d}
      }
    }
    collisionDeaths(){
      const deaths=new Map();const live=this.cats.filter(c=>c.alive);
      const bounds=new Map(live.map(o=>{let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of o.segments){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}return [o.id,{minX,maxX,minY,maxY}]}));
      for(const c of live){
        if(c.x-c.radius<=0||c.y-c.radius<=0||c.x+c.radius>=this.width||c.y+c.radius>=this.height){deaths.set(c.id,{cat:c,reason:'wall',killer:null});continue}
        if(c.grace>0)continue;
        for(const o of live){
          if(o===c||o.grace>0)continue;
          const b=bounds.get(o.id),margin=c.radius+o.radius;if(c.x<b.minX-margin||c.x>b.maxX+margin||c.y<b.minY-margin||c.y>b.maxY+margin)continue;
          for(let i=0;i<o.segments.length;i++){
            const collisionRadius=i===0?c.radius+o.radius: c.radius+o.radius*.77;
            if(dist2(c,o.segments[i])<collisionRadius**2){deaths.set(c.id,{cat:c,reason:i===0?'head':'cat',killer:o});break}
          }
          if(deaths.has(c.id))break;
        }
      }
      return Array.from(deaths.values());
    }
    killCat(c,reason,killer){
      if(!c.alive)return;c.alive=false;
      const dropStep=Math.max(3,Math.ceil(c.segments.length/80));
      for(let i=0;i<c.segments.length;i+=dropStep){const p=c.segments[i];this.addFish({x:clamp(p.x,18,this.width-18),y:clamp(p.y,18,this.height-18)},true)}
      for(let i=0;i<(this.lowQuality?4:12);i++)this.particles.push({x:c.x,y:c.y,vx:(this.random()-.5)*120,vy:(this.random()-.5)*120,life:.8,maxLife:.8,color:SKINS.find(s=>s.id===c.skin).body,size:3});
      if(killer&&killer!==c){killer.kills++;this.onKill(killer,c)}
      if(!c.player&&!c.human)this.respawns.push({at:this.time+3+this.random()*2,index:SKINS.findIndex(s=>s.id===c.skin)});
      this.onDeath(c,reason,killer);
    }
    eat(c){
      for(let i=this.food.length-1;i>=0;i--){
        const f=this.food[i];if(dist2(c,f)<(c.radius+8+(c.skillEffect?.magnet||0))**2){
          this.food.splice(i,1);c.fish+=f.value;c.length+=3*(c.skillEffect?.growth||1);
          for(let j=0;j<(this.lowQuality?1:4);j++)this.particles.push({x:f.x,y:f.y,vx:(this.random()-.5)*60,vy:(this.random()-.5)*60,life:.5,maxLife:.5,color:f.loot?'#deb174':'#85b6a4',size:2.5});
          this.onEat(c,f);
        }
      }
    }
    update(dt){
      if(this.state!=='playing')return;
      dt=Math.min(.025,Math.max(0,dt));this.time+=dt;
      for(const c of this.cats){if(!c.alive)continue;if(!c.player){this.steerAI(c,dt);if(c.skillCooldown<=0&&this.random()<.002)this.activateSkill(c)}this.moveCat(c,dt)}
      // Resolve all collisions from the same frame before removing a body.
      const deaths=this.collisionDeaths();
      for(const d of deaths)this.killCat(d.cat,d.reason,d.killer);
      for(const c of this.cats)if(c.alive)this.eat(c);
      if(this.player&&!this.player.alive)this.state='dead';
      for(let i=this.respawns.length-1;i>=0;i--)if(this.respawns[i].at<=this.time){this.spawnBot(this.respawns[i].index);this.respawns.splice(i,1)}
      // Remove inactive entries so long sessions do not retain old opponents.
      if(this.cats.length>25)this.cats=this.cats.filter(c=>c.alive||c.player);
      let added=0;while(this.food.length<900&&added++<3)this.addFish(this.randomPoint(30));
      for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
      this.particles=this.particles.filter(p=>p.life>0);
    }
  }
  return{Arena,SKINS,SKILLS,DEFAULT_PROFILE,cleanProfile,unlocked,nextSkin,rainbowHue,clamp,dist2,angleDiff};
});
