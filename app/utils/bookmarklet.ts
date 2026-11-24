// Bookmarklet "3tero" (ADR 0007): run on a MakerWorld model page, it reads the design with the
// user's own browser (same origin, challenge already passed as a person) and opens 3tero's /import
// with the data in the URL fragment: #link=…&d=<gzip+base64url> (or &j=<base64url> when the
// browser has no CompressionStream).
// - A navigation, not a form: MakerWorld's CSP has `form-action 'self' https:`, which blocks posting
//   to 3tero over plain HTTP; CSP does not restrict top-level navigations.
// - The fragment never reaches any server (nor logs): /import decodes it and sends it to its own API.
// - A status box on the MakerWorld page tells what happens step by step (reading, size, opening 3tero
//   or the error) and has an "Abrir 3tero" button, in case the automatic navigation does nothing
//   (seen on a tablet). Errors open 3tero with ?link=…&error=… so the user can paste the data.
export function makerWorldBookmarklet(origin: string) {
  const target = JSON.stringify(`${origin}/import`)
  const code = String.raw`(async()=>{const T=${target},d=document,b=d.createElement('div'),`
    + String.raw`say=(t,c,w)=>{const e=d.createElement('div');e.textContent=t;e.style.cssText='margin:4px 0;color:'+(c||'#0F1712')+(w?';font-weight:700':'');b.appendChild(e)},`
    + String.raw`btn=(t,h)=>{const a=d.createElement('a');a.textContent=t;a.href=h;a.style.cssText='display:inline-block;margin:8px 0 0;padding:8px 16px;border-radius:999px;background:#15803D;color:#fff;font-weight:600;text-decoration:none';b.appendChild(a)};`
    + String.raw`b.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;right:12px;max-width:460px;margin:0 auto;padding:14px 16px;background:#fff;color:#0F1712;border:2px solid #15803D;border-radius:16px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)';`
    + String.raw`const x=d.createElement('button');x.textContent='×';x.setAttribute('aria-label','Cerrar');x.style.cssText='float:right;border:0;background:none;font-size:24px;line-height:1;color:#56635B';x.onclick=()=>b.remove();b.appendChild(x);`
    + String.raw`say('3tero · importar de MakerWorld','#15803D',1);d.body.appendChild(b);`
    + String.raw`const p=new URLSearchParams({link:location.href}),m=location.pathname.match(/\/models\/(\d+)/);`
    + String.raw`try{if(!m)throw new Error('esta no es la página de un modelo');`
    + String.raw`const api='/api/v1/design-service/design/'+m[1];p.set('raw',location.origin+api);say('Leyendo el modelo '+m[1]+'…');`
    + String.raw`const r=await fetch(api,{headers:{accept:'application/json'}});if(!r.ok)throw new Error('MakerWorld responde HTTP '+r.status);`
    + String.raw`const t=await r.text();say('Datos leídos: '+Math.round(t.length/1024)+' KB');`
    + String.raw`let z=new TextEncoder().encode(t),k='j';`
    + String.raw`if(typeof CompressionStream=='function'){z=new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());k='d'}`
    + String.raw`else say('Este navegador no comprime: se envían sin comprimir','#B45309');`
    + String.raw`let s='';for(let i=0;i<z.length;i+=8192)s+=String.fromCharCode.apply(null,z.subarray(i,i+8192));`
    + String.raw`p.set(k,btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));const u=T+'#'+p;`
    + String.raw`say('Abriendo 3tero ('+Math.round(u.length/1024)+' KB)…','#15803D');btn('Abrir 3tero',u);`
    + String.raw`setTimeout(()=>{location.href=u},700);setTimeout(()=>say('Si 3tero no se abre solo, toca «Abrir 3tero».','#56635B'),4000)}`
    + String.raw`catch(e){const msg=String(e&&e.message||e);say('Error: '+msg,'#B91C1C');`
    + String.raw`p.set('error','El navegador no pudo leer el modelo ('+msg+')');btn('Abrir 3tero para pegar los datos',T+'?'+p)}})()`
  return `javascript:${encodeURIComponent(code)}`
}

/** Inverse of the bookmarklet encoding: base64url (gzip-compressed unless `compressed` is false) → JSON text. */
export async function decodeBookmarkletData(data: string, compressed = true): Promise<string> {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  if (!compressed) return new TextDecoder().decode(bytes)
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
}
