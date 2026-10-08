const SW_VERSION='4.1.0';
const APP_BUILD='1.64';
const CACHE_SHELL='cij-assistencia-tecnico-v4-shell';
const CACHE_RUNTIME='cij-assistencia-tecnico-v4-runtime';
const SHELL=[
  './assistencia.html',
  './core.js',
  './assistencia-manifest-v4.json',
  './assistencia-icon-192.png',
  './assistencia-icon-512.png'
];

async function cacheShell(){
  const cache=await caches.open(CACHE_SHELL);
  for(const url of SHELL){
    try{
      const response=await fetch(url,{cache:'reload'});
      if(response&&(response.ok||response.type==='opaque'))await cache.put(url,response.clone());
    }catch(_){}
  }
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheShell());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys
      .filter(k=>k.startsWith('cij-assistencia-tecnico-')&&![CACHE_SHELL,CACHE_RUNTIME].includes(k))
      .map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(client=>client.postMessage({type:'SW_ACTIVATED',version:SW_VERSION,build:APP_BUILD}));
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(data.type==='GET_VERSION'){
    const payload={type:'SW_VERSION',version:SW_VERSION,build:APP_BUILD};
    try{
      if(event.ports&&event.ports[0])event.ports[0].postMessage(payload);
      else event.source?.postMessage(payload);
    }catch(_){}
    return;
  }
  if(data.type==='CACHE_CURRENT_PAGE'&&data.url){
    event.waitUntil((async()=>{
      try{
        const response=await fetch(data.url,{cache:'reload'});
        if(response&&response.ok){
          const cache=await caches.open(CACHE_SHELL);
          await cache.put(data.url,response.clone());
        }
      }catch(_){}
    })());
  }
});

function isStaticCrossOrigin(url){
  return [
    'cdn.tailwindcss.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'www.gstatic.com',
    'cdn.jsdelivr.net',
    'esm.sh',
    'unpkg.com'
  ].includes(url.hostname);
}

async function staleWhileRevalidate(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  const network=fetch(request).then(response=>{
    if(response&&(response.ok||response.type==='opaque')){
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }).catch(()=>null);
  return cached||await network||Response.error();
}

async function networkFirst(request,cacheName,fallbackRequest=null){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(_){
    const cached=await cache.match(request);
    if(cached)return cached;
    if(fallbackRequest){
      const fallback=await caches.match(fallbackRequest);
      if(fallback)return fallback;
    }
    return null;
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const response=await networkFirst(request,CACHE_SHELL,'./assistencia.html');
      if(response)return response;
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CIJ Técnico</title><body style="font-family:system-ui;padding:24px"><h2>CIJ Técnico</h2><p>Este aparelho ainda não possui uma versão completa do aplicativo armazenada para uso offline.</p></body>',
        {headers:{'Content-Type':'text/html; charset=utf-8'}}
      );
    })());
    return;
  }

  if(url.origin===self.location.origin){
    const critical=url.pathname.endsWith('/core.js')||
      url.pathname.endsWith('/assistencia-manifest-v4.json')||
      url.pathname.endsWith('/assistencia.html');
    if(critical){
      event.respondWith((async()=>{
        const response=await networkFirst(request,CACHE_RUNTIME);
        return response||Response.error();
      })());
    }else{
      event.respondWith(staleWhileRevalidate(request,CACHE_RUNTIME));
    }
    return;
  }

  if(isStaticCrossOrigin(url)){
    event.respondWith(staleWhileRevalidate(request,CACHE_RUNTIME));
  }
});
