import { useEffect, useState, useMemo } from "react"
import { Search, Command as CmdIcon, Heart, Calculator, GraduationCap, Layers, Sparkles, Printer, Star, Clock, X } from "lucide-react"
import { Command } from "cmdk"

// (protocols.json shape is handled by vanilla script.js; React palette uses regions/modes)

export default function App() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("atlas:favs")
      return raw ? JSON.parse(raw) : ["Head", "Chest"]
    } catch { return ["Head", "Chest"] }
  })
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("atlas:recent")
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [doseWeight, setDoseWeight] = useState(70)
  const [doseMgPerKg, setDoseMgPerKg] = useState(300)
  const [egfr, setEgfr] = useState(90)

  const totalMgI = useMemo(() => Math.round(doseWeight * doseMgPerKg), [doseWeight, doseMgPerKg])
  const volume350 = useMemo(() => (totalMgI / 350).toFixed(1), [totalMgI])
  const volume400 = useMemo(() => (totalMgI / 400).toFixed(1), [totalMgI])
  const gdRisk = egfr < 30 ? "High — avoid Gd, consult nephrology" : egfr < 45 ? "Moderate — hydrate, limit dose" : "Low — standard Gd 0.1 mmol/kg"

  useEffect(() => { localStorage.setItem("atlas:favs", JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem("atlas:recent", JSON.stringify(recent.slice(0, 6))) }, [recent])

  // Load vanilla 3D engine after React mounts the shell
  useEffect(() => {
    const scripts = [
      "assets/vendor/three.min.js",
      "assets/vendor/OrbitControls.js",
      "assets/vendor/GLTFLoader.js",
      "assets/vendor/tween.umd.js",
      "assets/anatomy.js",
      "assets/script.js",
    ]
    let cancelled = false
    async function load() {
      for (const src of scripts) {
        if (cancelled) return
        // skip if already loaded (HMR)
        if (document.querySelector(`script[src="${src}"]`)) continue
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script")
          s.src = src
          s.async = false
          s.onload = () => resolve()
          s.onerror = () => reject(new Error(`Failed ${src}`))
          document.body.appendChild(s)
        })
      }
    }
    load().catch(console.error)
    return () => { cancelled = true }
  }, [])

  // Global hotkeys: Ctrl/Cmd+K palette, / focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        document.getElementById("search-bar")?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const toggleFav = (region: string) => {
    setFavorites(f => f.includes(region) ? f.filter(x => x !== region) : [...f, region])
  }

  const pushRecent = (region: string) => {
    setRecent(r => [region, ...r.filter(x => x !== region)].slice(0, 6))
  }

  // Wrap vanilla's region tabs to also track recent/favs
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e.target as HTMLElement).closest(".region-tab") as HTMLElement | null
      if (btn?.dataset.region) pushRecent(btn.dataset.region)
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  return (
    <>
      {/* React overlays + enhanced chrome (viewer still driven by vanilla) */}
      <div id="app-shell">
        <header id="app-header" role="banner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span className="mark-ring"></span>
              <span className="mark-cross"></span>
            </div>
            <div className="brand-text">
              <span className="brand-title">ATLAS</span>
              <span className="brand-sub">Radiology • v1.3 Hybrid</span>
            </div>
            <span className="ml-2 hidden sm:inline-flex items-center gap-1 text-[10px] tracking-widest uppercase px-2 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-300">Hybrid SPA</span>
          </div>

          <div className="header-center">
            <div id="mode-toolbar" role="toolbar" aria-label="Imaging modality">
              <button className="mode-btn active" data-mode="XRAY">X-RAY <span className="key-hint">1</span></button>
              <button className="mode-btn" data-mode="CT">CT <span className="key-hint">2</span></button>
              <button className="mode-btn" data-mode="MRI">MRI <span className="key-hint">3</span></button>
              <button className="mode-btn" data-mode="ANGIO">ANGIO <span className="key-hint">4</span></button>
              <button className="mode-btn" data-mode="US">US <span className="key-hint">5</span></button>
              <button className="mode-btn" data-mode="DEXA">DEXA <span className="key-hint">6</span></button>
            </div>
            <div id="ct-chips" aria-label="CT tissue layers">
              <button className="layer-chip" data-layer="bone">BONE</button>
              <button className="layer-chip" data-layer="soft">SOFT</button>
              <button className="layer-chip" data-layer="vess">VESSELS</button>
            </div>
          </div>

          <div className="header-actions">
            <button className="icon-btn" onClick={() => setCmdOpen(true)} title="Command palette (Ctrl+K)">
              <CmdIcon size={14} /> <span className="hidden sm:inline"> palette</span> <span className="ml-1 text-[10px] border border-white/10 rounded px-1 py-0.5">⌘K</span>
            </button>
            <button id="auto-rotate" className="icon-btn" title="Toggle auto-rotate" aria-pressed="false">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v5h-5"/></svg>
              <span>Spin</span>
            </button>
            <button id="reset-view" className="icon-btn" title="Reset view (R)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 3v6h6"/></svg>
              <span>Reset</span>
            </button>
            <button id="settings-btn" className="icon-btn" title="Settings">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            </button>
          </div>
        </header>

        <div id="app-container">
          <div id="viewer-panel">
            <div id="canvas-container"></div>
            <div className="viewer-frame" aria-hidden="true">
              <span className="corner tl"></span><span className="corner tr"></span>
              <span className="corner bl"></span><span className="corner br"></span>
              <span className="crosshair"></span>
            </div>
            <div id="scanner-line"></div>
            <div id="scanner-hud">
              <span className="hud-text">MODE: X-RAY</span>
              <span className="hud-text right" id="target-lock">NO TARGET</span>
            </div>
            <div className="hud-legend" aria-hidden="true">
              <span className="dot"></span> Click structure · Double-click fly in · <strong>R</strong> reset · <strong>1–6</strong> modality · <strong>/</strong> search · <strong>⌘K</strong> palette
            </div>
            <div id="tooltip"></div>

            {/* React HUD extras: favorites + quick dose */}
            <div className="absolute left-3 top-3 z-[5] hidden lg:flex flex-col gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[rgba(7,15,30,.72)] border border-white/10 backdrop-blur text-[11px] text-white/70">
                <Sparkles size={12} className="text-cyan-300" /> Hybrid React + vanilla • offline
              </div>
            </div>
          </div>

          <div id="info-panel">
            <div className="header">
              <div className="header-title">
                <h1>Protocol Atlas</h1>
                <p>Procedure · imaging & positioning — click anatomy or pick a region. <span className="text-cyan-300">v1.3</span> adds dose, palette, favorites & teach.</p>
              </div>

              {/* Enhanced search + palette hint */}
              <div className="search-container search-wrap">
                <Search size={16} className="search-icon" />
                <input type="text" id="search-bar" placeholder="Search protocols, structures, indications…" autoComplete="off" value={query} onChange={e => {
                  setQuery(e.target.value)
                  // forward to vanilla handler
                  const ev = new Event("input", { bubbles: true })
                  Object.defineProperty(ev, "target", { value: e.target })
                  e.target.dispatchEvent(ev)
                }} />
                <button onClick={() => setCmdOpen(true)} className="search-kbd hidden sm:flex items-center gap-1">
                  <CmdIcon size={10} />K
                </button>
              </div>

              {/* Favorites / Recent bento */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-white/50 mb-1.5"><Star size={12} className="text-amber-400" /> Favorites</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Head","Neck","Chest","Abdomen","Spine","UpperLimb","LowerLimb"].map(r => (
                      <button key={r} onClick={() => { toggleFav(r); pushRecent(r); (window as any).__triggerRegion?.(r) || document.querySelector(`[data-region="${r}"]`)?.dispatchEvent(new MouseEvent("click",{bubbles:true})) }} className={`px-2.5 py-1 rounded-full text-xs border ${favorites.includes(r) ? "bg-cyan-400 text-[#02101c] border-cyan-300" : "bg-white/5 text-white/60 border-white/10 hover:text-white"}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-white/50 mb-1.5"><Clock size={12} className="text-white/50" /> Recent</div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {recent.length ? recent.map(r => (
                      <button key={r} onClick={() => document.querySelector(`[data-region="${r}"]`)?.dispatchEvent(new MouseEvent("click",{bubbles:true}))} className="px-2.5 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white/70 hover:text-white">{r}</button>
                    )) : <span className="text-xs text-white/30">No recent</span>}
                  </div>
                </div>
              </div>

              <nav id="region-tabs" aria-label="Body regions" className="mt-3">
                {["Head","Neck","Chest","Abdomen","Spine","UpperLimb","LowerLimb"].map(r => (
                  <button key={r} className={`region-tab ${favorites.includes(r) ? "ring-1 ring-amber-300/30" : ""}`} data-region={r} onClick={() => pushRecent(r)}>{r.replace("UpperLimb","Upper Limb").replace("LowerLimb","Lower Limb")}</button>
                ))}
              </nav>

              {/* Action bar: print + quiz + layers */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white"><Printer size={12} /> Print cards</button>
                <button onClick={() => alert("Teach mode: spotlight + quiz coming — try clicking a bone then double-click to fly in. Next build adds guided tours.")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400/15 border border-cyan-300/30 text-xs text-cyan-200"><GraduationCap size={12} /> Teach tour</button>
                <button onClick={() => document.getElementById("settings-btn")?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"><Layers size={12} /> Layers & quality</button>
              </div>
            </div>

            {/* Vanilla content-display + React dose panel injected */}
            <div id="content-display">
              <div className="empty-state">
                <div className="empty-card">
                  <div className="empty-medal" aria-hidden="true">
                    <svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="7"/><path d="M12 17 10 28l6-4 6 4-2-11"/></svg>
                  </div>
                  <h3>Select a region to begin</h3>
                  <p>Pick a body region above, or click any bone, organ or vessel in the viewer.</p>
                  <div className="empty-hints">
                    <span><strong>Click</strong> for sheet</span>
                    <span><strong>Double-click</strong> to fly in</span>
                    <span className="hidden sm:inline-flex"><strong>⌘K</strong> palette</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dose / contrast bento — always visible */}
            <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-transparent to-violet-500/10 p-3">
              <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-white/60 mb-2"><Calculator size={12} className="text-cyan-300" /> Contrast & dose quick calc <span className="ml-auto text-[10px] normal-case tracking-normal px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-300/20">offline • no PHI</span></div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-xs text-white/60">Wt (kg)<input type="range" min={30} max={120} value={doseWeight} onChange={e => setDoseWeight(parseInt(e.target.value))} className="accent-cyan-400" /><span className="font-mono text-white">{doseWeight} kg</span></label>
                <label className="flex flex-col gap-1 text-xs text-white/60">mgI/kg<input type="range" min={250} max={400} step={10} value={doseMgPerKg} onChange={e => setDoseMgPerKg(parseInt(e.target.value))} className="accent-cyan-400" /><span className="font-mono text-white">{doseMgPerKg}</span></label>
                <label className="flex flex-col gap-1 text-xs text-white/60">eGFR<input type="range" min={10} max={120} value={egfr} onChange={e => setEgfr(parseInt(e.target.value))} className="accent-cyan-400" /><span className="font-mono text-white">{egfr}</span></label>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5"><div className="text-white/50">Total iodine</div><div className="font-mono text-white font-semibold">{totalMgI} mgI</div></div>
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5"><div className="text-white/50">Vol 350 / 400 mgI/mL</div><div className="font-mono text-white font-semibold">{volume350} / {volume400} mL</div></div>
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5"><div className="text-white/50">Gd risk</div><div className={`font-medium ${egfr<30?"text-red-300":egfr<45?"text-amber-300":"text-emerald-300"}`}>{gdRisk}</div></div>
              </div>
              <div className="mt-2 text-[11px] text-white/40">Tip: CTA head 60–70 mL @ 4–5 mL/s, trigger 150 HU. Abdominal portal 70 s. Adjust per protocol card.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings dialog (vanilla expects hidden) */}
      <div id="settings-panel" className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
        <div className="settings-backdrop" tabIndex={-1}></div>
        <div className="settings-card">
          <header className="settings-header">
            <h2 id="settings-title">Settings</h2>
            <button id="settings-close" className="icon-btn" aria-label="Close settings"><X size={14} /></button>
          </header>
          <div className="settings-body">
            <section className="settings-section">
              <h3>Rendering</h3>
              <div className="setting-row"><label>Quality</label><select id="quality-preset"><option value="high">High (64 seg)</option><option value="medium">Medium (32 seg)</option><option value="low">Low (16 seg)</option></select></div>
              <div className="setting-row"><label>Antialiasing</label><input type="checkbox" id="aa-toggle" defaultChecked /></div>
              <div className="setting-row"><label>Tone Mapping</label><select id="tonemap-select"><option value="aces">ACES Filmic</option><option value="reinhard">Reinhard</option><option value="cineon">Cineon</option><option value="none">None</option></select></div>
              <div className="setting-row"><label>Exposure</label><input type="range" id="exposure-slider" min={0.5} max={2.0} step={0.05} defaultValue={1.12} /><span id="exposure-value">1.12</span></div>
            </section>
            <section className="settings-section">
              <h3>CT Layers</h3>
              <div className="setting-row"><label>Bone</label><input type="checkbox" id="ct-bone" defaultChecked /></div>
              <div className="setting-row"><label>Soft Tissue</label><input type="checkbox" id="ct-soft" defaultChecked /></div>
              <div className="setting-row"><label>Vessels</label><input type="checkbox" id="ct-vess" defaultChecked /></div>
            </section>
          </div>
        </div>
      </div>

      {/* Command palette */}
      <Command.Dialog open={cmdOpen} onOpenChange={setCmdOpen} label="Atlas palette" className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-[640px] rounded-2xl border border-white/10 bg-[#0b1426] shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <Search size={14} className="text-white/40" />
            <Command.Input autoFocus placeholder="Search protocols, regions, structures… (try chest, stroke, CTA)" className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30" />
            <span className="text-[10px] border border-white/10 rounded px-1.5 py-0.5 text-white/30">ESC</span>
          </div>
          <Command.List className="max-h-[380px] overflow-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-white/40">No results.</Command.Empty>
            <Command.Group heading="Regions" className="text-[11px] tracking-widest uppercase text-white/40 px-2 py-1">
              {["Head","Neck","Chest","Abdomen","Spine","UpperLimb","LowerLimb"].map(r => (
                <Command.Item key={r} onSelect={() => { setCmdOpen(false); pushRecent(r); document.querySelector(`[data-region="${r}"]`)?.dispatchEvent(new MouseEvent("click",{bubbles:true})) }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/5 hover:text-white cursor-pointer">
                  <Heart size={12} className="text-cyan-300" /> {r} {favorites.includes(r) && <Star size={10} className="ml-auto text-amber-300" />}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Modes" className="text-[11px] tracking-widest uppercase text-white/40 px-2 py-1 mt-2">
              {["XRAY","CT","MRI","ANGIO","US","DEXA"].map(m => (
                <Command.Item key={m} onSelect={() => { setCmdOpen(false); document.querySelector(`[data-mode="${m}"]`)?.dispatchEvent(new MouseEvent("click",{bubbles:true})) }} className="px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/5 cursor-pointer">{m}</Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className="text-[11px] tracking-widest uppercase text-white/40 px-2 py-1 mt-2">
              <Command.Item onSelect={() => { setCmdOpen(false); document.getElementById("auto-rotate")?.click() }} className="px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/5 cursor-pointer">Toggle spin</Command.Item>
              <Command.Item onSelect={() => { setCmdOpen(false); window.print() }} className="px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/5 cursor-pointer">Print protocol cards</Command.Item>
              <Command.Item onSelect={() => { setCmdOpen(false); document.getElementById("settings-btn")?.click() }} className="px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/5 cursor-pointer">Open settings</Command.Item>
            </Command.Group>
          </Command.List>
          <div className="px-3 py-2 border-t border-white/10 text-[11px] text-white/30 flex items-center gap-2">
            <span className="inline-flex items-center gap-1"><span className="border border-white/10 rounded px-1">↑↓</span> navigate</span>
            <span className="inline-flex items-center gap-1"><span className="border border-white/10 rounded px-1">↵</span> select</span>
            <span className="ml-auto">Hybrid v1.3 • offline</span>
          </div>
        </div>
      </Command.Dialog>
    </>
  )
}
