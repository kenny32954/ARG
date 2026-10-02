(() => {
"use strict";

const STORAGE_KEY="echo1.phase1.state.v1";
const GRID_KEY="echo1.phase2.grid.v1";
const $=q=>document.querySelector(q);
const els={
  canvas:$("#map"),auth:$("#authBadge"),fix:$("#fixReadout"),nodes:$("#nodeButtons"),
  selected:$("#selectedNode"),az:$("#azimuth"),azOut:$("#azReadout"),needle:$("#needle"),
  strengthFill:$("#strengthFill"),strengthText:$("#strengthText"),phase:$("#phaseRef"),
  logged:$("#loggedCount"),sweep:$("#sweepBtn"),logBtn:$("#logBtn"),fieldLog:$("#fieldLog"),
  clear:$("#clearBtn"),recovered:$("#recoveredPanel")
};

const source={x:.54,y:.47};
const relays=[
  {id:"E-04",x:.82,y:.48,phase:"+00.000"},
  {id:"N-12",x:.50,y:.14,phase:"+00.073"},
  {id:"W-03",x:.18,y:.59,phase:"+00.118"},
  {id:"S-09",x:.62,y:.84,phase:"+00.061"}
];

const state={selected:0,az:0,logged:{},sweeping:false,sweepTimer:null,authorized:false,solved:false};

function getPhase1(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}catch{return{}}
}
function load(){
  const p1=getPhase1();
  state.authorized=Boolean(p1.discovered?.wallEyes || p1.discovered?.case041 || p1.archiveUnlocked);
  els.auth.textContent=state.authorized?"INDEX / PARTIAL":"INDEX / UNVERIFIED";
  if(state.authorized) els.auth.classList.add("ok");
  try{
    const s=JSON.parse(localStorage.getItem(GRID_KEY)||"{}");
    if(s.logged&&typeof s.logged==="object") state.logged=s.logged;
    state.solved=Boolean(s.solved);
  }catch{}
  if(state.solved) els.recovered.hidden=false;
}
function save(){
  localStorage.setItem(GRID_KEY,JSON.stringify({logged:state.logged,solved:state.solved}));
  if(state.solved){
    try{
      const p=getPhase1();p.discovered=p.discovered||{};p.discovered.g7Fix=true;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(p));
    }catch{}
  }
}
function stamp(){return new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function log(msg,cls=""){
  const p=document.createElement("p");if(cls)p.className=cls;
  const t=document.createElement("time");t.textContent=stamp()+" ";
  p.append(t,document.createTextNode(msg));els.fieldLog.appendChild(p);
  while(els.fieldLog.children.length>70)els.fieldLog.firstElementChild.remove();
  els.fieldLog.scrollTop=els.fieldLog.scrollHeight;
}
function wrapAngle(d){return ((d%360)+360)%360}
function bearing(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  return wrapAngle(Math.atan2(dx,-dy)*180/Math.PI);
}
function angleDistance(a,b){
  const d=Math.abs(wrapAngle(a)-wrapAngle(b));return Math.min(d,360-d);
}
function currentRelay(){return relays[state.selected]}
function strength(){
  const trueBearing=bearing(currentRelay(),source);
  const d=angleDistance(state.az,trueBearing);
  const peak=Math.exp(-Math.pow(d/11,2));
  const shoulder=Math.exp(-Math.pow(d/42,2))*.18;
  const noise=(Math.sin(performance.now()/153)+Math.sin(performance.now()/61))*0.018+Math.random()*.018;
  return Math.max(.015,Math.min(1,peak*.88+shoulder+noise));
}
function buildNodeButtons(){
  els.nodes.replaceChildren();
  relays.forEach((r,i)=>{
    const b=document.createElement("button");
    b.type="button";b.className="node-btn";b.textContent=r.id;
    if(i===state.selected)b.classList.add("active");
    if(state.logged[r.id]!=null)b.classList.add("logged");
    b.addEventListener("click",()=>{
      stopSweep();state.selected=i;
      [...els.nodes.children].forEach((n,j)=>n.classList.toggle("active",j===i));
      els.selected.textContent=r.id;els.phase.textContent=r.phase;
      updateControls();drawMap();
    });
    els.nodes.appendChild(b);
  });
}
function updateControls(){
  state.az=Number(els.az.value);
  els.azOut.textContent=String(state.az).padStart(3,"0");
  els.needle.style.transform=`rotate(${state.az}deg)`;
  const s=strength(),pct=Math.round(s*100);
  els.strengthFill.style.width=pct+"%";els.strengthText.textContent=pct+"%";
  els.logged.textContent=Math.min(3,Object.keys(state.logged).length)+" / 3";
}
function logBearing(){
  const r=currentRelay(),correct=bearing(r,source),d=angleDistance(state.az,correct);
  if(d<=5.5){
    const jitter=(Math.random()-.5)*2.2;
    const recorded=Math.round(wrapAngle(state.az+jitter));
    state.logged[r.id]=recorded;
    log(`${r.id} bearing accepted // ${String(recorded).padStart(3,"0")}° // carrier correlation stable`,"good");
    save();buildNodeButtons();drawMap();checkSolve();
  }else{
    log(`${r.id} sample rejected // multipath or weak correlation`,"bad");
  }
}
function checkSolve(){
  const ids=Object.keys(state.logged);
  if(ids.length<3)return;
  const valid=ids.filter(id=>{
    const r=relays.find(x=>x.id===id);return angleDistance(state.logged[id],bearing(r,source))<=7;
  });
  if(valid.length>=3&&!state.solved){
    state.solved=true;save();els.fix.textContent="SOURCE FIX / G-7";els.recovered.hidden=false;
    log("triangulation solution converged // legacy parcel G-7","good");
    setTimeout(()=>els.recovered.scrollIntoView({behavior:"smooth",block:"start"}),250);
  }
}
function startSweep(){
  if(state.sweeping){stopSweep();return}
  state.sweeping=true;els.sweep.textContent="STOP ROTATE";
  state.sweepTimer=setInterval(()=>{
    state.az=wrapAngle(state.az+2);els.az.value=state.az;updateControls();drawMap();
  },38);
}
function stopSweep(){
  clearInterval(state.sweepTimer);state.sweepTimer=null;state.sweeping=false;els.sweep.textContent="AUTO ROTATE";
}
function drawMap(){
  const c=els.canvas,x=c.getContext("2d"),w=c.width,h=c.height;
  x.fillStyle="#030604";x.fillRect(0,0,w,h);

  x.strokeStyle="rgba(55,96,66,.20)";x.lineWidth=1;
  for(let gx=0;gx<w;gx+=50){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,h);x.stroke()}
  for(let gy=0;gy<h;gy+=45){x.beginPath();x.moveTo(0,gy);x.lineTo(w,gy);x.stroke()}

  x.strokeStyle="rgba(81,121,91,.28)";x.lineWidth=5;
  const roads=[
    [[.04,.27],[.28,.31],[.49,.28],[.72,.34],[.95,.30]],
    [[.08,.67],[.31,.60],[.53,.62],[.74,.55],[.94,.60]],
    [[.31,.06],[.34,.26],[.32,.48],[.39,.72],[.36,.94]],
    [[.69,.05],[.64,.27],[.70,.48],[.65,.72],[.72,.95]],
    [[.08,.46],[.23,.44],[.40,.50],[.56,.45],[.80,.46],[.94,.42]]
  ];
  roads.forEach(path=>{x.beginPath();path.forEach(([px,py],i)=>i?x.lineTo(px*w,py*h):x.moveTo(px*w,py*h));x.stroke()});

  x.fillStyle="rgba(73,116,83,.12)";
  [[.10,.08,.17,.12],[.40,.08,.14,.11],[.75,.10,.13,.15],[.08,.77,.20,.11],[.42,.73,.14,.17],[.77,.72,.15,.15]].forEach(([a,b,cw,ch])=>x.fillRect(a*w,b*h,cw*w,ch*h));

  x.font="18px Courier New";x.fillStyle="rgba(101,145,112,.45)";
  [["NORTH RIDGE",.42,.08],["EAST DISTRICT",.73,.42],["OLD CIVIC",.44,.56],["SOUTH CUT",.49,.88],["WEST YARD",.09,.57]].forEach(([t,px,py])=>x.fillText(t,px*w,py*h));

  Object.entries(state.logged).forEach(([id,ang])=>{
    const r=relays.find(n=>n.id===id),sx=r.x*w,sy=r.y*h,rad=ang*Math.PI/180,len=Math.max(w,h)*1.25;
    x.strokeStyle="rgba(143,230,166,.42)";x.lineWidth=2;x.setLineDash([10,8]);
    x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.sin(rad)*len,sy-Math.cos(rad)*len);x.stroke();x.setLineDash([]);
  });

  relays.forEach((r,i)=>{
    const px=r.x*w,py=r.y*h;
    x.strokeStyle=i===state.selected?"#dfffe8":"#6da17a";x.lineWidth=2;
    x.beginPath();x.arc(px,py,9,0,Math.PI*2);x.stroke();
    x.beginPath();x.arc(px,py,18,0,Math.PI*2);x.strokeStyle="rgba(109,161,122,.24)";x.stroke();
    x.fillStyle="#9ed8ae";x.font="16px Courier New";x.fillText(r.id,px+15,py-12);
  });

  if(state.solved){
    const px=source.x*w,py=source.y*h;
    x.save();x.translate(px,py);x.rotate(Math.PI/4);x.fillStyle="#dd6058";x.fillRect(-7,-7,14,14);x.restore();
    x.fillStyle="#e17a73";x.font="bold 18px Courier New";x.fillText("G-7",px+16,py+5);
    x.strokeStyle="rgba(221,96,88,.35)";x.beginPath();x.arc(px,py,36,0,Math.PI*2);x.stroke();
  }

  const r=currentRelay(),rad=state.az*Math.PI/180;
  x.strokeStyle="rgba(221,96,88,.28)";x.lineWidth=1;
  x.beginPath();x.moveTo(r.x*w,r.y*h);x.lineTo(r.x*w+Math.sin(rad)*160,r.y*h-Math.cos(rad)*160);x.stroke();
}
els.az.addEventListener("input",()=>{stopSweep();updateControls();drawMap()});
els.sweep.addEventListener("click",startSweep);
els.logBtn.addEventListener("click",logBearing);
els.clear.addEventListener("click",()=>{
  state.logged={};state.solved=false;save();els.recovered.hidden=true;els.fix.textContent="NO FIX";buildNodeButtons();drawMap();log("local bearing table cleared");
});
window.addEventListener("resize",drawMap);

load();buildNodeButtons();els.phase.textContent=currentRelay().phase;
if(state.solved)els.fix.textContent="SOURCE FIX / G-7";
updateControls();drawMap();checkSolve();
setInterval(updateControls,90);
})();