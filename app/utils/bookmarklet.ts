// Bookmarklet "3tero" (ADR 0007): run on a MakerWorld model page, it reads the design with the
// user's own browser (same origin, challenge already passed as a person) and opens 3tero's /import
// with the data gzip-compressed in the URL fragment (#link=…&d=…).
// - A navigation, not a form: MakerWorld's CSP has `form-action 'self' https:`, which blocks posting
//   to 3tero over plain HTTP; CSP does not restrict top-level navigations.
// - The fragment never reaches any server (nor logs): /import decodes it and sends it to its own API.
// Errors navigate too (?link=…&error=…), so 3tero shows them inline instead of an alert on MakerWorld.
export function makerWorldBookmarklet(origin: string) {
  const target = JSON.stringify(`${origin}/import`)
  const code = `(async()=>{const go=x=>{location.href=${target}+x},p=new URLSearchParams({link:location.href});`
    + `const m=location.pathname.match(/\\/models\\/(\\d+)/);`
    + `try{if(!m)throw new Error('no es la página de un modelo');const api='/api/v1/design-service/design/'+m[1];p.set('raw',location.origin+api);`
    + `const r=await fetch(api,{headers:{accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);`
    + `const z=new Uint8Array(await new Response((await r.blob()).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());`
    + `let s='';for(let i=0;i<z.length;i+=8192)s+=String.fromCharCode.apply(null,z.subarray(i,i+8192));`
    + `p.set('d',btoa(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''));go('#'+p)}`
    + `catch(e){p.set('error','El navegador no pudo leer el modelo ('+(e&&e.message||e)+')');go('?'+p)}})()`
  return `javascript:${encodeURIComponent(code)}`
}

/** Inverse of the bookmarklet encoding: base64url → gunzip → design JSON text. */
export async function decodeBookmarkletData(data: string): Promise<string> {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
}
