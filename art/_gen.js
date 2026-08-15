// Property Flipper — isometric house generator. Grid: x = 0.7071(gx+gy), y = 0.3748(gy-gx) - z
const S=25.456, K=0.7071*S, J=0.3748*S;
const P=(x,y,z)=>[K*(x+y), J*(y-x)-z];
const f=n=>Math.round(n*100)/100;
const mk=()=>({heavy:[],light:[]});
const poly=(o,w,pts)=>(w===2?o.heavy:o.light).push({closed:true,pts});
const line=(o,w,pts)=>(w===2?o.heavy:o.light).push({closed:false,pts});
function render(o,tx,ty){
  const seg=s=>s.pts.map((p,i)=>(i?'L':'M')+f(p[0]+tx)+' '+f(p[1]+ty)).join(' ')+(s.closed?' Z':'');
  const grp=(a,w)=>a.length?`<g fill="none" stroke="#000000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">`+a.map(s=>`<path d="${seg(s)}"/>`).join('')+`</g>`:'';
  return grp(o.light,1)+grp(o.heavy,2);
}
const svg=b=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${b}</svg>`;
const PL=(s,u,v)=>P(s.x0,s.y0+u*(s.y1-s.y0),v);
const PR=(s,u,v)=>P(s.x0+u*(s.x1-s.x0),s.y1,v);
const topZ=s=>s.h+(s.roofH||s.parapet||0);
const eaveZ=s=>s.h;

function contour(o,s,hL0,hL1,hR){
  const {x0,y0,x1,y1}=s;
  line(o,2,[P(x0,y0,0),P(x0,y1,0),P(x1,y1,0)]);
  line(o,2,[P(x0,y0,0),P(x0,y0,hL0)]);
  line(o,2,[P(x0,y1,0),P(x0,y1,hL1)]);
  line(o,2,[P(x1,y1,0),P(x1,y1,hR)]);
}
function walls(o,s){
  const {x0,y0,x1,y1,h}=s, xm=(x0+x1)/2;
  poly(o,1,[P(x0,y0,0),P(x0,y1,0),P(x0,y1,h),P(x0,y0,h)]);
  if(s.gable) poly(o,1,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h),P(xm,y1,h+s.roofH),P(x0,y1,h)]);
  else if(s.mono) poly(o,1,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h+s.roofH),P(x0,y1,h)]);
  else poly(o,1,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h),P(x0,y1,h)]);
  contour(o,s,h,h,s.mono?h+s.roofH:h);
}
function gableRoof(o,s,w){
  w=w||2;
  const oa=s.ov??0.05, o0=s.ovy0??oa, o1=s.ovy1??oa;
  const {x0,y0,x1,y1,h}=s, xm=(x0+x1)/2, zr=h+s.roofH;
  const a0=x0-oa,a1=x1+oa,b0=y0-o0,b1=y1+o1;
  poly(o,w,[P(a0,b0,h),P(a0,b1,h),P(xm,b1,zr),P(xm,b0,zr)]);
  poly(o,w,[P(xm,b0,zr),P(xm,b1,zr),P(a1,b1,h),P(a1,b0,h)]);
}
function hipRoof(o,s){
  const ov=s.ov??0.05,{x0,y0,x1,y1,h}=s,xm=(x0+x1)/2,zr=h+s.roofH;
  const a0=x0-ov,a1=x1+ov,b0=y0-ov,b1=y1+ov,d=(b1-b0)*0.24;
  poly(o,2,[P(a0,b0,h),P(a0,b1,h),P(xm,b1-d,zr),P(xm,b0+d,zr)]);
  poly(o,2,[P(xm,b0+d,zr),P(xm,b1-d,zr),P(a1,b1,h),P(a1,b0,h)]);
  poly(o,2,[P(a0,b1,h),P(a1,b1,h),P(xm,b1-d,zr)]);
}
function flatRoof(o,s){
  const ov=s.ov??0.035,{x0,y0,x1,y1,h}=s,pz=h+(s.parapet??4);
  const a0=x0-ov,a1=x1+ov,b0=y0-ov,b1=y1+ov;
  poly(o,2,[P(a0,b0,pz),P(a1,b0,pz),P(a1,b1,pz),P(a0,b1,pz)]);
  line(o,2,[P(a0,b1,h),P(a0,b1,pz)]);line(o,2,[P(a1,b1,h),P(a1,b1,pz)]);
  line(o,1,[P(a0,b0,h),P(a0,b1,h),P(a1,b1,h)]);
}
function monoRoof(o,s){
  const ov=s.ov??0.05,{x0,y0,x1,y1,h}=s;
  const a0=x0-ov,a1=x1+ov,b0=y0-ov,b1=y1+ov;
  poly(o,2,[P(a0,b0,h),P(a0,b1,h),P(a1,b1,h+s.roofH),P(a1,b0,h+s.roofH)]);
}
function opening(o,s,w,wt){
  const F=w.face==='L'?PL:PR;
  poly(o,wt||1,[F(s,w.u,w.v),F(s,w.u+w.w,w.v),F(s,w.u+w.w,w.v+w.h),F(s,w.u,w.v+w.h)]);
}
function box(o,x0,y0,x1,y1,z0,z1,w){
  w=w||1;
  poly(o,w,[P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)]);
  poly(o,w,[P(x0,y0,z0),P(x0,y1,z0),P(x0,y1,z1),P(x0,y0,z1)]);
  poly(o,w,[P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)]);
}
const win=(face,u,v,w,h)=>({face,u,v,w,h});

const A={
 bungalow:(()=>{const s={x0:0.34,x1:0.96,y0:0.06,y1:0.94,h:12,roofH:10,gable:true,ov:0.07};
  s.windows=[win('L',0.06,4,0.16,6),win('L',0.78,4,0.16,6),win('R',0.16,4,0.24,6)];
  s.doors=[win('L',0.42,0,0.13,9)];
  s.porch=[0.26,0.70];
  s.draw=o=>{const z=11;
   poly(o,1,[P(s.x0-0.18,0.26,z),P(s.x0-0.18,0.70,z),P(s.x0,0.70,z+1.6),P(s.x0,0.26,z+1.6)]);
   line(o,1,[P(s.x0-0.17,0.28,z),P(s.x0-0.17,0.28,0)]);
   line(o,1,[P(s.x0-0.17,0.68,z),P(s.x0-0.17,0.68,0)]);
   line(o,1,[P(s.x0-0.17,0.28,0),P(s.x0-0.17,0.68,0)]);};
  return s;})(),

 ranch:(()=>{const s={x0:0.58,x1:0.96,y0:-0.02,y1:1.02,h:10,roofH:5.5,hip:true,ov:0.07};
  s.windows=[win('L',0.05,3.5,0.13,5.5),win('L',0.26,3.5,0.13,5.5),win('L',0.62,3.5,0.13,5.5),win('L',0.82,3.5,0.13,5.5),win('R',0.24,3.5,0.34,5.5)];
  s.doors=[win('L',0.44,0,0.11,8)];
  return s;})(),

 duplex:(()=>{const s={x0:0.40,x1:0.94,y0:0.10,y1:0.90,h:25,roofH:7,gable:true,ov:0.05};
  s.windows=[win('L',0.08,15,0.14,6.5),win('L',0.34,15,0.14,6.5),win('L',0.58,15,0.14,6.5),win('L',0.84,15,0.14,6.5),
             win('L',0.08,3,0.14,6.5),win('L',0.84,3,0.14,6.5),win('R',0.22,3,0.26,6.5),win('R',0.22,15,0.26,6.5)];
  s.doors=[win('L',0.36,0,0.12,10),win('L',0.56,0,0.12,10)];
  s.draw=o=>{line(o,1,[PL(s,0.50,0),PL(s,0.50,s.h)]);line(o,1,[PL(s,0,12.5),PL(s,1,12.5)]);};
  return s;})(),

 mill_loft:(()=>{const s={x0:0.24,x1:0.96,y0:0.04,y1:0.96,h:38,parapet:4,flat:true,ov:0.035};
  s.windows=[];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)s.windows.push(win('L',0.09+c*0.31,6+r*11,0.22,7.5));
  for(let r=0;r<3;r++)for(let c=0;c<2;c++)s.windows.push(win('R',0.16+c*0.38,6+r*11,0.28,7.5));
  s.doors=[];
  s.draw=o=>{
   poly(o,1,[PL(s,0.41,0),PL(s,0.61,0),PL(s,0.61,10),PL(s,0.41,10)]);
   line(o,1,[PL(s,0.51,0),PL(s,0.51,10)]);
   for(let r=0;r<3;r++)line(o,1,[PL(s,0,3.5+r*11),PL(s,1,3.5+r*11)]);
   line(o,1,[P(s.x0,0.51,36),P(s.x0-0.15,0.51,36),P(s.x0-0.15,0.51,31)]);};
  return s;})(),

 victorian:(()=>{const s={x0:0.40,x1:0.94,y0:0.10,y1:0.90,h:24,roofH:22,gable:true,ov:0.05};
  s.windows=[win('L',0.07,14,0.13,7.5),win('L',0.28,14,0.13,7.5),win('L',0.64,14,0.13,7.5),win('L',0.85,14,0.13,7.5),
             win('L',0.64,3,0.13,7.5),win('L',0.85,3,0.13,7.5),win('R',0.62,14,0.20,7.5),win('R',0.62,3,0.20,7.5)];
  s.doors=[win('L',0.46,0,0.12,10)];
  s.draw=o=>{const xm=(s.x0+s.x1)/2,zr=s.h+s.roofH;
   line(o,1,[P(xm,s.y1+0.05,zr),P(xm,s.y1+0.05,zr+6)]);
   line(o,1,[P(xm-0.06,s.y1+0.05,zr+3.5),P(xm+0.06,s.y1+0.05,zr+3.5)]);
   const b0=0.08,b1=0.30;                       // bay window on the front facade
   poly(o,1,[P(s.x0,b0,0),P(s.x0-0.12,b0,0),P(s.x0-0.12,b1,0),P(s.x0,b1,0)]);
   line(o,1,[P(s.x0-0.12,b0,0),P(s.x0-0.12,b0,12)]);
   line(o,1,[P(s.x0-0.12,b1,0),P(s.x0-0.12,b1,12)]);
   poly(o,1,[P(s.x0,b0,12),P(s.x0-0.12,b0,12),P(s.x0-0.12,b1,12),P(s.x0,b1,12)]);
   poly(o,1,[P(s.x0-0.12,b0+0.03,3.5),P(s.x0-0.12,b1-0.03,3.5),P(s.x0-0.12,b1-0.03,10),P(s.x0-0.12,b0+0.03,10)]);
   [0.22,0.5,0.78].forEach(u=>line(o,1,[PL(s,u,s.h-3),PL(s,u,s.h)]));
   line(o,1,[PL(s,0,12.5),PL(s,1,12.5)]);};
  return s;})(),

 split_level:(()=>{const s={x0:0.46,x1:0.94,y0:0.06,y1:0.94,h:22,roofH:8,gable:true,ov:0.05,split:true,
   wx0:0.10,wy0:0.30,wh:10,wr:6};
  s.windows=[win('L',0.06,13.5,0.14,6),win('L',0.28,13.5,0.14,6),win('L',0.55,13.5,0.14,6),win('L',0.82,13.5,0.14,6),
             win('L',0.06,3,0.14,6),win('R',0.24,3,0.26,6),win('R',0.24,13.5,0.26,6)];
  s.doors=[];
  return s;})(),
 new_build:(()=>{const s={x0:0.36,x1:0.94,y0:0.08,y1:0.92,h:13,roofH:18,mono:true,ov:0.055};
  s.windows=[win('L',0.05,3.5,0.30,8.5),win('L',0.42,3.5,0.13,8.5),win('R',0.14,4,0.30,8),win('R',0.58,4,0.26,20)];
  s.doors=[win('L',0.70,0,0.12,9)];
  s.draw=o=>{line(o,1,[PL(s,0.05,7.75),PL(s,0.35,7.75)]);
   line(o,1,[PR(s,0.58,12),PR(s,0.84,12)]);
   line(o,1,[PR(s,0.71,4),PR(s,0.71,24)]);};
  return s;})(),

 colonial:(()=>{const s={x0:0.36,x1:0.96,y0:0.06,y1:0.94,h:20,roofH:8,gable:true,ov:0.06};
  s.windows=[win('L',0.09,12,0.13,6),win('L',0.44,12,0.13,6),win('L',0.78,12,0.13,6),
             win('L',0.09,2.5,0.13,6),win('L',0.78,2.5,0.13,6),
             win('R',0.20,12,0.18,6),win('R',0.62,12,0.18,6),win('R',0.20,2.5,0.18,6)];
  s.doors=[win('L',0.44,0,0.13,8.5)];
  s.draw=o=>{
   line(o,1,[PL(s,0,10.5),PL(s,1,10.5)]); line(o,1,[PR(s,0,10.5),PR(s,1,10.5)]);
   s.windows.filter(w=>w.face==='L').forEach(w=>{
     poly(o,1,[PL(s,w.u-0.035,w.v),PL(s,w.u-0.008,w.v),PL(s,w.u-0.008,w.v+w.h),PL(s,w.u-0.035,w.v+w.h)]);
     poly(o,1,[PL(s,w.u+w.w+0.008,w.v),PL(s,w.u+w.w+0.035,w.v),PL(s,w.u+w.w+0.035,w.v+w.h),PL(s,w.u+w.w+0.008,w.v+w.h)]);});
   const d=s.doors[0];
   line(o,1,[PL(s,d.u-0.03,d.v+d.h+0.9),PL(s,d.u+d.w+0.03,d.v+d.h+0.9)]);
   box(o,0.60,0.14,0.70,0.24,20,26,1);};
  return s;})(),

 condo:(()=>{const s={x0:0.30,x1:0.98,y0:0.00,y1:1.00,h:26,parapet:3,flat:true,ov:0.02};
  s.windows=[];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)s.windows.push(win('L',0.08+c*0.31,3.5+r*8,0.17,5));
  for(let r=0;r<3;r++)s.windows.push(win('R',0.28,3.5+r*8,0.30,5));
  s.doors=[win('L',0.08,0,0.10,0.1)];
  s.draw=o=>{
   for(let r=1;r<3;r++) line(o,1,[PL(s,0,2+r*8),PL(s,1,2+r*8)]);
   [0.39,0.70].forEach(u=>line(o,1,[PL(s,u,0),PL(s,u,s.h)]));
   poly(o,2,[PL(s,0.02,0),PL(s,0.37,0),PL(s,0.37,10),PL(s,0.02,10)]);
   poly(o,1,[P(s.x0-0.10,0.04,10),P(s.x0-0.10,0.32,10),P(s.x0,0.32,10),P(s.x0,0.04,10)]);
   poly(o,1,[P(s.x0-0.10,0.04,10),P(s.x0-0.10,0.32,10),P(s.x0-0.10,0.32,14),P(s.x0-0.10,0.04,14)]);
   for(let t=0.16;t<1;t+=0.22) line(o,1,[P(s.x0-0.10,0.04+t*0.28,10),P(s.x0-0.10,0.04+t*0.28,14)]);
   poly(o,1,[PL(s,0.06,0),PL(s,0.16,0),PL(s,0.16,7),PL(s,0.06,7)]);};
  return s;})(),

 townhouse:(()=>{const s={x0:0.40,x1:0.94,y0:0.26,y1:0.74,h:26,roofH:5,gable:true,ov:0.04};
  s.windows=[win('L',0.10,18,0.34,6),win('L',0.56,18,0.34,6),
             win('L',0.10,9,0.34,6),win('L',0.56,9,0.34,6),
             win('R',0.26,18,0.30,6),win('R',0.26,9,0.30,6)];
  s.doors=[win('L',0.76,0,0.16,7.5)];
  s.draw=o=>{
   poly(o,1,[PL(s,0.10,0),PL(s,0.66,0),PL(s,0.66,7),PL(s,0.10,7)]);
   for(let t2=0.16;t2<1;t2+=0.20) line(o,1,[PL(s,0.10+t2*0.56,0.7),PL(s,0.10+t2*0.56,6.4)]);
   [8,17].forEach(z=>{line(o,1,[PL(s,0,z),PL(s,1,z)]);line(o,1,[PR(s,0,z),PR(s,1,z)]);});
   [[0.00,0.26,7],[0.74,1.00,11]].forEach(([na,nbb,drop])=>{
     const nh=s.h-drop;
     poly(o,1,[P(s.x0,na,0),P(s.x0,nbb,0),P(s.x0,nbb,nh),P(s.x0,na,nh)]);
     poly(o,1,[P(s.x0,na,nh),P(s.x0,nbb,nh),P(s.x0-0.05,nbb,nh+1.4),P(s.x0-0.05,na,nh+1.4)]);
     poly(o,1,[P(s.x0,na+0.05,11),P(s.x0,nbb-0.05,11),P(s.x0,nbb-0.05,16),P(s.x0,na+0.05,16)]);
   });
   line(o,2,[P(s.x0,0.02,0),P(s.x0,0.98,0)]);
   line(o,2,[P(s.x0,s.y0,0),P(s.x0,s.y0,s.h)]);
   line(o,2,[P(s.x0,s.y1,0),P(s.x0,s.y1,s.h)]);};
  return s;})(),
};

function drawSplit(o,s){
  const {x0,x1,y0,y1,h,roofH,ov,wx0,wy0,wh,wr}=s, xm=(x0+x1)/2, wz=wh+wr;
  // main block, left wall notched where the wing lean-to meets it
  poly(o,1,[P(x0,y0,0),P(x0,wy0,0),P(x0,wy0,wz),P(x0,y1,wz),P(x0,y1,0)]);
  line(o,1,[P(x0,y1,0),P(x0,y1,h)]);
  line(o,1,[P(x0,y0,0),P(x0,y0,h)]);
  line(o,1,[P(x0,y0,h),P(x0,y1,h)]);
  poly(o,1,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h),P(xm,y1,h+roofH),P(x0,y1,h)]);
  gableRoof(o,{x0,x1,y0,y1,h,roofH,ov});
  line(o,2,[P(x0,y0,0),P(x0,wy0,0)]);
  line(o,2,[P(x0,y1,0),P(x1,y1,0)]);
  line(o,2,[P(x0,y0,0),P(x0,y0,h)]);
  line(o,2,[P(x0,y1,0),P(x0,y1,h)]);
  line(o,2,[P(x1,y1,0),P(x1,y1,h)]);
  // lean-to wing in front, its roofline stepped well below the main eaves
  poly(o,1,[P(wx0,wy0,0),P(wx0,y1,0),P(wx0,y1,wh),P(wx0,wy0,wh)]);
  poly(o,1,[P(wx0,y1,0),P(x0,y1,0),P(x0,y1,wz),P(wx0,y1,wh)]);
  poly(o,2,[P(wx0-0.05,wy0-0.05,wh),P(wx0-0.05,y1+0.05,wh),P(x0,y1+0.05,wz),P(x0,wy0-0.05,wz)]);
  line(o,2,[P(wx0,wy0,0),P(wx0,y1,0),P(x0,y1,0)]);
  line(o,2,[P(wx0,wy0,0),P(wx0,wy0,wh)]);
  line(o,2,[P(wx0,y1,0),P(wx0,y1,wh)]);
  poly(o,1,[P(wx0,0.40,3),P(wx0,0.58,3),P(wx0,0.58,8),P(wx0,0.40,8)]);
  poly(o,1,[P(wx0,0.70,0),P(wx0,0.84,0),P(wx0,0.84,8.5),P(wx0,0.70,8.5)]);
  poly(o,1,[P(wx0+0.10,y1,3),P(wx0+0.24,y1,3),P(wx0+0.24,y1,8.5),P(wx0+0.10,y1,8.5)]);
}
function drawBase(id){
  const s=A[id],o=mk();
  if(s.split) drawSplit(o,s);
  else{ walls(o,s);
    if(s.gable)gableRoof(o,s); else if(s.hip)hipRoof(o,s); else if(s.flat)flatRoof(o,s); else if(s.mono)monoRoof(o,s); }
  (s.windows||[]).forEach(w=>opening(o,s,w,1));
  (s.doors||[]).forEach(w=>{opening(o,s,w,1);
    const F=w.face==='L'?PL:PR; const p=F(s,w.u+w.w*0.82,w.v+w.h*0.45);
    line(o,1,[p,[p[0],p[1]-1.4]]);});
  if(s.draw)s.draw(o);
  return {s,o};
}

// ---- lot furniture used by the condition overlays ------------------------
function drive(s){ const x1=(s.split?s.wx0:s.x0)-0.06, x0=Math.max(0.04,x1-0.22); return [x0,x1]; }
function bands(s){                     // keep clear of the bungalow porch
  const p=s.porch;
  return p? {a:[0.02,0.22], b:[0.74,0.98], c:[0.72,0.82]} : {a:[0.06,0.30], b:[0.62,0.94], c:[0.40,0.54]};
}
function car(o,s){
  const [x0,x1]=drive(s), b=bands(s).b, [y0,y1]=b;
  box(o,x0,y0,x1,y1,1.5,5.5,1);
  box(o,x0+0.03,y0+0.26*(y1-y0),x1-0.03,y1-0.26*(y1-y0),5.5,9,1);
  line(o,1,[P(x0,y0+0.12,0),P(x0,y0+0.12,1.5)]);
  line(o,1,[P(x0,y1-0.12,0),P(x0,y1-0.12,1.5)]);
}
function skip(o,s){
  const [x0,x1]=drive(s), [y0,y1]=bands(s).a;
  poly(o,1,[P(x0,y0,0),P(x0,y1,0),P(x0,y1,6),P(x0,y0,7.5)]);
  poly(o,1,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,6),P(x0,y1,6)]);
  line(o,1,[P(x0,y0,7.5),P(x1,y0,8.5)]);
  line(o,1,[P(x1,y0,8.5),P(x1,y1,6)]);
  line(o,1,[P(x0+0.02,y0+0.03,6.5),P(x0+0.10,y0+0.03,9.5)]); // spoil poking out
  line(o,1,[P(x0+0.06,y1-0.05,6.2),P(x0+0.13,y1-0.08,9)]);
}
function stack(o,s){
  const [x0,x1]=drive(s), [y0,y1]=bands(s).c;
  for(let i=0;i<3;i++) box(o,x0+0.02,y0,x1-0.04,y1,i*2.2,i*2.2+1.8,1);
}
function scaffold(o,s){
  const gx=(s.split?s.wx0:s.x0)-(s.porch?0.24:0.055), y0=s.y0, y1=s.y1, top=s.h+5;
  const us=[0.02,0.5,0.98];
  us.forEach(u=>line(o,2,[P(gx,y0+u*(y1-y0),0),P(gx,y0+u*(y1-y0),top)]));
  const lifts=[]; for(let z=top; z>2; z-=Math.max(8,top/4)) lifts.push(z);
  lifts.forEach(z=>line(o,2,[P(gx,y0,z),P(gx,y1,z)]));
  for(let i=0;i<lifts.length-1;i++){
    const zA=lifts[i], zB=lifts[i+1], m=i%2?[0.02,0.5]:[0.5,0.98];
    line(o,1,[P(gx,y0+m[0]*(y1-y0),zB),P(gx,y0+m[1]*(y1-y0),zA)]);
  }
  [0.26,0.74].forEach(u=>line(o,1,[P(gx,y0+u*(y1-y0),0),P(s.x0,y0+u*(y1-y0),0)]));
  line(o,1,[P(gx,y0+0.5*(y1-y0),lifts[0]),P(s.x0,y0+0.5*(y1-y0),lifts[0])]);
}
function board(o,s,kind){            // sold / for-sale board in the drive
  const [x0,x1]=drive(s), [y0,y1]=bands(s).c, xm=(x0+x1)/2;
  line(o,2,[P(xm,y0,0),P(xm,y0,14)]);
  poly(o,2,[P(xm,y0-0.02,9),P(xm,y1+0.02,9),P(xm,y1+0.02,15),P(xm,y0-0.02,15)]);
  line(o,1,[P(xm,y0+0.04,12.8),P(xm,y1-0.04,12.8)]);
  line(o,1,[P(xm,y0+0.04,11),P(xm,y1-0.12,11)]);
  if(kind==='sold') line(o,1,[P(xm,y0+0.04,10.2),P(xm,y1-0.30,10.2)]);
}
function shrub(o,gx,gy,r,h){
  const c=P(gx,gy,h), pts=[];
  for(let i=0;i<7;i++){const a=Math.PI*2*i/7; pts.push([c[0]+r*Math.cos(a), c[1]+r*0.78*Math.sin(a)]);}
  poly(o,1,pts);
  const g=P(gx,gy,0); line(o,1,[[c[0],c[1]+r*0.6],g]);
}
function tuft(o,gx,gy,sz){
  const g=P(gx,gy,0);
  [-1,0,1].forEach(d=>line(o,1,[g,[g[0]+d*sz*0.55, g[1]-sz*(d?0.8:1.15)]]));
}
function roofPt(s,t,u){              // t: 0 at left eave -> 1 at ridge/high edge, u along gy
  const ov=s.ov??0.05, a0=s.x0-ov, xm=(s.x0+s.x1)/2, b0=s.y0-ov, b1=s.y1+ov;
  const h=s.h;
  if(s.flat) return P(a0+t*(s.x1+ov-a0), b0+u*(b1-b0), h+(s.parapet??4));
  if(s.mono) return P(a0+t*(s.x1+ov-a0), b0+u*(b1-b0), h+t*s.roofH);
  const rh=s.roofH;
  return P(a0+t*(xm-a0), b0+u*(b1-b0), h+t*rh);
}

// ---- condition overlays --------------------------------------------------
const STATES={
 distressed(s,o){
  (s.windows||[]).forEach(w=>{
    const F=w.face==='L'?PL:PR;
    const a=F(s,w.u,w.v), b=F(s,w.u+w.w,w.v), c=F(s,w.u+w.w,w.v+w.h), d=F(s,w.u,w.v+w.h);
    line(o,1,[a,c]);
    if((s.windows||[]).length<10){ line(o,1,[b,d]);
      line(o,1,[F(s,w.u-0.01,w.v+w.h*0.62),F(s,w.u+w.w+0.01,w.v+w.h*0.72)]); }
  });
  (s.doors||[]).forEach(w=>{const F=w.face==='L'?PL:PR;
    line(o,1,[F(s,w.u-0.01,w.v+w.h*0.55),F(s,w.u+w.w+0.01,w.v+w.h*0.68)]);
    line(o,1,[F(s,w.u-0.01,w.v+w.h*0.30),F(s,w.u+w.w+0.01,w.v+w.h*0.20)]);});
  [[0.34,0.18],[0.62,0.55],[0.20,0.80]].forEach(([t,u])=>{
    const p=roofPt(s,t,u), q=roofPt(s,t+0.16,u+0.10), r=roofPt(s,t+0.02,u+0.19);
    poly(o,1,[p,q,r]);});
  const ez=eaveZ(s), gy=s.y1;
  line(o,1,[P(s.x0,gy*0.30,ez),P(s.x0,gy*0.30-0.04,ez-3.5)]);   // hanging gutter
  const [dx0,dx1]=drive(s);
  tuft(o,s.x0-0.03,0.10,4); tuft(o,s.x0-0.03,0.46,5); tuft(o,s.x0-0.03,0.86,4.4);
  tuft(o,dx1-0.05,0.24,3.6); tuft(o,dx0+0.04,0.70,4.2);
  tuft(o,(s.x0+s.x1)/2,s.y1+0.03,4); tuft(o,s.x1-0.10,s.y1+0.03,3.4);
 },
 occupied(s,o){
  (s.windows||[]).forEach(w=>{
    const F=w.face==='L'?PL:PR, i=0.16;
    line(o,1,[F(s,w.u+w.w*i,w.v+w.h*0.08),F(s,w.u+w.w*i,w.v+w.h*0.92)]);
    line(o,1,[F(s,w.u+w.w*(1-i),w.v+w.h*0.08),F(s,w.u+w.w*(1-i),w.v+w.h*0.92)]);
    line(o,1,[F(s,w.u+w.w*i,w.v+w.h*0.70),F(s,w.u+w.w*(1-i),w.v+w.h*0.86)]);
  });
  car(o,s);
  shrub(o,s.x0-0.03,0.16,3.2,5);
  const [x0,x1]=drive(s);
  line(o,1,[P(x1,0.34,0),P(s.x0,0.34,0)]);
  line(o,1,[P(x1,0.46,0),P(s.x0,0.46,0)]);
 },
 working(s,o){
  scaffold(o,s); skip(o,s); stack(o,s);
  (s.windows||[]).filter((_,i)=>i%3===0).forEach(w=>{
    const F=w.face==='L'?PL:PR;
    line(o,1,[F(s,w.u,w.v+w.h*0.5),F(s,w.u+w.w,w.v+w.h*0.5)]);});
  const [x0,x1]=drive(s);
  line(o,1,[P(x1+0.01,0.36,0),P(x1+0.01,0.36,9)]);   // permit board on a post
  poly(o,1,[P(x1+0.01,0.34,9),P(x1+0.01,0.48,9),P(x1+0.01,0.48,13.5),P(x1+0.01,0.34,13.5)]);
  line(o,1,[P(x1+0.01,0.36,11.8),P(x1+0.01,0.46,11.8)]);
 },
 finished(s,o){
  board(o,s,'sold');
  shrub(o,s.x0-0.035,0.12,3.0,4.6);
  shrub(o,s.x0-0.035,0.30,2.6,4.0);
  shrub(o,s.x0-0.035,0.86,3.2,4.8);
  shrub(o,(s.x0+s.x1)/2,s.y1+0.045,2.8,4.2);
  const [x0,x1]=drive(s);
  line(o,1,[P(x0,0.62,0),P(s.x0,0.62,0)]);
  line(o,1,[P(x0,0.78,0),P(s.x0,0.78,0)]);
  line(o,1,[P(x0,0.62,0),P(x0,0.78,0)]);

 }
};

function transformFor(id){
  const {o}=drawBase(id);
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  const eat=p=>{mnx=Math.min(mnx,p[0]);mxx=Math.max(mxx,p[0]);mny=Math.min(mny,p[1]);mxy=Math.max(mxy,p[1]);};
  [...o.heavy,...o.light].forEach(s=>s.pts.forEach(eat));
  [[0,0],[1,0],[1,1],[0,1]].forEach(([a,b])=>eat(P(a,b,0)));
  return [64-(mnx+mxx)/2,64-(mny+mxy)/2];
}
