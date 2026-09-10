(function () {
  "use strict";

  const DEFAULT_ID = "neo-shibuya";
  const STORAGE_KEY = "starfall-environment";
  const TAU = Math.PI * 2;
  const T = Starfall.THEME;

  const metadata = [
    { id:"neo-shibuya", name:"NEO SHIBUYA", subtitle:"Anime City", description:"Sunset rooftops, electric signs and elevated transit." },
    { id:"neon-rift", name:"NEON RIFT", subtitle:"Cyberpunk Megacity", description:"Rain-soaked towers, holograms and dangerous neon." },
    { id:"outer-rim", name:"OUTER RIM", subtitle:"Galactic Frontier", description:"A lonely planetary horizon beneath an ancient orbit." },
    { id:"shogun-valley", name:"SHOGUN VALLEY", subtitle:"Land of the Ronin", description:"Moonlit temples, mountain mist and drifting sakura." },
  ].map((item) => Object.freeze(item));

  const byId = Object.freeze(Object.fromEntries(metadata.map((item) => [item.id, item])));
  Starfall.ENVIRONMENT_DEFAULT = DEFAULT_ID;
  Starfall.ENVIRONMENT_STORAGE_KEY = STORAGE_KEY;
  Starfall.ENVIRONMENTS = Object.freeze(metadata);
  Starfall.environments = byId;
  Starfall.environmentMetadata = byId;
  Starfall.resolveEnvironmentId = (id) => Object.prototype.hasOwnProperty.call(byId, id) ? id : DEFAULT_ID;

  function rngFor(text) {
    let seed = 2166136261;
    for (let i=0;i<text.length;i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619) >>> 0;
    return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  }

  function canvas(width,height,paint) {
    const layer=document.createElement("canvas");
    layer.width=Math.max(1,Math.ceil(width));layer.height=Math.max(1,Math.ceil(height));
    paint(layer.getContext("2d"),layer.width,layer.height);
    return layer;
  }

  function gradient(c,x0,y0,x1,y1,stops) {
    const value=c.createLinearGradient(x0,y0,x1,y1);
    stops.forEach(([at,color])=>value.addColorStop(at,color));
    return value;
  }

  function mountain(c,w,base,height,color,offset,steps) {
    c.beginPath();c.moveTo(0,base);
    for(let i=0;i<=steps;i++){
      const x=i*w/steps;
      const y=base-height*(.25+Math.abs(Math.sin(i*1.73+offset))*.42+(i===Math.floor(steps*.58)? .45:0));
      c.lineTo(x,y);
    }
    c.lineTo(w,base);c.closePath();c.fillStyle=color;c.fill();
  }

  class CachedEnvironment {
    constructor(width,height,id) { this.id=id;this.time=0;this.resize(width,height); }
    resize(width,height) {
      this.width=Math.max(1,width);this.height=Math.max(1,height);
      const random=rngFor(`${this.id}:${Math.round(this.width)}:${Math.round(this.height)}`);
      this.staticLayer=canvas(this.width,this.height,(c,w,h)=>this.paintStatic(c,w,h,random));
      this.readabilityLayer=canvas(this.width,this.height,(c,w,h)=>{
        const shade=c.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.08,w*.5,h*.5,Math.max(w,h)*.7);
        shade.addColorStop(0,"rgba(2,5,13,.02)");shade.addColorStop(.58,"rgba(2,5,13,.08)");shade.addColorStop(1,"rgba(1,3,9,.62)");
        c.fillStyle=shade;c.fillRect(0,0,w,h);
        c.fillStyle="rgba(2,6,15,.10)";c.fillRect(w*.19,0,w*.62,h);
      });
      this.makeAmbient(random);
    }
    makeAmbient() {}
    paintStatic(c,w,h) { c.fillStyle="#070b18";c.fillRect(0,0,w,h); }
    update(dt,speed) { if(!T.reducedMotion.matches)this.time+=dt*(speed||1); }
    draw(c) { c.save();c.drawImage(this.staticLayer,0,0);this.drawAmbient(c);c.drawImage(this.readabilityLayer,0,0);c.restore(); }
    drawAmbient() {}
    destroy() { if(this.staticLayer){this.staticLayer.width=1;this.staticLayer.height=1;}if(this.readabilityLayer){this.readabilityLayer.width=1;this.readabilityLayer.height=1;} }
  }

  class NeoShibuya extends CachedEnvironment {
    paintStatic(c,w,h,random) {
      c.fillStyle=gradient(c,0,0,0,h,[[0,"#19205a"],[.38,"#9a4774"],[.7,"#e67870"],[1,"#171629"]]);c.fillRect(0,0,w,h);
      const sun=c.createRadialGradient(w*.72,h*.2,2,w*.72,h*.2,Math.min(w,h)*.18);
      sun.addColorStop(0,"#fff2bd");sun.addColorStop(.28,"#ffad91aa");sun.addColorStop(1,"#e75a8000");c.fillStyle=sun;c.fillRect(0,0,w,h*.55);
      c.globalAlpha=.28;mountain(c,w,h*.58,h*.18,"#382950",1.2,13);c.globalAlpha=1;
      for(let depth=0;depth<3;depth++){
        const base=h*(.62+depth*.1),color=["#20223eaa","#17182e","#0b0e1c"][depth];
        for(let x=-20;x<w+30;){
          const bw=35+random()*90,bh=h*(.08+random()*(.17+depth*.06));
          c.fillStyle=color;c.fillRect(x,base-bh,bw,bh);
          if(depth>0){
            c.fillStyle=depth===2?"#fbc56c88":"#68dbe866";
            for(let yy=base-bh+12;yy<base-10;yy+=17)for(let xx=x+9;xx<x+bw-8;xx+=15)if(random()>.46)c.fillRect(xx,yy,4,6);
          }
          if(depth===2&&random()>.55){
            const sign=random()>.5?"#ff5aa9":"#5af2ee";c.shadowColor=sign;c.shadowBlur=8;c.fillStyle=sign;c.fillRect(x+bw*.14,base-bh+15,Math.min(42,bw*.65),16);c.shadowBlur=0;
            c.fillStyle="#08101d";for(let g=0;g<3;g++)c.fillRect(x+bw*.2+g*9,base-bh+19,4,8);
          }
          x+=bw+4;
        }
      }
      const railY=h*.49;c.strokeStyle="#12182a";c.lineWidth=11;c.beginPath();c.moveTo(0,railY);c.lineTo(w,railY-24);c.stroke();c.strokeStyle="#9aa5c344";c.lineWidth=2;c.stroke();
      for(let x=0;x<w;x+=90){c.fillStyle="#12182a";c.fillRect(x,railY-2,8,h*.12);}
      // Graphic rooftop and manga accents remain confined to the margins.
      c.strokeStyle="#ffe0c922";c.lineWidth=1;
      for(let i=0;i<8;i++){c.beginPath();c.moveTo(w*.5,h*.1);c.lineTo(i<4?0:w,h*(.04+i*.12));c.stroke();}
      for(const side of [0,1]){c.save();if(side){c.translate(w,0);c.scale(-1,1);}c.fillStyle="#080c17";c.fillRect(0,h*.78,w*.15,h*.22);T.poly(c,[[0,h*.78],[w*.08,h*.7],[w*.17,h*.78]],"#080c17");c.restore();}
    }
    makeAmbient(random) { this.traffic=Array.from({length:5},(_,i)=>({x:random()*this.width,y:this.height*(.47-i*.008),speed:32+random()*48,color:i%2?"#ff66bc":"#79f7ff"})); }
    drawAmbient(c) {
      const w=this.width,h=this.height,t=this.time,still=T.reducedMotion.matches;
      for(const car of this.traffic){const x=still?car.x:(car.x+t*car.speed)%(w+90)-45;c.globalAlpha=.7;c.fillStyle=car.color;c.fillRect(x,car.y,36,3);c.globalAlpha=.16;c.fillRect(x-16,car.y,68,3);}
      if(!still){c.strokeStyle="#fff2df18";c.lineWidth=1;for(let i=0;i<7;i++){const y=(i*137+t*95)%(h+100)-50;c.beginPath();c.moveTo(w*.22,y);c.lineTo(w*.14,y+55);c.stroke();c.beginPath();c.moveTo(w*.78,y);c.lineTo(w*.86,y+55);c.stroke();}}
      c.globalAlpha=1;
    }
  }

  class NeonRift extends CachedEnvironment {
    paintStatic(c,w,h,random) {
      c.fillStyle=gradient(c,0,0,0,h,[[0,"#030617"],[.5,"#090d25"],[1,"#02040c"]]);c.fillRect(0,0,w,h);
      const glow=c.createRadialGradient(w*.5,h*.43,10,w*.5,h*.43,w*.5);glow.addColorStop(0,"#49318144");glow.addColorStop(.55,"#082a4430");glow.addColorStop(1,"#0000");c.fillStyle=glow;c.fillRect(0,0,w,h);
      for(let depth=0;depth<3;depth++){
        const base=h*(.72+depth*.09);let x=-10;
        while(x<w+20){const bw=24+random()*70,bh=h*(.14+random()*(.33+depth*.08));
          c.fillStyle=["#10132c88","#0b1326","#070c18"][depth];c.fillRect(x,base-bh,bw,bh);
          c.strokeStyle=depth===2?(random()>.5?"#dc3cff66":"#25e9ff66"):"#41527b33";c.strokeRect(x+.5,base-bh+.5,bw-1,bh-1);
          c.fillStyle=random()>.5?"#1be7f466":"#df45ff55";for(let yy=base-bh+11;yy<base-8;yy+=12)if(random()>.35)c.fillRect(x+5,yy,bw-10,1);
          if(depth===1&&random()>.66){c.globalAlpha=.22;c.fillStyle=random()>.5?"#20f1ff":"#fe46dd";c.fillRect(x-bw*.15,base-bh+22,bw*1.3,32);c.globalAlpha=1;}
          x+=bw+3;
        }
      }
      c.fillStyle="#02050dcc";c.fillRect(0,h*.84,w,h*.16);
      c.globalAlpha=.3;c.strokeStyle="#59eaff";for(let x=0;x<w;x+=80){c.beginPath();c.moveTo(x,h);c.lineTo(w*.5+(x-w*.5)*.35,h*.66);c.stroke();}c.globalAlpha=1;
    }
    makeAmbient(random) {
      this.rain=Array.from({length:Math.min(90,Math.floor(this.width/12))},()=>({x:random()*this.width,y:random()*this.height,length:8+random()*20,speed:270+random()*210}));
      this.drones=Array.from({length:6},()=>({x:random()*this.width,y:this.height*(.12+random()*.38),speed:12+random()*27,phase:random()*TAU}));
    }
    drawAmbient(c) {
      const w=this.width,h=this.height,t=this.time,still=T.reducedMotion.matches;
      c.strokeStyle="#76d9f23b";c.lineWidth=1;
      for(const drop of this.rain){const y=still?drop.y:(drop.y+t*drop.speed)%h;c.beginPath();c.moveTo(drop.x,y);c.lineTo(drop.x-4,y+drop.length);c.stroke();}
      for(const drone of this.drones){const x=still?drone.x:(drone.x+t*drone.speed)%(w+60)-30,y=drone.y+(still?0:Math.sin(t+drone.phase)*5);c.fillStyle="#07101d";c.fillRect(x-8,y-2,16,4);c.fillStyle="#ff55da";c.fillRect(x-10,y,3,2);c.fillStyle="#50f4ff";c.fillRect(x+7,y,3,2);}
      if(!still){const scan=(t*43)%h;c.fillStyle="#43eaff0b";c.fillRect(0,scan,w,3);if(Math.floor(t*2)%9===0){c.fillStyle="#ff4bd80b";c.fillRect(w*.08,h*.31,w*.84,2);}}
    }
  }

  class OuterRim extends CachedEnvironment {
    constructor(w,h,id) { super(w,h,id);this.orbitalStructures=new Starfall.OrbitalPort(w,h); }
    resize(w,h) { super.resize(w,h);if(this.orbitalStructures)this.orbitalStructures.resize(w,h); }
    paintStatic(c,w,h,random) {
      c.fillStyle=gradient(c,0,0,0,h,[[0,"#020510"],[.58,"#0b1025"],[1,"#17132a"]]);c.fillRect(0,0,w,h);
      const nebula=c.createRadialGradient(w*.22,h*.35,5,w*.22,h*.35,w*.55);nebula.addColorStop(0,"#9b477a38");nebula.addColorStop(.42,"#413d8030");nebula.addColorStop(1,"#0000");c.fillStyle=nebula;c.fillRect(0,0,w,h);
      for(let i=0;i<180;i++){c.globalAlpha=.2+random()*.75;c.fillStyle=random()>.82?"#8deaff":"#fff5e2";const s=random()>.94?2:1;c.fillRect(random()*w,random()*h,s,s);}
      c.globalAlpha=1;
      const px=w*.76,py=h*.27,pr=Math.min(w,h)*.28,planet=c.createRadialGradient(px-pr*.35,py-pr*.4,3,px,py,pr);
      planet.addColorStop(0,"#e2b58a");planet.addColorStop(.42,"#9b6272");planet.addColorStop(.75,"#3d365b");planet.addColorStop(1,"#090d1d");c.fillStyle=planet;c.beginPath();c.arc(px,py,pr,0,TAU);c.fill();
      c.save();c.translate(px,py);c.rotate(-.22);c.strokeStyle="#dcb58255";c.lineWidth=Math.max(3,pr*.06);c.beginPath();c.ellipse(0,0,pr*1.55,pr*.31,0,0,TAU);c.stroke();c.restore();
      const horizon=h*.76,atmos=c.createLinearGradient(0,horizon-60,0,horizon+30);atmos.addColorStop(0,"#513c7800");atmos.addColorStop(.55,"#cd6d8a55");atmos.addColorStop(1,"#151328");c.fillStyle=atmos;c.fillRect(0,horizon-60,w,h-horizon+60);
      c.fillStyle="#080b16";c.beginPath();c.ellipse(w*.5,h*1.28,w*.82,h*.58,0,Math.PI,TAU);c.fill();
      // Original orbital wreckage silhouette.
      c.save();c.translate(w*.12,h*.36);c.rotate(.18);c.strokeStyle="#526278";c.lineWidth=5;c.strokeRect(-55,-11,110,22);c.fillStyle="#111828";c.fillRect(-28,-25,56,50);for(let i=-2;i<=2;i++){c.strokeStyle="#805b74";c.lineWidth=2;c.beginPath();c.moveTo(i*16,-25);c.lineTo(i*25,-52);c.stroke();}c.restore();
      for(let i=0;i<18;i++){const x=random()*w,y=h*(.08+random()*.62),r=2+random()*9;c.fillStyle="#342f3d";c.beginPath();c.moveTo(x-r,y);c.lineTo(x+r*.8,y-r*.6);c.lineTo(x+r,y+r*.7);c.lineTo(x-r*.5,y+r);c.closePath();c.fill();}
    }
    makeAmbient(random) { this.craft=Array.from({length:4},(_,i)=>({x:random()*this.width,y:this.height*(.16+random()*.42),speed:7+i*4,phase:random()*TAU})); }
    drawAmbient(c) {
      const w=this.width,h=this.height,t=this.time,still=T.reducedMotion.matches;
      // Reuse the original renderer's cached dock silhouettes as faint orbital wreckage.
      if(this.orbitalStructures){
        const edge=this.orbitalStructures.edge;
        this.orbitalStructures.layers.forEach((pair,depth)=>{
          const offset=(t*[5,11,19][depth])%1200;c.globalAlpha=[.05,.09,.14][depth];
          pair.forEach((tile,side)=>{for(let y=offset-1200;y<h;y+=1200)c.drawImage(tile,side?w-edge:0,y);});
        });
        c.globalAlpha=1;
      }
      for(const ship of this.craft){const x=still?ship.x:(ship.x+t*ship.speed)%(w+80)-40,y=ship.y+(still?0:Math.sin(t*.35+ship.phase)*2);c.fillStyle="#77849c66";T.poly(c,[[x-7,y],[x+5,y-2],[x+11,y],[x+5,y+2]],"#77849c66");c.fillStyle="#e28c7077";c.fillRect(x-10,y-1,3,2);}
    }
    destroy() { super.destroy();this.orbitalStructures=null; }
  }

  class ShogunValley extends CachedEnvironment {
    paintStatic(c,w,h,random) {
      c.fillStyle=gradient(c,0,0,0,h,[[0,"#151b38"],[.42,"#5a536a"],[.72,"#ad756f"],[1,"#182126"]]);c.fillRect(0,0,w,h);
      const mx=w*.74,my=h*.2,mr=Math.min(w,h)*.105,moon=c.createRadialGradient(mx-mr*.3,my-mr*.3,2,mx,my,mr);moon.addColorStop(0,"#fff9da");moon.addColorStop(.78,"#e7d5bc");moon.addColorStop(1,"#c79b9755");c.fillStyle=moon;c.beginPath();c.arc(mx,my,mr,0,TAU);c.fill();
      c.globalAlpha=.32;mountain(c,w,h*.67,h*.25,"#454359",.7,14);c.globalAlpha=.62;mountain(c,w,h*.74,h*.22,"#293544",2.2,16);c.globalAlpha=1;
      // Fuji-inspired central cone with a small snow cap.
      T.poly(c,[[w*.2,h*.69],[w*.49,h*.29],[w*.76,h*.69]],"#313a4b");T.poly(c,[[w*.43,h*.39],[w*.49,h*.29],[w*.56,h*.39],[w*.52,h*.38],[w*.49,h*.42],[w*.46,h*.37]],"#d7d3c7aa");
      c.fillStyle="#111c20";c.fillRect(0,h*.76,w,h*.24);
      // Pagoda silhouette.
      const px=w*.18,base=h*.79;c.fillStyle="#101518";c.fillRect(px-16,base-112,32,112);for(let i=0;i<4;i++){const y=base-26-i*27;T.poly(c,[[px-55+i*5,y],[px,y-13],[px+55-i*5,y],[px+41-i*3,y+7],[px-41+i*3,y+7]],"#101518");}c.fillRect(px-2,base-142,4,18);
      // Torii and bamboo frame the battlefield rather than crossing it.
      const tx=w*.82,ty=h*.77;c.fillStyle="#361b24";c.fillRect(tx-42,ty-80,8,80);c.fillRect(tx+34,ty-80,8,80);c.fillRect(tx-56,ty-84,112,9);c.fillRect(tx-48,ty-68,96,6);
      for(const side of [0,1]){c.save();if(side){c.translate(w,0);c.scale(-1,1);}c.strokeStyle="#101e1b";c.lineWidth=7;for(let i=0;i<5;i++){const x=8+i*14;c.beginPath();c.moveTo(x,h);c.lineTo(x+10,h*.62-random()*50);c.stroke();}c.restore();}
    }
    makeAmbient(random) { this.petals=Array.from({length:34},(_,i)=>({x:random()*this.width,y:random()*this.height,size:2+random()*4,speed:9+random()*18,drift:8+random()*16,phase:i+random()*TAU})); }
    drawAmbient(c) {
      const w=this.width,h=this.height,t=this.time,still=T.reducedMotion.matches;
      if(!still){c.globalAlpha=.08;c.fillStyle="#d9e6df";for(let i=0;i<3;i++){const x=((t*(6+i*2)+i*w*.38)%(w*1.4))-w*.2;c.beginPath();c.ellipse(x,h*(.61+i*.08),w*.28,24+i*9,0,0,TAU);c.fill();}}
      c.globalAlpha=.7;c.fillStyle="#f3a9b7";
      for(const petal of this.petals){const y=still?petal.y:(petal.y+t*petal.speed)%h,x=still?petal.x:(petal.x+Math.sin(t*.8+petal.phase)*petal.drift+t*3)%w;c.save();c.translate(x,y);c.rotate(still?0:t+petal.phase);c.beginPath();c.ellipse(0,0,petal.size,petal.size*.48,.5,0,TAU);c.fill();c.restore();}
      c.globalAlpha=1;
    }
  }

  const factories=Object.freeze({
    "neo-shibuya":(w,h)=>new NeoShibuya(w,h,"neo-shibuya"),
    "neon-rift":(w,h)=>new NeonRift(w,h,"neon-rift"),
    "outer-rim":(w,h)=>new OuterRim(w,h,"outer-rim"),
    "shogun-valley":(w,h)=>new ShogunValley(w,h,"shogun-valley"),
  });

  class EnvironmentManager {
    constructor(width,height,options) {
      this.width=width;this.height=height;this.persist=!(options&&options.persist===false);
      let saved=DEFAULT_ID;
      if(options&&options.id)saved=options.id;
      else { try { saved=localStorage.getItem(STORAGE_KEY)||DEFAULT_ID; } catch (_) {} }
      this.setEnvironment(saved,{ persist:false });
    }
    setEnvironment(id,options) {
      const resolved=Starfall.resolveEnvironmentId(id);
      const shouldPersist=this.persist&&(!options||options.persist!==false);
      if(this.active&&this.id===resolved){
        if(shouldPersist){try{localStorage.setItem(STORAGE_KEY,resolved);}catch(_){}}
        return resolved;
      }
      if(this.active)this.active.destroy();
      this.id=resolved;this.active=factories[resolved](this.width,this.height);
      if(shouldPersist){try{localStorage.setItem(STORAGE_KEY,resolved);}catch(_){}}
      return resolved;
    }
    resize(width,height) { this.width=width;this.height=height;if(this.active)this.active.resize(width,height); }
    update(dt,speed) { if(this.active)this.active.update(dt,speed); }
    draw(ctx) { if(this.active)this.active.draw(ctx); }
    destroy() { if(this.active)this.active.destroy();this.active=null; }
  }

  Starfall.EnvironmentManager=EnvironmentManager;
  Starfall.environmentRenderers=Object.freeze({ NeoShibuya, NeonRift, OuterRim, ShogunValley });
})();
