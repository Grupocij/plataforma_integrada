import {getMessaging, getToken, deleteToken, onMessage, isSupported} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

export function instalarPushCIJ(app, setStatus) {
  const call = httpsCallable(getFunctions(app, 'us-central1'), 'cijGerenciarPush', {timeout:15000});
  const state = {uid:'', token:'', registered:false, messaging:null, pending:null, generation:0, paused:false};
  const timeout = (promise, ms=10000) => new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('O servidor demorou para responder. Tente novamente com internet.')),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
  const pausedKey=uid=>'cij-push-paused:'+uid;
  const readPaused=uid=>{try{return localStorage.getItem(pausedKey(uid))==='1';}catch(_){return false;}};
  const writePaused=value=>{state.paused=value;try{localStorage.setItem(pausedKey(state.uid),value?'1':'0');}catch(_){}};
  const button = active => {
    const el=document.getElementById('notif-enable-device'); if(!el)return;
    el.textContent=active?'Push ativo neste aparelho':'Ativar no dispositivo';
    el.classList.toggle('bg-emerald-600',active); el.classList.toggle('bg-blue-600',!active);
  };
  const worker = async () => {
    if(!('serviceWorker' in navigator))throw new Error('Este navegador não suporta avisos em segundo plano.');
    return timeout(navigator.serviceWorker.ready);
  };
  const setWorkerUser = async uid => {
    const reg=await worker();
    await timeout(new Promise((resolve,reject)=>{
      const channel=new MessageChannel();
      channel.port1.onmessage=e=>{channel.port1.close();e.data?.ok?resolve():reject(new Error('Atualize o app para ativar o push.'));};
      reg.active.postMessage({type:'CIJ_PUSH_USER',uid},[channel.port2]);
    }),5000);
    return reg;
  };
  const readyMessaging = async () => {
    if(!window.isSecureContext || !(await isSupported()))throw new Error('Este navegador não suporta push. No iPhone, instale o app na Tela de Início e abra pelo ícone.');
    if(!state.messaging){
      state.messaging=getMessaging(app);
      onMessage(state.messaging,async payload=>{
        if(!state.registered || payload.data?.uid!==state.uid)return;
        try{const reg=await worker(); reg.active?.postMessage({type:'CIJ_PUSH_SHOW',data:payload.data});}catch(e){console.warn('[CIJ] Aviso em primeiro plano',e);}
      });
    }
    return state.messaging;
  };
  const register = async () => {
    const generation=state.generation, uid=state.uid;
    if(!uid || state.paused)return;
    if(!navigator.onLine)throw new Error('Conecte-se à internet para cadastrar os avisos neste aparelho.');
    const cfg=(await call({action:'config'})).data;
    if(generation!==state.generation || uid!==state.uid)return;
    if(!cfg.enabled)throw new Error('O envio push ainda precisa ser ativado pela administração.');
    const messaging=await readyMessaging();
    if(generation!==state.generation || uid!==state.uid)return;
    const reg=await setWorkerUser(uid);
    const token=await getToken(messaging,{vapidKey:cfg.vapidKey,serviceWorkerRegistration:reg});
    if(!token)throw new Error('O navegador não forneceu o cadastro deste aparelho.');
    if(generation!==state.generation || uid!==state.uid)return;
    await call({action:'register',token});
    if(generation!==state.generation || uid!==state.uid)return;
    state.token=token; state.registered=true; button(true);
    setStatus('Aparelho cadastrado para receber avisos enviados pelo servidor.','ok');
  };
  const start = user => {
    const uid=user?.uid || '';
    if(uid!==state.uid){state.generation++;state.uid=uid;state.registered=false;state.token='';state.pending=null;state.paused=readPaused(uid);button(false);}
    setWorkerUser(state.paused?'':uid).catch(()=>{});
    if(uid && 'Notification' in window && Notification.permission==='granted' && !state.pending && !state.registered && !state.paused){
      state.pending=register().catch(e=>setStatus(e.message || 'Não foi possível cadastrar os avisos.','warning')).finally(()=>{state.pending=null;});
    }
  };
  window.cijIniciarPush=start;
  window.cijPushEstaAtivo=()=>state.registered && !!state.uid;
  window.cijPushAdminCall=async data=>(await call(data)).data;
  window.ativarNotificacoesDispositivo=async () => {
    if(!state.uid){setStatus('Entre com seu usuário para ativar os avisos.','warning');return;}
    if(!('Notification' in window)){setStatus('Este navegador não suporta notificações. No iPhone, abra o app instalado na Tela de Início.','error');return;}
    // A solicitação precisa acontecer diretamente no toque, especialmente no iOS.
    const permissionPromise=Notification.requestPermission();
    try {
      const permission=await permissionPromise;
      if(permission!=='granted'){setStatus(permission==='denied'?'Notificações bloqueadas. Libere a permissão nas configurações do navegador.':'Permissão não concedida.','warning');return;}
      writePaused(false);await register();
    } catch(e){button(false);setStatus(e.message || 'Falha ao ativar os avisos.','error');}
  };
  window.testarPushDispositivo=async()=>{
    try {
      if(!state.registered || !state.token)throw new Error('Ative os alertas neste aparelho primeiro.');
      await call({action:'test',token:state.token});
      setStatus('Teste enviado pelo servidor. Confira a notificação neste aparelho.','ok');
    }catch(e){setStatus(e.message || 'Falha ao enviar teste.','error');}
  };
  window.desativarPushDispositivo=async()=>{
    const token=state.token;writePaused(true); state.generation++;state.registered=false;button(false);
    await setWorkerUser('').catch(()=>{});
    if(token)await call({action:'unregister',token}).catch(()=>{});
    if(state.messaging)await timeout(deleteToken(state.messaging),5000).catch(()=>{});
    state.token='';setStatus('Avisos push desativados neste aparelho.','info');
  };
  window.addEventListener('online',()=>start({uid:state.uid}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && !state.registered)start({uid:state.uid});});
  // O estado anterior não deve ser usado enquanto o login atual está sendo validado.
  setWorkerUser('').catch(()=>{});
}
