import { useEffect, useRef, useState } from 'react'

export default function ChatWidget(){
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msgs, setMsgs] = useState([])
  const inputRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(()=>{ if(open) inputRef.current?.focus() },[open])
  useEffect(()=>{ bodyRef.current && (bodyRef.current.scrollTop = bodyRef.current.scrollHeight) }, [msgs])

  async function send(e){
    e.preventDefault()
    const q = inputRef.current.value.trim(); if(!q) return
    setMsgs(m=>[...m,{role:'user',content:q}]); inputRef.current.value=''; setLoading(true)
    try{
      const res = await fetch('/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: q, topK:5 }) })
      const data = await res.json()
      setMsgs(m=>[...m,{role:'assistant',content:data.answer || 'Sin respuesta'}])
    }catch(err){ setMsgs(m=>[...m,{role:'assistant',content:'Error de servidor'}]) }
    finally{ setLoading(false) }
  }

  return (
    <>
      <button className="btn" style={{position:'fixed',right:16,bottom:16,zIndex:40}} onClick={()=>setOpen(v=>!v)}>Chat IA</button>
      {open && (
        <div style={{position:'fixed',right:16,bottom:74,width:'min(400px,92vw)',maxHeight:'70vh',display:'flex',flexDirection:'column',background:'#0f1530',border:'1px solid rgba(255,255,255,.1)',borderRadius:14,overflow:'hidden',zIndex:40}}>
          <div style={{padding:'10px 12px',background:'rgba(255,255,255,.06)',display:'flex',justifyContent:'space-between'}}>
            <strong>Solverive Assistant</strong>
            <button onClick={()=>setOpen(false)}>✕</button>
          </div>
          <div ref={bodyRef} style={{padding:12,overflow:'auto',display:'flex',flexDirection:'column',gap:10}}>
            {msgs.map((m,i)=> (
              <div key={i} style={{alignSelf: m.role==='user'?'flex-end':'flex-start', background: m.role==='user'?'#1b2142':'#11162a', border:'1px solid rgba(255,255,255,.1)', padding:10, borderRadius:10}}>{m.content}</div>
            ))}
            {loading && <div className="card">Pensando…</div>}
          </div>
          <form onSubmit={send} style={{display:'flex',gap:8,padding:12,borderTop:'1px solid rgba(255,255,255,.1)'}}>
            <input ref={inputRef} placeholder="Preguntá sobre la empresa…" style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#e5e7eb'}} />
            <button className="btn" type="submit">Enviar</button>
          </form>
        </div>
      )}
    </>
  )
}
