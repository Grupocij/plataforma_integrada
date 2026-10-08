const SW_VERSION='3.15.6-legacy';
const APP_BUILD='1.79.4-legacy';

const CACHE_SHELL='portal-cij-unified-v3-shell-1.79.4-legacy';
const CACHE_RUNTIME='portal-cij-unified-v3-runtime-1.79.4-legacy';

const PORTAL_SHELL=[
  './central_cadastros.html',
  './cadastros_clientes.html',
  './cadastros_modelos.html',
  './cadastros_consumiveis.html',
  './erp-cadastros-v4-3-2.js',
  './erp-cadastros-v4-3-2.js?v=20261002-central1',
  './despesas.html',
  './despesas-v2.js?v=20261006-firebase1',
  './despesas-v2.css?v=20261002-2',
  './',
  './index.html',
  './core.js',
  './push-client.js',
  './push-client.js?v=20261001-push1',
  './push-configuracao.html',
  './core.js?v=20261001-push1',
  './core.js?v=20261002-central1',
  './core.js?v=20261006-mat1',
  './core.js?v=20261007-mat4',
  './certificacao.html',
  './padroes_teste.html',
  './cert_alertas.html',
  './certificacao.css',
  './certificacao-dados.js',
  './certificacao-offline.js',
  './certificacao-pdf.js',
  './certificacao.js',
  './certificacao-manifest.json',
  './central_os.html',
  './central-os.js',
  './central-os-dados.js',
  './central-os.css',
  './cliente_ficha.html',
  './parque_ficha.html',
  './manifest.json',
  './central_cadastros.html',
  './estoque_pecas.html',
  './suporte-mobile.html',
  './requisicao_material.html',
  './comissoes_beta.html',
  './parque_consulta.html',
  './cadastros_clientes.html',
  './cadastros_modelos.html',
  './cadastros_pecas.html',
  './cadastros_consumiveis.html',
  './parque_maquinas.html',
  './erp-cadastros-v4-3.css',
  './erp-cadastros-v4-3-2.js'
];

const ASSISTENCIA_SHELL=[
  './assistencia.html',
  './materiais-os.js?v=1.79.4',
  './materiais-os.css?v=1.79.4',
  './assistencia-manifest-v4.json',
  './assistencia-icon-192.png',
  './assistencia-icon-512.png'
];

async function cacheOne(cache,url){
  try{
    const response=await fetch(url,{cache:'reload'});
    if(response&&(response.ok||response.type==='opaque')){
      await cache.put(url,response.clone());
      return true;
    }
  }catch(_){}
  return false;
}

async function cacheShell(){
  const cache=await caches.open(CACHE_SHELL);
  for(const url of [...PORTAL_SHELL,...ASSISTENCIA_SHELL]){
    await cacheOne(cache,url);
  }
}

self.addEventListener('install',event=>{
  event.waitUntil(cacheShell());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    const obsolete=keys.filter(k=>{
      if([CACHE_SHELL,CACHE_RUNTIME].includes(k))return false;
      return k.startsWith('portal-cij-')||
             k.startsWith('cij-assistencia-tecnico-');
    });
    await Promise.all(obsolete.map(k=>caches.delete(k)));
    await self.clients.claim();

    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(client=>{
      try{client.postMessage({type:'SW_ACTIVATED',version:SW_VERSION,build:APP_BUILD})}catch(_){}
    });
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};


  if(data.type==='CERT_CACHE_OFFLINE'){
    event.waitUntil((async()=>{
      const cache=await caches.open(CACHE_SHELL);
      const missing=[];
      for(const url of ['./core.js?v=20261006-mat1','./push-client.js?v=20261001-push1','./certificacao.html','./padroes_teste.html','./cert_alertas.html','./certificacao.css?v=1.1.0','./certificacao-dados.js?v=1.1.0','./certificacao-offline.js?v=1.1.0','./certificacao-pdf.js?v=1.1.0','./certificacao.js?v=1.1.0','./certificacao-manifest.json'])if(!await cacheOne(cache,url))missing.push(url);
      const runtime=await caches.open(CACHE_RUNTIME);
      for(const url of ['https://cdn.tailwindcss.com/','https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js'])if(!await cacheOne(runtime,url))missing.push(url);
      for(const url of ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css','https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-solid-900.woff2','https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-regular-400.woff2'])await cacheOne(runtime,url);
      try{event.ports?.[0]?.postMessage({ok:missing.length===0,missing});}catch(_){}
    })());
    return;
  }

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

function isFirebaseApi(url){
  return url.hostname==='firestore.googleapis.com'||
         url.hostname==='identitytoolkit.googleapis.com'||
         url.hostname==='securetoken.googleapis.com'||
         url.hostname==='firebaseinstallations.googleapis.com';
}

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

async function networkFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(_){
    // core.js é publicado com query string de versão. Em offline, uma versão
    // armazenada sem a query precisa continuar atendendo o módulo ES.
    return (await cache.match(request))||
           (await caches.match(request))||
           (await (await caches.open(CACHE_SHELL)).match(request,{ignoreSearch:true}))||
           (await cache.match(request,{ignoreSearch:true}))||
           (await caches.match(request,{ignoreSearch:true}))||
           null;
  }
}

async function navigationFallback(request){
  const url=new URL(request.url);
  const isAssistencia=url.pathname.endsWith('/assistencia.html')||
      url.pathname.endsWith('/central_os.html')||
      url.pathname.endsWith('/central-os.js')||
      url.pathname.endsWith('/central-os-dados.js')||
      url.pathname.endsWith('/central-os.css')||
      url.pathname.endsWith('/erp-cadastros-v4-3-2.js')||
                      url.searchParams.get('modo')==='tecnico'||
                      url.searchParams.get('app')==='tecnico';

  const cache=await caches.open(CACHE_SHELL);

  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      await cache.put(request,response.clone()).catch(()=>{});
      return response;
    }
  }catch(_){}

  const exact=(await caches.match(request))||(await caches.match(request,{ignoreSearch:true}));
  if(exact)return exact;

  if(isAssistencia){
    const app=await caches.match('./assistencia.html');
    if(app)return app;
  }

  const index=await caches.match('./index.html')||await caches.match('./');
  if(index)return index;

  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal CIJ</title><body style="font-family:system-ui;padding:24px"><h2>Portal CIJ</h2><p>Este dispositivo ainda não possui a página necessária armazenada para uso offline. Conecte-se à internet e abra o módulo uma vez.</p></body>',
    {headers:{'Content-Type':'text/html; charset=utf-8'}}
  );
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);

  // APIs do Firebase continuam sob responsabilidade do SDK.
  if(isFirebaseApi(url))return;

  if(request.mode==='navigate'){
    event.respondWith(navigationFallback(request));
    return;
  }

  if(url.origin===self.location.origin){
    const critical=
      url.pathname.endsWith('/core.js')||
      /\/(certificacao(?:-(?:dados|offline|pdf))?\.js|certificacao\.css|certificacao-manifest\.json|certificacao\.html|padroes_teste\.html|cert_alertas\.html)$/.test(url.pathname)||
      url.pathname.endsWith('/push-client.js')||
      url.pathname.endsWith('/push-configuracao.html')||
      url.pathname.endsWith('/assistencia.html')||
      url.pathname.endsWith('/central_os.html')||
      url.pathname.endsWith('/central-os.js')||
      url.pathname.endsWith('/central-os-dados.js')||
      url.pathname.endsWith('/central-os.css')||
      url.pathname.endsWith('/erp-cadastros-v4-3-2.js')||
      url.pathname.endsWith('/assistencia-manifest-v4.json')||
      url.pathname.endsWith('/manifest.json');

    if(critical){
      event.respondWith((async()=>{
        const response=await networkFirst(request,CACHE_RUNTIME);
        if(response)return response;

        // core.js e manifests também podem estar no shell.
        const shell=await caches.match(request);
        return shell||Response.error();
      })());
      return;
    }

    event.respondWith(staleWhileRevalidate(request,CACHE_RUNTIME));
    return;
  }

  if(isStaticCrossOrigin(url)){
    event.respondWith(staleWhileRevalidate(request,CACHE_RUNTIME));
  }
});


// V1.76 — abertura de alertas do Portal e preparação para Web Push
self.addEventListener('notificationclick',event=>{
  event.notification?.close();
  const target=event.notification?.data?.url||'./index.html';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const candidate=new URL(target,self.registration.scope);
    const url=candidate.origin===self.location.origin ? candidate.href : new URL('./index.html',self.registration.scope).href;
    for(const c of windows){try{if(new URL(c.url).origin===self.location.origin){await c.focus();if('navigate'in c)await c.navigate(url);return}}catch(_){}}
    if(self.clients.openWindow)return self.clients.openWindow(url);
  })());
});

// Um só worker cuida de cache offline, push e abertura da OS.
const PUSH_DB='cij-push-worker-v1';
let pushQueue=Promise.resolve();
function pushStorage(mode, run){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(PUSH_DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('state',mode),store=tx.objectStore('state');
      let result;try{result=run(store)}catch(e){db.close();reject(e);return;}
      tx.oncomplete=()=>{db.close();resolve(result?.result)};
      tx.onerror=()=>{db.close();reject(tx.error)};
    };
  });
}
const pushRead=key=>pushStorage('readonly',s=>s.get(key));
const pushWrite=(key,value)=>pushStorage('readwrite',s=>s.put(value,key));
function showCIJPush(d){
  const task=async()=>{
    if(d.cijPush!=='1' || !d.uid || d.uid!==await pushRead('uid'))return;
    const id=String(d.notificationId||''), seen=await pushRead('seen')||[];
    if(id && seen.includes(id))return;
    const tipo=String(d.tipo||'info'),danger=tipo==='danger',vibrate=danger?[350,120,350,120,650]:tipo==='warning'?[250,100,250]:[180,90,180];
    const candidate=new URL(d.url||'./index.html',self.registration.scope);
    const url=candidate.origin===self.location.origin?candidate.href:new URL('./index.html',self.registration.scope).href;
    await self.registration.showNotification(danger?`URGENTE · ${d.title||'Portal CIJ'}`:(d.title||'Portal CIJ'),{
      body:d.body||'Você possui um novo aviso.',icon:'./assistencia-icon-192.png',badge:'./assistencia-icon-192.png',
      tag:d.tag||id||undefined,renotify:false,silent:false,vibrate,requireInteraction:danger,
      data:{url,notificationId:id,tipo}
    });
    if(id)await pushWrite('seen',[...seen,id].slice(-200));
  };
  pushQueue=pushQueue.catch(()=>{}).then(task);return pushQueue;
}
self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='CIJ_PUSH_USER')event.waitUntil(pushWrite('uid',String(d.uid||'')).then(()=>event.ports?.[0]?.postMessage({ok:true})).catch(()=>event.ports?.[0]?.postMessage({ok:false})));
  if(d.type==='CIJ_PUSH_SHOW')event.waitUntil(showCIJPush(d.data||{}));
});
let cijMessagingReady=false;
try{
  // Compat mantém o worker clássico, sem criar outro escopo de cache.
  importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js','https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');
  firebase.initializeApp({apiKey:'AIzaSyDW05GuYDxXUCmtWfSxhfap1-l6_qkNspw',authDomain:'plataforma-cij.firebaseapp.com',projectId:'plataforma-cij',storageBucket:'plataforma-cij.firebasestorage.app',messagingSenderId:'949985395100',appId:'1:949985395100:web:cf881e0c91c63175228859'});
  firebase.messaging().onBackgroundMessage(payload=>showCIJPush(payload.data||{}));
  cijMessagingReady=true;
}catch(e){console.warn('[CIJ] Push SDK indisponível; cache offline preservado.',e)}
self.addEventListener('push',event=>{
  if(cijMessagingReady)return; // O SDK já trata a mensagem, evitando dois avisos.
  let payload;try{payload=event.data?.json()}catch(_){return;}
  event.waitUntil(showCIJPush(payload?.data||payload||{}));
});
