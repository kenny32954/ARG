(() => {
"use strict";
const $=q=>document.querySelector(q);
const els={
  load:$("#loadBtn"),play:$("#playBtn"),stop:$("#stopBtn"),state:$("#deckState"),
  counter:$("#counter"),speed:$("#speed"),channel:$("#channel"),direction:$("#direction"),
  phase:$("#phase"),quality:$("#quality"),qfill:$("#qfill"),printer:$("#printout"),
  printerState:$("#printerState"),scope:$("#scope"),recovered:$("#recovered")
};
const KEY="echo1.phase2.g7.v1";
const PHASE1="echo1.phase1.state.v1";
const correct={speed:"7.5",channel:"B",direction:"REV",phase:"180"};
const state={loaded:false,playing:false,start:0,timer:null,audio:null,recovered:false};
const morse={
  A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",
  K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",
  U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--.."
};
const phrase="IT LISTENS";
function save(){
  localStorage.setItem(KEY,JSON.stringify({recovered:state.recovered}));
  if(state.recovered){
    try{const p=JSON.parse(localStorage.getItem(PHASE1)||"{}");p.discovered=p.discovered||{};p.discovered.g7Tape=true;localStorage.setItem(PHASE1,JSON.stringify(p))}catch{}
  }
}
function loadSaved(){try{state.recovered=Boolean(JSON.parse(localStorage.getItem(KEY)||"{}").recovered)}catch{}if(state.recovered)els.recovered.hidden=false}
function print(msg,cls=""){const p=document.createElement("p");if(cls)p.className=cls;p.textContent=msg;els.printer.appendChild(p);els.printer.scrollTop=els.printer.scrollHeight;while(els.printer.children.length>80)els.printer.firstElementChild.remove()}
function quality(){
  let q=0;
  if(els.speed.value===correct.speed)q+=29;
  if(els.channel.value===correct.channel)q+=23;
  if(els.direction.value===correct.direction)q+=21;
  if(els.phase.value===correct.phase)q+=27;
  return q;
}
function updateQuality(){
  const q=quality();els.quality.textContent=q+"%";els.qfill.style.width=q+"%";
  if(state.loaded&&!state.playing)els.state.textContent=q===100?"CALIBRATION LOCK":"CALIBRATION ERROR";
}
function audio(){
  if(state.audio)return state.audio;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  const ctx=new AC(),master=ctx.createGain();master.gain.value=.22;master.connect(ctx.destination);
  state.audio={ctx,master,nodes:[]};return state.audio;
}
function stopAudio(){
  if(!state.audio)return;
  state.audio.nodes.forEach(n=>{try{n.stop()}catch{}});state.audio.nodes=[];
}
function scheduleToneSequence(q){
  const a=audio();if(!a)return;
  stopAudio();const ctx=a.ctx,now=ctx.currentTime+.08;
  const clean=q===100,unit=clean?.105:.075;
  let t=now;
  const chars=phrase.split("");
  chars.forEach(ch=>{
    if(ch===" "){t+=unit*7;return}
    const code=morse[ch]||"";
    [...code].forEach(sym=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),f=clean?690:420+Math.random()*850;
      o.type=clean?"sine":"triangle";o.frequency.value=f;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(clean?.14:.075,t+.008);
      const dur=unit*(sym==="."?1:3);g.gain.setValueAtTime(clean?.14:.075,t+dur-.01);g.gain.linearRampToValueAtTime(0,t+dur);
      o.connect(g).connect(a.master);o.start(t);o.stop(t+dur+.02);a.nodes.push(o);t+=dur+unit;
    });t+=unit*2;
  });
  if(!clean){
    const len=ctx.sampleRate*4,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*.38;
    const n=ctx.createBufferSource(),g=ctx.createGain();n.buffer=b;g.gain.value=.11;n.connect(g).connect(a.master);n.start(now);n.stop(Math.min(t,now+4));a.nodes.push(n);
  }
}
function play(){
  if(!state.loaded||state.playing)return;
  state.playing=true;state.start=performance.now();els.play.disabled=true;els.stop.disabled=false;els.state.textContent="PLAY";
  document.querySelectorAll(".reel").forEach(r=>r.classList.add("spin"));
  const q=quality();print("TRANSPORT START // QUALITY "+q+"%","dim");
  scheduleToneSequence(q);
  state.timer=setInterval(()=>{
    const sec=(performance.now()-state.start)/1000;
    const m=Math.floor(sec/60),s=sec-m*60;els.counter.textContent=String(m).padStart(2,"0")+":"+s.toFixed(1).padStart(4,"0");
    if(sec>=10.5)finish(q);
  },80);
}
function finish(q){
  if(!state.playing)return;stopTransport();
  if(q===100){
    els.printerState.textContent="RECOVERY COMPLETE";print("CARRIER CLOCK STABLE.","ok");print("SECONDARY HEAD DATA CORRELATION: 99.3%","ok");print("MACHINE PARSE: "+phrase,"ok");print("VOICE BAND RECOVERED // SEGMENT 23:14:17","ok");
    state.recovered=true;save();els.recovered.hidden=false;setTimeout(()=>els.recovered.scrollIntoView({behavior:"smooth",block:"start"}),250);
  }else{
    els.printerState.textContent="UNSTABLE";print("FRAME LOSS // TRANSPORT PARAMETERS INVALID","bad");print("NO RELIABLE VOICE SEGMENT RECOVERED.","bad");
  }
}
function stopTransport(){
  clearInterval(state.timer);state.timer=null;state.playing=false;stopAudio();els.play.disabled=!state.loaded;els.stop.disabled=true;els.state.textContent=state.loaded?(quality()===100?"CALIBRATION LOCK":"READY"):"NO MEDIA";document.querySelectorAll(".reel").forEach(r=>r.classList.remove("spin"));
}
function draw(ts){
  requestAnimationFrame(draw);
  const c=els.scope,x=c.getContext("2d"),w=c.width,h=c.height,q=quality()/100;
  x.fillStyle="rgba(3,3,2,.22)";x.fillRect(0,0,w,h);
  x.strokeStyle="rgba(216,205,145,.55)";x.lineWidth=2;x.beginPath();
  for(let i=0;i<w;i++){
    const t=i/w*18+ts/500;
    const clean=Math.sin(t*3.2)*22*q+Math.sin(t*6.4)*9*q;
    const noise=(Math.sin(t*17.7)+Math.sin(t*31.1))*18*(1-q)+(Math.random()-.5)*35*(1-q);
    const y=h/2+clean+noise;
    i?x.lineTo(i,y):x.moveTo(i,y);
  }x.stroke();
}
els.load.addEventListener("click",async()=>{
  state.loaded=true;els.load.disabled=true;els.play.disabled=false;els.state.textContent="READY";print("REEL G7-2314 MOUNTED.","ok");print("MAGNETIC IMAGE DEGRADED. MANUAL CALIBRATION REQUIRED.","dim");
  const a=audio();if(a&&a.ctx.state==="suspended")await a.ctx.resume();updateQuality();
});
els.play.addEventListener("click",play);els.stop.addEventListener("click",stopTransport);
[els.speed,els.channel,els.direction,els.phase].forEach(el=>el.addEventListener("change",()=>{if(state.playing)stopTransport();updateQuality()}));
loadSaved();updateQuality();requestAnimationFrame(draw);
})();