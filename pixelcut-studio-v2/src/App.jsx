import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Image as ImageIcon, Video, Download, RotateCcw, SlidersHorizontal,
  Scissors, Sparkles, Film, Layers, Type, Music2, Plus, Trash2, ChevronUp,
  ChevronDown, Play, Pause, Eye, EyeOff, Lock, Unlock, Copy, Move, Settings2,
  Monitor, Smartphone, PanelLeftClose, PanelRightClose, WandSparkles
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const PRESETS = [
  {name:"Original", css:"none"},
  {name:"Cinematic", css:"contrast(1.15) saturate(.82) brightness(.94)"},
  {name:"Warm", css:"sepia(.22) saturate(1.18) brightness(1.03)"},
  {name:"B&W", css:"grayscale(1) contrast(1.08)"},
  {name:"Dreamy", css:"brightness(1.1) saturate(1.12)"},
  {name:"Moody", css:"brightness(.82) contrast(1.22) saturate(.78)"}
];
const makeId = () => Math.random().toString(36).slice(2, 10);
const time = (n) => { const s=Math.max(0, Number(n)||0); return `${Math.floor(s/60).toString().padStart(2,"0")}:${Math.floor(s%60).toString().padStart(2,"0")}`; };

export default function App() {
  const [assets,setAssets] = useState([]);
  const [clips,setClips] = useState([]);
  const [selected,setSelected] = useState(null);
  const [tab,setTab] = useState("properties");
  const [playing,setPlaying] = useState(false);
  const [playhead,setPlayhead] = useState(0);
  const [brightness,setBrightness] = useState(100);
  const [contrast,setContrast] = useState(100);
  const [saturation,setSaturation] = useState(100);
  const [preset,setPreset] = useState("none");
  const [textValue,setTextValue] = useState("Your title");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [scale,setScale] = useState(1);
  const [mobilePanel,setMobilePanel] = useState("preview");
  const [ratio,setRatio] = useState("16:9");
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ffmpegRef = useRef(null);
  const playTimer = useRef(null);

  const selectedClip = clips.find(c=>c.id===selected) || null;
  const selectedAsset = selectedClip ? assets.find(a=>a.id===selectedClip.assetId) : null;
  const totalDuration = Math.max(8, ...clips.map(c=>c.start+c.duration));
  const activeClip = clips.filter(c=>playhead>=c.start && playhead<=c.start+c.duration && !c.hidden).sort((a,b)=>b.track-a.track)[0] || selectedClip;
  const activeAsset = activeClip ? assets.find(a=>a.id===activeClip.assetId) : null;
  const activeText = clips.filter(c=>c.type==="text" && !c.hidden && playhead>=c.start && playhead<=c.start+c.duration).sort((a,b)=>b.track-a.track)[0];

  const filterCss = `${preset==="none"?"":preset+" "}brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`.trim();
  const sortedClips = useMemo(()=>[...clips].sort((a,b)=>b.track-a.track || a.start-b.start),[clips]);

  useEffect(()=>()=>{ if(playTimer.current) clearInterval(playTimer.current); assets.forEach(a=>URL.revokeObjectURL(a.url)); },[]);
  useEffect(()=>{
    if(!playing) { if(playTimer.current) clearInterval(playTimer.current); return; }
    playTimer.current=setInterval(()=>setPlayhead(p=>{ if(p>=totalDuration){setPlaying(false);return 0;} return p+.08; }),80);
    return ()=>clearInterval(playTimer.current);
  },[playing,totalDuration]);

  useEffect(()=>{
    if(activeAsset?.type==="video" && videoRef.current && videoRef.current.src!==activeAsset.url){
      videoRef.current.src=activeAsset.url; videoRef.current.currentTime=Math.max(0,playhead-activeClip.start);
    }
  },[activeAsset?.id, activeClip?.id]);

  const importFiles=(list)=>{
    const picked=[...list].filter(f=>f.type.startsWith("image/")||f.type.startsWith("video/")||f.type.startsWith("audio/"));
    if(!picked.length) return;
    const next=picked.map(file=>({id:makeId(),file,url:URL.createObjectURL(file),name:file.name,type:file.type.startsWith("video/")?"video":file.type.startsWith("audio/")?"audio":"image",size:file.size,duration:0}));
    setAssets(prev=>[...prev,...next]);
    setMessage(`${next.length} asset${next.length>1?"s":""} imported into Media.`);
    next.forEach(a=>{
      if(a.type==="video"||a.type==="audio"){
        const el=document.createElement(a.type==="video"?"video":"audio"); el.preload="metadata"; el.src=a.url;
        el.onloadedmetadata=()=>{const d=Number.isFinite(el.duration)?el.duration:5;setAssets(prev=>prev.map(x=>x.id===a.id?{...x,duration:d}:x));};
      }
    });
  };
  const addToTimeline=(asset,track)=>{
    const duration=asset.type==="image"?5:(asset.duration||5);
    const sameTrack=clips.filter(c=>c.track===track);
    const start=sameTrack.length?Math.max(...sameTrack.map(c=>c.start+c.duration)):0;
    const clip={id:makeId(),assetId:asset.id,name:asset.name,type:asset.type,start,duration,sourceIn:0,track,hidden:false,locked:false,opacity:100,scale:100};
    setClips(p=>[...p,clip]);setSelected(clip.id);setPlayhead(start);setTab("properties");setMobilePanel("preview");
  };
  const updateClip=(id,patch)=>setClips(p=>p.map(c=>c.id===id?{...c,...patch}:c));
  const removeClip=(id)=>{setClips(p=>p.filter(c=>c.id!==id));if(selected===id)setSelected(null);};
  const moveClip=(id,dir)=>{
    setClips(prev=>{
      const item=prev.find(c=>c.id===id);if(!item||item.locked)return prev;
      const peers=prev.filter(c=>c.track===item.track).sort((a,b)=>a.start-b.start);
      const i=peers.findIndex(c=>c.id===id), j=i+dir;
      if(j<0||j>=peers.length)return prev;
      const other=peers[j], a={...item,start:other.start}, b={...other,start:item.start};
      return prev.map(c=>c.id===a.id?a:c.id===b.id?b:c);
    });
  };
  const duplicateClip=(clip)=>{if(!clip)return;const copy={...clip,id:makeId(),name:clip.name+" copy",start:clip.start+clip.duration};setClips(p=>[...p,copy]);setSelected(copy.id);};
  const exportImage=()=>{
    if(!selectedAsset||selectedAsset.type!=="image"||!imageRef.current||!canvasRef.current){setError("Select an image clip on the timeline before exporting a photo.");return;}
    const img=imageRef.current, canvas=canvasRef.current, maxSide=5000, k=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.round(img.naturalWidth*k);canvas.height=Math.round(img.naturalHeight*k);
    const ctx=canvas.getContext("2d");ctx.filter=filterCss;ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const title=clips.find(c=>c.type==="text"&&!c.hidden&&playhead>=c.start&&playhead<=c.start+c.duration);
    if(title){ctx.filter="none";ctx.fillStyle="#fff";ctx.font=`bold ${Math.max(24,canvas.width*.05)}px Arial`;ctx.textAlign="center";ctx.shadowColor="#000";ctx.shadowBlur=8;ctx.fillText(title.text||textValue,canvas.width/2,canvas.height*.85);}
    canvas.toBlob(blob=>{if(blob){downloadBlob(blob,"pixelcut-photo.png");setMessage("Photo exported as PNG.");}}, "image/png");
  };
  const downloadBlob=(blob,name)=>{const a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);};
  const exportVideo=async()=>{
    if(!selectedClip||!selectedAsset||selectedAsset.type!=="video"){setError("Select a video clip to export its trimmed segment.");return;}
    setBusy(true);setError("");setMessage("Preparing FFmpeg…");
    try{
      if(!ffmpegRef.current){
        const ff=new FFmpeg();ff.on("progress",({progress})=>setMessage(`Rendering selected clip… ${Math.round(Math.max(0,Math.min(1,progress))*100)}%`));
        const root="https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ff.load({coreURL:await toBlobURL(`${root}/ffmpeg-core.js`,"text/javascript"),wasmURL:await toBlobURL(`${root}/ffmpeg-core.wasm`,"application/wasm")});ffmpegRef.current=ff;
      }
      const ff=ffmpegRef.current, ext=(selectedAsset.name.split(".").pop()||"mp4").replace(/[^a-z0-9]/gi,"");
      await ff.writeFile(`in.${ext}`,await fetchFile(selectedAsset.file));
      const duration=Math.max(.1,selectedClip.duration);
      await ff.exec(["-ss",String(selectedClip.sourceIn||0),"-i",`in.${ext}`,"-t",String(duration),"-c:v","libx264","-preset","ultrafast","-c:a","aac","-movflags","+faststart","out.mp4"]);
      downloadBlob(new Blob([await ff.readFile("out.mp4")],{type:"video/mp4"}),"pixelcut-video-clip.mp4");setMessage("Selected video clip exported. Full timeline export is a future milestone.");
    }catch(e){setError(`Export failed: ${e?.message||"unknown error"}. Try a smaller MP4 in Chrome or Edge.`);setMessage("");}
    finally{setBusy(false);}
  };
  const exportProject=()=>{const data={app:"PixelCut Studio",version:2,ratio,clips:clips.map(({id,assetId,name,type,start,duration,sourceIn,track,hidden,locked,opacity,scale,text})=>({id,assetId,name,type,start,duration,sourceIn,track,hidden,locked,opacity,scale,text})),adjustments:{preset,brightness,contrast,saturation}};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),"pixelcut-project.json");setMessage("Project settings exported as JSON. Imported media files are not embedded.");};

  const previewClip=activeClip||selectedClip;
  const previewAsset=previewClip?assets.find(a=>a.id===previewClip.assetId):null;
  const aspect=ratio==="16:9"?"16 / 9":ratio==="9:16"?"9 / 16":"1 / 1";
  const selectAsset=asset=>{const found=clips.find(c=>c.assetId===asset.id);if(found){setSelected(found.id);setPlayhead(found.start);}else addToTimeline(asset,asset.type==="audio"?0:1);};

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="logo"><Sparkles size={18}/></div><div>pixelcut<span> studio</span><small>V2 · CREATIVE WORKSPACE</small></div></div>
      <div className="project-name"><span className="live-dot"/> Untitled project <span className="unsaved">Local project</span></div>
      <div className="top-actions"><button className="ghost" onClick={exportProject}><Download size={15}/> Project</button><button className="primary" onClick={()=>selectedAsset?.type==="image"?exportImage():exportVideo()} disabled={!selectedClip||busy}><Download size={15}/>{busy?"Rendering…":"Export"}</button></div>
    </header>

    <main className="workspace">
      <aside className={`media-panel ${mobilePanel==="media"?"mobile-active":""}`}>
        <div className="panel-top"><div><span className="kicker">PROJECT</span><h2>Media library</h2></div><button className="square" onClick={()=>inputRef.current?.click()} title="Import media"><Plus size={17}/></button></div>
        <button className="import-button" onClick={()=>inputRef.current?.click()}><Upload size={16}/> Import files <span>+</span></button>
        <div className="media-count">{assets.length} ASSETS</div>
        <div className="asset-list">{assets.map(a=><button key={a.id} className={`asset ${selectedAsset?.id===a.id?"asset-selected":""}`} onClick={()=>selectAsset(a)}>
          <div className="asset-thumb">{a.type==="image"?<img src={a.url} alt=""/>:a.type==="video"?<video src={a.url} muted/>:<Music2 size={20}/>}<span>{a.type==="video"?<Video size={12}/>:a.type==="image"?<ImageIcon size={12}/>:<Music2 size={12}/>}</span></div>
          <div className="asset-meta"><strong>{a.name}</strong><small>{a.type.toUpperCase()} · {(a.size/1048576).toFixed(1)} MB</small></div><button className="add-asset" onClick={e=>{e.stopPropagation();addToTimeline(a,a.type==="audio"?0:1)}} title="Add to timeline"><Plus size={15}/></button>
        </button>)}
        {!assets.length&&<button className="empty-assets" onClick={()=>inputRef.current?.click()}><Upload size={22}/><strong>Import your first media</strong><span>Photos, videos or audio</span></button>}</div>
        <div className="media-tip"><WandSparkles size={15}/><span>Tip: click the + button to add media to a timeline track.</span></div>
      </aside>

      <section className={`center ${mobilePanel==="preview"?"mobile-active":""}`}>
        <div className="preview-toolbar"><div className="toolbar-tabs"><button className={mobilePanel==="media"?"":"active"} onClick={()=>setMobilePanel("preview")}><Monitor size={14}/> Preview</button><button onClick={()=>setMobilePanel("media")}><ImageIcon size={14}/> Media</button></div><div className="preview-options"><select value={ratio} onChange={e=>setRatio(e.target.value)} aria-label="Canvas aspect ratio"><option>16:9</option><option>9:16</option><option>1:1</option></select><button className="square" title="Reset adjustments" onClick={()=>{setPreset("none");setBrightness(100);setContrast(100);setSaturation(100);}}><RotateCcw size={14}/></button></div></div>
        <div className="preview-wrap"><div className="preview-canvas" style={{aspectRatio:aspect}}>
          {previewAsset&&previewAsset.type==="image"&&<img ref={imageRef} className="preview-media" src={previewAsset.url} alt="Preview" style={{filter:filterCss,opacity:(previewClip?.opacity??100)/100,transform:`scale(${(previewClip?.scale??100)/100})`}}/>}
          {previewAsset&&previewAsset.type==="video"&&<video ref={videoRef} className="preview-media" src={previewAsset.url} controls={!playing} style={{filter:filterCss,opacity:(previewClip?.opacity??100)/100,transform:`scale(${(previewClip?.scale??100)/100})`}} onTimeUpdate={e=>{if(playing&&e.currentTarget.currentTime>=((previewClip?.sourceIn||0)+(previewClip?.duration||0))){e.currentTarget.pause();setPlaying(false);}}}/>}
          {previewAsset&&previewAsset.type==="audio"&&<div className="audio-preview"><Music2 size={42}/><strong>{previewAsset.name}</strong><span>Audio asset · add to audio track</span></div>}
          {!previewAsset&&<div className="preview-empty"><div className="empty-icon"><Layers size={25}/></div><h3>Your canvas is ready</h3><p>Import media, then add a clip to your timeline.</p><button className="primary" onClick={()=>inputRef.current?.click()}><Upload size={15}/> Import media</button></div>}
          {activeText&&<div className="canvas-title" style={{opacity:(activeText.opacity??100)/100}}>{activeText.text||textValue}</div>}
          <div className="canvas-ratio">{ratio}</div>
        </div></div>
        <div className="transport"><button className="transport-btn" onClick={()=>setPlayhead(0)} title="Go to start">|◀</button><button className="play-btn" onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={16}/>:<Play size={16} fill="currentColor"/>}</button><button className="transport-btn" onClick={()=>setPlayhead(Math.min(totalDuration,playhead+1))} title="Step forward">▶|</button><span className="timecode">{time(playhead)} <i>/</i> {time(totalDuration)}</span><div className="transport-spacer"/><button className="square" onClick={()=>setScale(s=>Math.max(.6,s-.1))}>−</button><span className="zoom-label">{Math.round(scale*100)}%</span><button className="square" onClick={()=>setScale(s=>Math.min(1.8,s+.1))}>+</button></div>
        <div className="statusline"><span><span className="live-dot"/> Ready</span><span>{clips.length} timeline clips · {assets.length} media assets</span>{message&&<span className="status-message">{message}</span>}</div>
      </section>

      <aside className={`inspector ${mobilePanel==="inspector"?"mobile-active":""}`}>
        <div className="inspector-head"><div><span className="kicker">INSPECTOR</span><h2>Properties</h2></div><Settings2 size={17}/></div>
        <div className="inspector-tabs"><button className={tab==="properties"?"active":""} onClick={()=>setTab("properties")}><SlidersHorizontal size={14}/> Edit</button><button className={tab==="layers"?"active":""} onClick={()=>setTab("layers")}><Layers size={14}/> Layers</button></div>
        {tab==="properties"? <div className="inspector-body">
          {selectedClip?<>
            <div className="selected-name"><div className="selected-type">{selectedClip.type==="image"?<ImageIcon size={17}/>:selectedClip.type==="video"?<Video size={17}/>:selectedClip.type==="text"?<Type size={17}/>:<Music2 size={17}/>}</div><div><strong>{selectedClip.name}</strong><small>Track {selectedClip.track} · {selectedClip.type}</small></div></div>
            <div className="prop-group"><div className="group-title">CLIP TIMING</div><Field label="Timeline start (s)" value={selectedClip.start} step="0.1" onChange={v=>updateClip(selectedClip.id,{start:Math.max(0,v)})}/><Field label="Duration (s)" value={selectedClip.duration} step="0.1" onChange={v=>updateClip(selectedClip.id,{duration:Math.max(.1,v)})}/>{selectedClip.type==="video"&&<Field label="Source in (s)" value={selectedClip.sourceIn||0} step="0.1" onChange={v=>updateClip(selectedClip.id,{sourceIn:Math.max(0,v)})}/>}</div>
            {selectedClip.type==="text"?<div className="prop-group"><div className="group-title">TEXT CONTENT</div><textarea value={selectedClip.text||""} onChange={e=>updateClip(selectedClip.id,{text:e.target.value})}/><p className="helper">Text overlay appears in the preview while its clip is active.</p></div>:null}
            <div className="prop-group"><div className="group-title">TRANSFORM & OPACITY</div><Range label="Scale" value={selectedClip.scale??100} min={20} max={200} onChange={v=>updateClip(selectedClip.id,{scale:v})}/><Range label="Opacity" value={selectedClip.opacity??100} min={0} max={100} onChange={v=>updateClip(selectedClip.id,{opacity:v})}/></div>
            {selectedClip.type==="image"||selectedClip.type==="video"?<div className="prop-group"><div className="group-title">COLOUR ADJUSTMENTS</div><div className="preset-grid">{PRESETS.map(p=><button key={p.name} className={`preset ${preset===p.css?"chosen":""}`} onClick={()=>setPreset(p.css)}><span className={`swatch ${p.name.toLowerCase().replace(/[^a-z]/g,"")}`}><span>Ab</span></span><small>{p.name}</small></button>)}</div><Range label="Brightness" value={brightness} min={0} max={200} onChange={setBrightness}/><Range label="Contrast" value={contrast} min={0} max={200} onChange={setContrast}/><Range label="Saturation" value={saturation} min={0} max={200} onChange={setSaturation}/><button className="secondary full" onClick={()=>{setPreset("none");setBrightness(100);setContrast(100);setSaturation(100);}}><RotateCcw size={13}/> Reset colour</button></div>:null}
            <div className="prop-actions"><button className="secondary" onClick={()=>duplicateClip(selectedClip)}><Copy size={14}/> Duplicate</button><button className="danger" onClick={()=>removeClip(selectedClip.id)}><Trash2 size={14}/> Delete</button></div>
          </>:<div className="no-selection"><Layers size={26}/><strong>No clip selected</strong><p>Select a clip on the timeline to edit its properties.</p><button className="secondary" onClick={()=>{setTab("layers");}}>View layers</button></div>}
          <div className="global-adjust"><div className="group-title">PHOTO EXPORT</div><p>Choose an image clip, set adjustments, then use Export to save a PNG. Video export currently renders the selected video clip only.</p></div>
        </div>:<div className="layers-panel"><div className="layers-top"><span>STACK ORDER</span><button className="square" onClick={()=>addText()}><Plus size={15}/></button></div>{sortedClips.map(c=><div key={c.id} className={`layer-row ${selected===c.id?"selected":""}`}><button className="layer-main" onClick={()=>{setSelected(c.id);setPlayhead(c.start);setTab("properties");}}><span className="layer-icon">{c.type==="text"?<Type size={15}/>:c.type==="video"?<Video size={15}/>:c.type==="audio"?<Music2 size={15}/>:<ImageIcon size={15}/>}</span><span className="layer-text"><strong>{c.name}</strong><small>Track {c.track} · {time(c.duration)}</small></span></button><button className="tiny-icon" title={c.hidden?"Show layer":"Hide layer"} onClick={()=>updateClip(c.id,{hidden:!c.hidden})}>{c.hidden?<EyeOff size={14}/>:<Eye size={14}/>}</button><button className="tiny-icon" title={c.locked?"Unlock layer":"Lock layer"} onClick={()=>updateClip(c.id,{locked:!c.locked})}>{c.locked?<Lock size={13}/>:<Unlock size={13}/>}</button></div>)}{!clips.length&&<p className="helper">Your timeline layers will appear here.</p>}</div>}
      </aside>

      <section className="timeline-editor">
        <div className="timeline-top"><div className="timeline-title"><Layers size={16}/><strong>Timeline</strong><span>{clips.length} clips</span></div><div className="timeline-tools"><button className="secondary" onClick={addText}><Type size={14}/> Add text</button><button className="secondary" onClick={()=>selectedClip&&duplicateClip(selectedClip)} disabled={!selectedClip}><Copy size={14}/> Duplicate</button><button className="square" onClick={exportProject} title="Save project JSON"><Download size={14}/></button></div></div>
        <div className="ruler-row"><div className="track-label-space">TRACKS</div><div className="ruler" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setPlayhead(Math.max(0,Math.min(totalDuration,((e.clientX-r.left)/r.width)*totalDuration)));}}>{Array.from({length:Math.ceil(totalDuration/5)+1},(_,i)=><span key={i} style={{left:`${i*5/totalDuration*100}%`}}>{time(i*5)}</span>)}<div className="playhead" style={{left:`${playhead/totalDuration*100}%`}}/></div></div>
        <div className="tracks-area">
          {[3,2,1,0].map(track=>{const label=track===3?"OVERLAYS":track===2?"VIDEO 2":track===1?"VIDEO 1":"AUDIO";return <div className="track-row" key={track}><div className="track-label"><span className={`track-dot t${track}`}/><span>{label}</span><button className="track-add" title={`Add to ${label}`} onClick={()=>inputRef.current?.click()}><Plus size={12}/></button></div><div className="track-content" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setPlayhead(Math.max(0,((e.clientX-r.left)/r.width)*totalDuration));}}>{clips.filter(c=>c.track===track).map(c=><div key={c.id} className={`clip ${c.type} ${selected===c.id?"clip-selected":""} ${c.hidden?"clip-hidden":""} ${c.locked?"clip-locked":""}`} style={{left:`${c.start/totalDuration*100}%`,width:`${Math.max(2,c.duration/totalDuration*100)}%`}} onClick={e=>{e.stopPropagation();setSelected(c.id);setPlayhead(c.start);setTab("properties");}} title={`${c.name} · ${time(c.duration)}`}><span className="clip-grip">⋮⋮</span><span className="clip-icon">{c.type==="text"?<Type size={12}/>:c.type==="video"?<Video size={12}/>:c.type==="audio"?<Music2 size={12}/>:<ImageIcon size={12}/>}</span><span className="clip-name">{c.name}</span><span className="clip-duration">{time(c.duration)}</span></div>)}{track===0&&clips.filter(c=>c.track===0).length===0&&<button className="track-empty" onClick={()=>inputRef.current?.click()}>+ Add audio</button>}{track===1&&clips.filter(c=>c.track===1).length===0&&<button className="track-empty" onClick={()=>inputRef.current?.click()}>+ Add video or photo</button>}{track===3&&clips.filter(c=>c.track===3).length===0&&<button className="track-empty" onClick={addText}>+ Add text overlay</button>}<div className="playhead" style={{left:`${playhead/totalDuration*100}%`}}/></div></div>})}
        </div>
        <div className="timeline-bottom"><div className="timeline-help"><Move size={13}/> Select clips to edit · use inspector for timing and layer controls</div><div className="timeline-bottom-actions"><button className="tiny-icon" disabled={!selectedClip} onClick={()=>moveClip(selectedClip.id,-1)} title="Move earlier"><ChevronUp size={15}/></button><button className="tiny-icon" disabled={!selectedClip} onClick={()=>moveClip(selectedClip.id,1)} title="Move later"><ChevronDown size={15}/></button><button className="tiny-icon" disabled={!selectedClip} onClick={()=>selectedClip&&removeClip(selectedClip.id)} title="Delete selected"><Trash2 size={14}/></button></div></div>
      </section>
    </main>
    <input ref={inputRef} hidden type="file" multiple accept="image/*,video/*,audio/*" onChange={e=>{importFiles(e.target.files||[]);e.target.value="";}}/>
    <canvas ref={canvasRef} hidden/>
    {error&&<div className="toast error-toast"><span>{error}</span><button onClick={()=>setError("")}>×</button></div>}
    {message&&<div className="toast"><span>{message}</span><button onClick={()=>setMessage("")}>×</button></div>}
    <nav className="mobile-nav"><button onClick={()=>setMobilePanel("media")} className={mobilePanel==="media"?"on":""}><ImageIcon size={17}/> Media</button><button onClick={()=>setMobilePanel("preview")} className={mobilePanel==="preview"?"on":""}><Monitor size={17}/> Preview</button><button onClick={()=>setMobilePanel("inspector")} className={mobilePanel==="inspector"?"on":""}><SlidersHorizontal size={17}/> Edit</button></nav>
  </div>;

  function addText(){
    const clip={id:makeId(),assetId:null,name:"Text overlay",type:"text",text:textValue,start:playhead,duration:3,sourceIn:0,track:3,hidden:false,locked:false,opacity:100,scale:100};
    setClips(p=>[...p,clip]);setSelected(clip.id);setTab("properties");setMessage("Text overlay added to the timeline.");
  }
}

function Field({label,value,onChange,step="1"}){return <label className="field"><span>{label}</span><input type="number" step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
function Range({label,value,min,max,onChange}){return <div className="range-control"><div><label>{label}</label><span>{Math.round(value)}{label==="Opacity"?"%":"%"}</span></div><input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/></div>}