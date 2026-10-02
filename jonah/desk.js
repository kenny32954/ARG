(() => {
"use strict";
const $=q=>document.querySelector(q);
const els={boot:$("#boot"),bootLine:$("#bootLine"),bootFill:$("#bootFill"),desktop:$("#desktop"),icons:$("#icons"),windows:$("#windows"),tasks:$("#tasks"),start:$("#startBtn"),menu:$("#startMenu"),clock:$("#deskClock"),signal:$("#signalTray"),tpl:$("#windowTemplate")};
const KEY="echo1.phase3.desk.v1",P1="echo1.phase1.state.v1";
let topZ=10,openWindows=new Map(),selectedIcon=null;

const fs={
  mydocs:{name:"My Documents",type:"folder",files:["notes","field","freqs","photo","recorder"]},
  notes:{name:"notes.txt",type:"text",content:
`09/12
Herman says the sound is probably interference.

It isn't.

The signal moves when I move the receiver, but not the way a station should. The closer I get to the wall in my room, the louder the carrier gets.

09/15
Found old utility drawings that mention G-7. There shouldn't be power there.

09/17
If I hear the second voice again I'm recording the whole thing.

I keep thinking I hear my name before I turn the radio on.`},
  field:{name:"FIELD.LOG",type:"text",content:
`J-17 PORTABLE RECEIVER LOG

22:41:08  E-04   101.1   -41 dB
22:44:33  N-12   101.1   -48 dB
22:47:02  W-03   101.1   -46 dB
22:49:51  S-09   101.1   -44 dB
22:52:04  [STATIC / 12 SEC]
22:52:17  LOCAL   101.1   +03 dB
22:52:18  LOCAL   101.1   +09 dB
22:52:19  LOCAL   101.1   +17 dB

NOTE: positive received power is impossible with this front-end.
NOTE: disconnecting antenna did not reduce signal.`},
  freqs:{name:"freqs.csv",type:"text",content:
`mhz,label,observation
88.3,weather relay,normal
93.7,civic repeater,normal
101.1,UNKNOWN,follows receiver
104.5,school band,normal
106.9,traffic relay,normal
101.1,UNKNOWN,still present with antenna removed`},
  photo:{name:"E04_STILL.BMP",type:"image"},
  recorder:{name:"RECORDER.EXE",type:"audio"},
  recycle:{name:"Recycle Bin",type:"folder",files:["call","cache17"]},
  call:{name:"CALL.TXT",type:"text",content:
`AUTO-TRANSCRIBE / DELETED FRAGMENT

00:03:11  UNKNOWN: Herman.
00:03:14  UNKNOWN: Stop looking for him.
00:03:20  UNKNOWN: The frequency is not where you think it is.
00:03:27  [END]

SOURCE NUMBER: NONE
ROUTING RECORD: NONE
AUDIO DEVICE: J-17 INTERNAL MODEM`},
  cache17:{name:"CACHE_17.BIN",type:"hex",content:"2f4152472f6a6f6e61682f63616368652e68746d6c"},
  system:{name:"System Info",type:"system"},
  browser:{name:"Ravenswood Net",type:"browser"}
};

const desktopItems=["mydocs","recorder","browser","recycle","system"];

function saveFlag(flag){
  try{const s=JSON.parse(localStorage.getItem(KEY)||"{}");s[flag]=true;localStorage.setItem(KEY,JSON.stringify(s))}catch{}
  try{const p=JSON.parse(localStorage.getItem(P1)||"{}");p.discovered=p.discovered||{};p.discovered["desk_"+flag]=true;localStorage.setItem(P1,JSON.stringify(p))}catch{}
}
function boot(){
  const lines=["Mounting recovered volume...","Checking journal...","Repairing directory table...","Restoring desktop state...","Warning: system clock differs from forensic host.","Session ready."];
  let i=0;
  const timer=setInterval(()=>{i++;els.bootFill.style.width=Math.min(100,i/lines.length*100)+"%";els.bootLine.textContent=lines[Math.min(i,lines.length-1)];if(i>=lines.length){clearInterval(timer);setTimeout(()=>els.boot.classList.add("done"),350)}},280);
}
function iconGlyph(item){
  if(item.type==="folder")return "▰";if(item.type==="audio")return "♪";if(item.type==="browser")return "N";if(item.type==="system")return "i";return "□";
}
function renderIcons(){
  els.icons.replaceChildren();desktopItems.forEach(id=>{
    const item=fs[id],b=document.createElement("button");b.className="icon "+(id==="recycle"?"bin":item.type==="folder"?"folder":"");b.type="button";b.innerHTML=`<span class="icon-glyph">${iconGlyph(item)}</span><span>${item.name}</span>`;
    b.addEventListener("click",()=>{if(selectedIcon)selectedIcon.classList.remove("selected");selectedIcon=b;b.classList.add("selected")});
    b.addEventListener("dblclick",()=>openItem(id));els.icons.appendChild(b);
  });
}
function taskFor(id,title){
  const t=document.createElement("button");t.className="task";t.textContent=title;t.addEventListener("click",()=>{const w=openWindows.get(id);if(!w)return;w.hidden=!w.hidden;if(!w.hidden)focus(w)});els.tasks.appendChild(t);return t;
}
function openItem(id){
  const item=fs[id];if(!item)return;
  if(openWindows.has(id)){const w=openWindows.get(id);w.hidden=false;focus(w);return}
  const w=els.tpl.content.firstElementChild.cloneNode(true);w.dataset.id=id;w.querySelector(".window-title").textContent=item.name;
  const body=w.querySelector(".window-body");renderItem(body,id,item);
  const offset=openWindows.size%7;w.style.left=(12+offset*4)+"vw";w.style.top=(7+offset*3)+"vh";
  const task=taskFor(id,item.name);w._task=task;
  w.querySelector(".close").addEventListener("click",()=>{task.remove();openWindows.delete(id);w.remove()});
  w.querySelector(".minimize").addEventListener("click",()=>w.hidden=true);
  w.addEventListener("mousedown",()=>focus(w));makeDraggable(w,w.querySelector(".window-head"));
  els.windows.appendChild(w);openWindows.set(id,w);focus(w);saveFlag("opened_"+id);
}
function renderItem(body,id,item){
  if(item.type==="folder"){
    const grid=document.createElement("div");grid.className="file-list";
    item.files.forEach(fid=>{const f=fs[fid],card=document.createElement("div");card.className="file-card";card.innerHTML=`<b>${f.name}</b><small>${f.type.toUpperCase()} FILE</small>`;card.addEventListener("dblclick",()=>openItem(fid));grid.appendChild(card)});body.appendChild(grid);return;
  }
  if(item.type==="text"){const pre=document.createElement("pre");pre.textContent=item.content;body.appendChild(pre);return}
  if(item.type==="hex"){
    const h=document.createElement("div");h.className="hex";h.textContent=item.content;body.append(h);
    const p=document.createElement("p");p.className="ghost";p.textContent="Header: RAW CACHE PATH / 8-bit ASCII";body.append(p);return;
  }
  if(item.type==="system"){
    body.innerHTML=`<pre>RWD FORENSIC WORKSTATION
IMAGE: J17_HOME_0917
FILESYSTEM: PARTIAL
HOST CLOCK: CURRENT
GUEST CLOCK: 23:14:09 [STUCK]
NETWORK: DISCONNECTED
MODEM: PRESENT / LAST EVENT 00:03
RF COUPLING: DETECTED [UNSUPPORTED]</pre>`;return;
  }
  if(item.type==="browser"){renderBrowser(body);return}
  if(item.type==="audio"){renderAudio(body);return}
  if(item.type==="image"){renderImage(body);return}
}
function renderBrowser(body){
  const bar=document.createElement("div");bar.className="browserbar";bar.innerHTML='<input value="http://ravenswood.local/" readonly><button type="button">Go</button>';
  const page=document.createElement("div");page.className="fakepage";page.innerHTML=`<h2>Ravenswood Community Network</h2><p><i>Offline copy recovered from browser cache.</i></p><hr><h3>Recent notices</h3><p>East municipal relay maintenance postponed indefinitely.</p><p>Community radio club meeting moved from the civic annex.</p><p class="warning">Archived forum database unavailable.</p>`;
  body.append(bar,page);
}
function renderAudio(body){
  const box=document.createElement("div");box.className="audio-box";box.innerHTML='<div>J-17 FIELD RECORDER</div><div class="audio-bars"></div><button type="button">PLAY FRAGMENT</button><p class="status">STOPPED</p>';
  const bars=box.querySelector(".audio-bars");for(let i=0;i<64;i++){const b=document.createElement("i");b.style.height=(8+Math.random()*78)+"%";bars.appendChild(b)}
  const btn=box.querySelector("button"),status=box.querySelector(".status");btn.addEventListener("click",async()=>{status.textContent="PLAYING // CARRIER 101.1";btn.disabled=true;await toneBurst();setTimeout(()=>{status.textContent="TRANSCRIPT FAILURE // NONSPEECH COMPONENT DETECTED";btn.disabled=false;saveFlag("recorder_played")},5500)});
  body.appendChild(box);
}
async function toneBurst(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC();if(ctx.state==="suspended")await ctx.resume();
  const master=ctx.createGain();master.gain.value=.12;master.connect(ctx.destination);const start=ctx.currentTime+.05;
  const pattern=[1,0,1,1,0,0,1,0,1,0,0,1,1,1,0,1,0,1];
  pattern.forEach((v,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=v?711:493;o.type="sine";const t=start+i*.24;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.15,t+.015);g.gain.linearRampToValueAtTime(0,t+.17);o.connect(g).connect(master);o.start(t);o.stop(t+.19)});
}
function renderImage(body){
  const c=document.createElement("canvas");c.width=640;c.height=360;c.style.width="100%";c.style.background="#08090a";body.appendChild(c);const x=c.getContext("2d");x.fillStyle="#08090a";x.fillRect(0,0,c.width,c.height);for(let y=0;y<c.height;y+=32){for(let xx=0;xx<c.width;xx+=70){const v=18+Math.random()*20;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(xx+(y/32%2)*35,y,65,28)}}x.fillStyle="rgba(230,230,220,.45)";x.font="15px Courier New";x.fillText("E-04 // DUPLICATE FRAME // LUMA CHANNEL DAMAGED",14,342)
}
function focus(w){topZ++;w.style.zIndex=topZ;[...els.windows.children].forEach(n=>n.classList.toggle("active",n===w))}
function makeDraggable(w,handle){
  let down=false,ox=0,oy=0;
  handle.addEventListener("pointerdown",e=>{if(e.target.tagName==="BUTTON")return;down=true;const r=w.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;handle.setPointerCapture(e.pointerId)});
  handle.addEventListener("pointermove",e=>{if(!down)return;const maxX=innerWidth-w.offsetWidth,maxY=innerHeight-42-w.offsetHeight;w.style.left=Math.max(0,Math.min(maxX,e.clientX-ox))+"px";w.style.top=Math.max(0,Math.min(maxY,e.clientY-oy))+"px"});
  handle.addEventListener("pointerup",()=>down=false);
}
els.start.addEventListener("click",()=>els.menu.hidden=!els.menu.hidden);
els.menu.addEventListener("click",e=>{const id=e.target.dataset.open;if(id){openItem(id);els.menu.hidden=true}});
$("#shutdown").addEventListener("click",()=>{document.body.innerHTML='<div style="background:#05070b;color:#9aa8ba;height:100vh;display:grid;place-items:center;font:16px Courier New">FORENSIC SESSION CLOSED.</div>'});
setInterval(()=>{els.clock.textContent="23:14";const pulse=Math.floor(Date.now()/1000)%11;els.signal.textContent=pulse<2?"RF: 101.1":"RF: --";els.signal.classList.toggle("alert",pulse<2)},1000);
renderIcons();boot();
})();