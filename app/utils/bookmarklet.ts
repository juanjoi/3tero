// Bookmarklet "3tero" (ADR 0007): run on a MakerWorld model page, it reads the design with the
// user's own browser (same origin, challenge already passed as a person) and posts it to 3tero,
// which builds the draft server side. A top-level form POST: no CORS involved, no popup.
// Errors are posted too, so 3tero shows them inline instead of an alert on MakerWorld.
export function makerWorldBookmarklet(origin: string) {
  const action = JSON.stringify(`${origin}/import/browser`)
  const code = `(async()=>{const f=document.createElement('form'),s=(k,v)=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;f.appendChild(i)};`
    + `f.method='POST';f.action=${action};f.acceptCharset='UTF-8';s('url',location.href);`
    + `try{const m=location.pathname.match(/\\/models\\/(\\d+)/);if(!m)throw new Error('no es la página de un modelo');`
    + `const r=await fetch('/api/v1/design-service/design/'+m[1],{headers:{accept:'application/json'}});`
    + `if(!r.ok)throw new Error('HTTP '+r.status);s('payload',await r.text())}`
    + `catch(e){s('error',String(e&&e.message||e))}document.body.appendChild(f);f.submit()})()`
  return `javascript:${encodeURIComponent(code)}`
}
