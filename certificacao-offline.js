/* IndexedDB por conta; numeração por aparelho; sincronização com revisão otimista. */
(function(w){
 'use strict';
 const D=w.CertDados,BASE=['artifacts','plataforma-cij','public','data'];let dbPromise,syncPromise;
 const uid=()=>String(w.currentUser?.uid||''),key=id=>uid()+'|'+id;
 const notify=()=>w.dispatchEvent(new Event('cert-repo-changed'));
 function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('cij-certificacao-v1',1);r.onupgradeneeded=()=>{for(const n of ['meta','records','queue','cache','files'])r.result.createObjectStore(n,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
 async function get(store,k){const b=await db();return new Promise((res,rej)=>{const r=b.transaction(store).objectStore(store).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
 async function put(store,value){const b=await db();return new Promise((res,rej)=>{const tx=b.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>res(value);tx.onerror=()=>rej(tx.error);});}
 async function all(store){const b=await db();return new Promise((res,rej)=>{const r=b.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result.filter(x=>x.uid===uid()));r.onerror=()=>rej(r.error);});}
 const doc=(col,id)=>w.fsDoc(w.AppDB,...BASE,col,id);
 const collection=col=>w.fsCollection(w.AppDB,...BASE,col);
 const audit=()=>({uid:uid(),email:w.currentUser?.email||'',nome:w.nomeUsuarioLogado||w.userProfile?.nome||'',at:new Date().toISOString()});
 function session(userId){if(!userId||uid()!==userId)throw new Error('A sessão mudou. Entre novamente para continuar.');}
 const uuid=()=>crypto.randomUUID();
 async function cache(name,data){return put('cache',{key:key(name),uid:uid(),data,at:new Date().toISOString()});}
 async function cached(name){return (await get('cache',key(name)))?.data||[];}
 async function fetchCollection(name){
  let q=collection(name);
  if(name==='certificacoes'){
   const p=w.userProfile||{},mods=p.modulos||[],master=p.perfil==='Master',rows=[];
   for(const type of ['EQUIPAMENTO','PADRAO']){
    const module=type==='PADRAO'?'padroes_teste.html':'certificacao.html';if(!master&&!mods.includes(module))continue;
    const global=master||p.visaoGlobalPorTela?.[module]===true||['revisar','aprovar','emitir','enviar','faturar'].some(k=>D.can(p,k,type));
    const clauses=[w.fsWhere('type','==',type)];if(!global)clauses.push(w.fsWhere('ownerUid','==',uid()));
    const snap=await (w.fsGetDocsFromServer||w.fsGetDocs)(w.fsQuery(q,...clauses));if(snap.metadata?.fromCache)throw new Error('A consulta não foi confirmada pelo servidor.');snap.forEach(d=>rows.push({...d.data(),id:d.id}));
   }
   return rows;
  }
  const snap=await (w.fsGetDocsFromServer||w.fsGetDocs)(q);if(snap.metadata?.fromCache)throw new Error('A consulta não foi confirmada pelo servidor.');const rows=[];snap.forEach(d=>rows.push({...d.data(),id:d.id}));return rows;
 }
 async function settings(fresh=false){if(fresh&&navigator.onLine!==false){const s=await (w.fsGetDocFromServer||w.fsGetDoc)(doc('cert_config','geral'));await cache('config',s.exists()?s.data():{});}const v=await cached('config');return Array.isArray(v)?{}:v;}
 async function registerDevice(){
  const user=uid();session(user);const old=await get('meta',key('device'));if(old?.value?.code&&Number.isSafeInteger(old.value.seq))return old.value;
  if(navigator.onLine===false)throw new Error('Prepare este aparelho com internet uma vez antes de iniciar os serviços offline.');
  const id=uuid(),ref=doc('cert_dispositivos',id),counter=doc('cert_contadores','dispositivos'),who=audit();
  const device=await w.fsRunTransaction(w.AppDB,async tx=>{
   const c=await tx.get(counter),n=Number(c.exists()?c.data().value:0)+1;if(!Number.isSafeInteger(n)||n<1)throw new Error('Contador de aparelhos inválido.');
   const d={id,code:n,ownerUid:user,ownerEmail:who.email,createdAtISO:who.at};
   tx.set(counter,{value:n,updatedByUid:user});tx.set(ref,d);return {...d,seq:0};
  });
  session(user);await put('meta',{key:key('device'),uid:user,value:device});return device;
 }
 async function newRecord(type){
  if(!D.can(w.userProfile,'preencher',type))throw new Error('Sem permissão para iniciar este serviço.');
  const user={uid:uid(),email:w.currentUser?.email||''};session(user.uid);await registerDevice();const b=await db();
  const entry=await new Promise((resolve,reject)=>{
   const tx=b.transaction(['meta','records','queue'],'readwrite'),m=tx.objectStore('meta').get(key('device'));let result;
   m.onsuccess=()=>{
    try{session(user.uid);const device=m.result?.value;if(!device?.code||!Number.isSafeInteger(device.seq))throw new Error('Aparelho não preparado.');
     const seq=device.seq+1;if(!Number.isSafeInteger(seq))throw new Error('Sequência do aparelho esgotada.');device.seq=seq;
     const record=D.make(type,uuid(),device,seq,user),op={key:key(record.id),uid:user.uid,id:uuid(),kind:'cert',baseRevision:0,record:D.clone(record),event:'CRIADO',at:Date.now()};
     result={key:op.key,uid:user.uid,record,serverRevision:0,dirty:true,error:'',conflict:false};
     tx.objectStore('meta').put({...m.result,value:device});tx.objectStore('records').put(result);tx.objectStore('queue').put(op);
    }catch(e){reject(e);tx.abort();}
   };
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Não foi possível reservar o número.'));
  });notify();return entry;
 }
 async function entries(){return (await all('records')).sort((a,b)=>b.record.createdAtISO.localeCompare(a.record.createdAtISO));}
 async function entry(id){return get('records',key(id));}
 async function saveLocal(record,action='save'){
  const user=uid();session(user);const b=await db();
  const result=await new Promise((resolve,reject)=>{
   const tx=b.transaction(['records','queue'],'readwrite'),r=tx.objectStore('records').get(key(record.id));let value;
   r.onsuccess=()=>{try{
    session(user);const old=r.result;if(!old||old.conflict)throw new Error('Este registro precisa ser conferido antes de continuar.');
    if(old.record.status!=='RASCUNHO'||record.status!=='RASCUNHO')throw new Error('Este serviço já foi encaminhado para revisão.');
    const draft=D.clone(old.record);draft.data=D.readings(D.clone(record.data));draft.status=D.nextStatus(draft,action,w.userProfile);draft.updatedAtISO=new Date().toISOString();draft.updatedByUid=user;draft.updatedByEmail=w.currentUser?.email||'';
    value={...old,record:draft,dirty:true,error:''};const op={key:old.key,uid:user,id:uuid(),kind:'cert',baseRevision:old.serverRevision,record:D.clone(draft),event:action==='ready'?'SERVICO_PRONTO':'PREENCHIMENTO',at:Date.now()};
    tx.objectStore('records').put(value);tx.objectStore('queue').put(op);
   }catch(e){reject(e);tx.abort();}};
   tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Falha ao salvar no aparelho.'));
  });notify();return result;
 }
 function eventFor(record,event,who,revision,config){
  const names={SERVICO_PRONTO:'Serviço pronto para revisão',APROVADO:'Certificado aprovado',EMITIDO:'PDF do certificado emitido',ENVIADO:'Certificado enviado ao cliente',LIBERADO_FATURAR:'Serviço liberado para faturamento'};
  if(!names[event])return null;
  const setor=event==='SERVICO_PRONTO'||event==='APROVADO'?'INTERNO':event==='EMITIDO'?'COMERCIAL':'FATURAMENTO';
  return {id:record.id+'_'+revision,certificateId:record.id,numero:record.numero,cliente:record.data.clienteNome||'',osId:record.data.osId||'',osNumero:record.data.osNumero||'',event:event==='SERVICO_PRONTO'?'PRONTO':event,setor,titulo:names[event],createdAtISO:who.at,createdByUid:who.uid,revision,
   targetEmails:(config.destinatarios?.[setor]||[]).map(x=>String(x).toLowerCase().trim()).filter(Boolean)};
 }
 function writeEvent(tx,record,before,event,who,config){
  tx.set(w.fsDoc(w.AppDB,...BASE,'certificacoes',record.id,'historico','r'+record.revision),{revision:record.revision,event,actorUid:who.uid,actorEmail:who.email,actorName:who.nome,createdAtISO:who.at,beforeStatus:before?.status||'',afterStatus:record.status,beforeData:before?.data||{},afterData:record.data,beforeVisible:before?.visible||{},afterVisible:record.visible,internalNotes:record.internalNotes||''});
  const alert=eventFor(record,event,who,record.revision,config);if(!alert)return;
  tx.set(doc('cert_alertas',alert.id),alert);
  // A central de alertas funciona mesmo sem destinatários; o sino exige e-mails configurados.
  if(alert.targetEmails.length)tx.set(doc('notificacoes_app','cert_'+alert.id),{id:'cert_'+alert.id,titulo:alert.titulo,mensagem:record.numero+' · '+alert.cliente,targetEmails:alert.targetEmails,targetUids:[],targetProfiles:[],broadcast:false,tipo:'info',modulo:'cert_alertas.html',url:'cert_alertas.html?cert='+encodeURIComponent(record.id),actionLabel:'Ver certificado',osId:alert.osId,osNumber:alert.osNumero,eventType:'CERT_'+event,sourceId:record.id,dedupeKey:'cert_'+alert.id,createdAtISO:who.at,createdByEmail:who.email,createdByName:who.nome,timestamp:Date.parse(who.at)});
 }
 async function sync(){
  if(syncPromise)return syncPromise;if(navigator.onLine===false)return {synced:0};
  syncPromise=(async()=>{
   const user=uid(),operations=(await all('queue')).sort((a,b)=>a.at-b.at);if(!operations.length)return {synced:0};const config=await settings(true);let synced=0;
   for(const op of operations){
    session(user);if(op.kind!=='cert')continue;
    const local=await entry(op.record.id);if(local?.conflict)continue;
    try{
     const who=audit();const result=await w.fsRunTransaction(w.AppDB,async tx=>{
      const ref=doc('certificacoes',op.record.id),snap=await tx.get(ref),remote=snap.exists()?snap.data():null;
      if(remote?.lastMutationId===op.id)return remote;
      if((remote?.revision||0)!==op.baseRevision)throw Object.assign(new Error('O servidor tem uma versão diferente. Compare os dados antes de continuar.'),{code:'cert/conflict'});
      if(remote&&remote.status!=='RASCUNHO')throw Object.assign(new Error('O registro já está em revisão no servidor.'),{code:'cert/conflict'});
      const claim=await tx.get(doc('cert_numeros',op.record.numero));if(claim.exists()&&claim.data().certificateId!==op.record.id)throw Object.assign(new Error('Número já utilizado por outro registro. O número da etiqueta foi preservado para conferência.'),{code:'cert/conflict'});
      const rec={...D.clone(op.record),revision:(remote?.revision||0)+1,lastMutationId:op.id,updatedAtISO:who.at,updatedByUid:user,updatedByEmail:who.email};
      if(rec.status==='PRONTO'){const errors=D.validate(rec);if(errors.length)throw new Error('Preencha: '+errors.join(', '));}
      let newPark=null,osEquipmentRef=null;
      if(rec.status==='PRONTO'&&rec.type==='EQUIPAMENTO'&&rec.data.cadastrarEquipamento&&!rec.data.equipamentoId&&!rec.data.equipamentoOSId){
       const pid='cert_'+rec.id,parkSnap=await tx.get(doc('parque_maquinas',pid));
       if(!parkSnap.exists())newPark={id:pid,internalId:pid,clienteId:rec.data.clienteId,clienteNome:rec.data.clienteNome,modelo:rec.data.modelo||rec.data.equipamento,fabricante:rec.data.marca,marca:rec.data.marca,numeroSerie:rec.data.numeroSerie,identificacaoLocal:rec.data.tag||'',ativo:true,createdAtISO:who.at,criadoPorUid:user,origemCertificado:rec.id};
       rec.data.equipamentoId=pid;
       if(rec.data.osId){const osSnap=await tx.get(doc('os_ordens',rec.data.osId));if(!osSnap.exists()||String(osSnap.data().clienteId||'')!==String(rec.data.clienteId))throw new Error('Confira o cliente da OS antes de cadastrar o equipamento.');osEquipmentRef=w.fsDoc(w.AppDB,...BASE,'os_ordens',rec.data.osId,'equipamentos',pid);rec.data.equipamentoOSId=pid;}
      }
      if(!claim.exists())tx.set(doc('cert_numeros',rec.numero),{numero:rec.numero,certificateId:rec.id,ownerUid:rec.ownerUid});
      if(newPark)tx.set(doc('parque_maquinas',newPark.id),newPark);
      if(osEquipmentRef)tx.set(osEquipmentRef,{id:rec.data.equipamentoId,internalId:rec.data.equipamentoId,parqueId:rec.data.equipamentoId,tipo:'PARQUE',modelo:rec.data.modelo||rec.data.equipamento,marca:rec.data.marca,numeroSerie:rec.data.numeroSerie,identificacaoLocal:rec.data.tag||'',statusEquipamento:'PENDENTE',createdAtISO:who.at,createdByUid:user,origemCertificado:rec.id});
      tx.set(ref,rec);writeEvent(tx,rec,remote,op.event,who,config);return rec;
     });
     session(user);await finishSync(op,result);synced++;
    }catch(e){
     const current=await entry(op.record.id);if(current)await put('records',{...current,error:e.message||String(e),conflict:e.code==='cert/conflict'});
     if(e.code!=='cert/conflict')break;
    }
   }
   notify();return {synced};
  })().finally(()=>{syncPromise=null;});return syncPromise;
 }
 function listen(onError=console.warn){
  const user=uid(),p=w.userProfile||{},mods=p.modulos||[],master=p.perfil==='Master',unsubs=[];
  function watch(q,handle){unsubs.push(w.fsOnSnapshot(q,snap=>{if(uid()!==user||snap.metadata?.fromCache)return;const rows=[];snap.forEach(d=>rows.push({...d.data(),id:d.id}));Promise.resolve(handle(rows)).then(notify).catch(onError);},onError));}
  for(const type of ['EQUIPAMENTO','PADRAO']){const module=type==='PADRAO'?'padroes_teste.html':'certificacao.html';if(!master&&!mods.includes(module))continue;const global=master||p.visaoGlobalPorTela?.[module]===true||['revisar','aprovar','emitir','enviar','faturar'].some(k=>D.can(p,k,type)),clauses=[w.fsWhere('type','==',type)];if(!global)clauses.push(w.fsWhere('ownerUid','==',user));watch(w.fsQuery(collection('certificacoes'),...clauses),mergeRemote);}
  watch(collection('cert_padroes'),rows=>cache('padroes',rows));watch(collection('cert_alertas'),rows=>cache('alertas',rows));return ()=>unsubs.forEach(fn=>fn());
 }
 async function finishSync(op,remote){
  const b=await db();return new Promise((resolve,reject)=>{
   const tx=b.transaction(['records','queue'],'readwrite'),q=tx.objectStore('queue').get(op.key);
   q.onsuccess=()=>{const latest=q.result;
    if(!latest||latest.id===op.id){tx.objectStore('queue').delete(op.key);tx.objectStore('records').put({key:op.key,uid:op.uid,record:remote,serverRevision:remote.revision,dirty:false,error:'',conflict:false});}
    else{latest.baseRevision=remote.revision;latest.record.revision=remote.revision;tx.objectStore('queue').put(latest);tx.objectStore('records').put({key:op.key,uid:op.uid,record:latest.record,serverRevision:remote.revision,dirty:true,error:'',conflict:false});}
   };tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
 }
 async function mergeRemote(records){
  for(const rec of records){const old=await entry(rec.id);if(old?.dirty)continue;await put('records',{key:key(rec.id),uid:uid(),record:rec,serverRevision:rec.revision,dirty:false,error:'',conflict:false});}
 }
 async function refresh(){
  if(navigator.onLine===false)return;
  const user=uid();const results=await Promise.all([fetchCollection('certificacoes'),fetchCollection('cert_padroes'),fetchCollection('cert_alertas')]);session(user);
  await mergeRemote(results[0]);await cache('padroes',results[1]);await cache('alertas',results[2]);notify();
 }
 async function prepare(progress=()=>{}){
  const user=uid();if(navigator.onLine===false)throw new Error('Conecte à internet para preparar o aparelho.');
  progress('Preparando o aparelho…');const device=D.can(w.userProfile,'preencher')||D.can(w.userProfile,'preencher','PADRAO')?await registerDevice():{code:0};
  const resources=[['clientes','cadastros_clientes'],['equipamentos','parque_maquinas'],['os','os_ordens'],['padroes','cert_padroes'],['executantes','usuarios_permissoes'],['alertas','cert_alertas'],['certificacoes','certificacoes']];
  for(const [name,col] of resources){progress('Baixando '+name+'…');const rows=await fetchCollection(col);session(user);if(name==='certificacoes')await mergeRemote(rows);else await cache(name,rows);}
  const activeOS=(await cached('os')).filter(o=>o.is_deleted!==true&&!['ENCERRADOS','ENCERRADO','CANCELADO'].includes(o.status)),items=[];
  let cursor=0;await Promise.all(Array.from({length:Math.min(3,activeOS.length)},async()=>{while(cursor<activeOS.length){const os=activeOS[cursor++];progress('Preparando equipamentos da '+(os.osNumber||os.numero||'OS')+'…');const snap=await (w.fsGetDocsFromServer||w.fsGetDocs)(w.fsCollection(w.AppDB,...BASE,'os_ordens',os.id,'equipamentos'));snap.forEach(d=>{const item=d.data();if(item.is_deleted!==true&&item.ativo!==false)items.push({...item,id:d.id,osId:os.id});});}}));
  session(user);const activeIDs=new Set(activeOS.map(o=>o.id));await cache('os_equipamentos',[...(await cached('os_equipamentos')).filter(x=>!activeIDs.has(x.osId)),...items]);
  const configDoc=await (w.fsGetDocFromServer||w.fsGetDoc)(doc('cert_config','geral'));session(user);await cache('config',configDoc.exists()?configDoc.data():{});
  let unavailable=0;for(const p of await cached('padroes')){
   if(!p.certStoragePath)continue;progress('Preparando documento de '+p.nome+'…');
   try{const blob=await w.fbGetBlob(w.fbStorageRef(w.AppStorage,p.certStoragePath),10*1024*1024);session(user);await put('files',{key:key('padrao:'+p.id+':'+p.revision),uid:user,blob});}catch(_){unavailable++;}
  }
  try{await navigator.storage?.persist?.();}catch(_){}
  // O worker único mantém o formulário e suas dependências locais para reabertura offline.
  if(navigator.serviceWorker){
   progress('Preparando a reabertura offline…');const reg=await navigator.serviceWorker.ready;
   await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('A preparação das páginas não terminou. Mantenha a internet e tente Preparar offline novamente.')),30000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.ok?resolve():reject(new Error('Alguns arquivos do módulo não foram preparados. Atualize o app com internet e tente novamente.'));};reg.active.postMessage({type:'CERT_CACHE_OFFLINE'},[channel.port2]);});
  }
  session(user);await put('meta',{key:key('prepared'),uid:user,value:{at:new Date().toISOString(),unavailable,deviceCode:device.code}});
  notify();return {device,unavailable};
 }
 async function transition(id,action,patch={}){
  if(navigator.onLine===false)throw new Error('Revisão, emissão e etapas internas exigem internet.');
  const user=uid(),local=await entry(id);if(!local||local.dirty||local.conflict)throw new Error('Sincronize o registro antes de executar esta ação.');
  const who=audit(),config=await settings(true),mutation=uuid();
  const record=await w.fsRunTransaction(w.AppDB,async tx=>{
   const ref=doc('certificacoes',id),snap=await tx.get(ref);if(!snap.exists())throw new Error('Certificado não encontrado.');const before={...snap.data(),id};
   if(before.revision!==local.serverRevision)throw Object.assign(new Error('O certificado foi alterado por outra pessoa. Atualize a consulta.'),{code:'cert/conflict'});
   const next=D.clone(before);if(['review','approve'].includes(action)&&Object.keys(patch).length){
    if(!D.can(w.userProfile,'revisar',before.type))throw new Error('Sem permissão para editar a revisão.');
    if(patch.data)next.data=D.readings(D.clone(patch.data));if(patch.visible)next.visible=D.clone(patch.visible);
    for(const k of ['internalNotes','titulo','dataEmissao','issuer','documentRevision'])if(patch[k]!==undefined)next[k]=D.clone(patch[k]);
   }
   next.status=D.nextStatus(next,action,w.userProfile);next.revision=before.revision+1;next.updatedAtISO=who.at;next.updatedByUid=user;next.updatedByEmail=who.email;next.lastMutationId=mutation;
   if(action==='return'&&patch.internalNotes!==undefined)next.internalNotes=D.text(patch.internalNotes);
   if(['review','return'].includes(action)){next.approvedByUid='';next.approvedAtISO='';next.pdf=null;}
   if(action==='approve'){next.approvedByUid=user;next.approvedAtISO=who.at;next.approvedByName=who.nome;}
   if(action==='issue'){if(!patch.pdf?.storagePath||!patch.pdf?.sha256)throw new Error('O PDF precisa ser gerado e arquivado antes da emissão.');next.pdf=patch.pdf;next.issuedAtISO=who.at;}
   if(action==='sent'){next.sentAtISO=who.at;next.sentByUid=user;next.sentVia=D.text(patch.sentVia);}
   if(action==='bill'){next.billingReleasedAtISO=who.at;next.billingReleasedByUid=user;}
   const event={review:'REVISAO',approve:'APROVADO',return:'DEVOLVIDO',issue:'EMITIDO',sent:'ENVIADO',bill:'LIBERADO_FATURAR',cancel:'CANCELADO'}[action];
   // A referência do banco acompanha o PDF emitido do padrão do cliente.
   let bank,beforeBank;if(action==='issue'&&next.type==='PADRAO'){
    const bid=next.data.padraoAlvoId||next.id;const bankSnap=await tx.get(doc('cert_padroes',bid));beforeBank=bankSnap.exists()?bankSnap.data():{};
    bank={...beforeBank,id:bid,nome:next.data.equipamento,marca:next.data.marca,numeroSerie:next.data.numeroSerie,material:next.data.material||'',diametro:next.data.diametroNominal||'',formato:next.data.formato||'',clienteId:next.data.clienteId||'',clienteNome:next.data.clienteNome,proprietario:'CLIENTE',ativo:true,certNumero:next.numero,certEmissor:next.issuer?.nome||'Grupo CIJ Soluções Industriais',certData:next.data.dataServico||next.dataEmissao||D.today(),validade:next.data.proximaAvaliacao||'',certURL:next.pdf.url,certStoragePath:next.pdf.storagePath,sourceCertificateId:next.id,revision:Number(beforeBank.revision||0)+1,updatedAtISO:who.at,updatedByUid:user};
   }
   tx.set(ref,next);writeEvent(tx,next,before,event,who,config);if(bank)tx.set(doc('cert_padroes',bank.id),bank);
   return next;
  });session(user);await put('records',{key:key(id),uid:user,record,serverRevision:record.revision,dirty:false,error:'',conflict:false});notify();return record;
 }
 async function savePattern(pattern){
  if(!D.can(w.userProfile,'gerenciar_padroes','PADRAO'))throw new Error('Sem permissão para administrar o banco de padrões.');
  if(navigator.onLine===false)throw new Error('O cadastro do banco de padrões exige internet. Você pode informar o padrão manualmente no serviço offline.');
  if(!D.text(pattern.nome))throw new Error('Informe a identificação do padrão.');
  const user=uid(),who=audit(),id=pattern.id||uuid();
  const result=await w.fsRunTransaction(w.AppDB,async tx=>{
   const ref=doc('cert_padroes',id),snap=await tx.get(ref),old=snap.exists()?snap.data():{};
   if(pattern.id&&Number(old.revision||0)!==Number(pattern.revision||0))throw new Error('Este padrão foi alterado. Atualize a consulta.');
   const next={...D.clone(pattern),id,revision:Number(old.revision||0)+1,updatedAtISO:who.at,updatedByUid:user};
   tx.set(ref,next);tx.set(w.fsDoc(w.AppDB,...BASE,'cert_padroes',id,'historico','r'+next.revision),{revision:next.revision,actorUid:user,actorName:who.nome,createdAtISO:who.at,before:old,after:next});return next;
  });session(user);const rows=await cached('padroes');await cache('padroes',[...rows.filter(p=>p.id!==id),result]);notify();return result;
 }
 async function saveSettings(config){
  if(!D.can(w.userProfile,'configurar')&&!D.can(w.userProfile,'configurar','PADRAO'))throw new Error('Sem permissão para configurar.');
  if(navigator.onLine===false)throw new Error('A configuração exige internet.');
  await w.fsSetDoc(doc('cert_config','geral'),{...config,updatedByUid:uid(),updatedAtISO:new Date().toISOString()});await cache('config',config);notify();
 }
 async function history(id){const rows=[];const snap=await w.fsGetDocs(w.fsCollection(w.AppDB,...BASE,'certificacoes',id,'historico'));snap.forEach(d=>rows.push({...d.data(),id:d.id}));return rows.sort((a,b)=>b.revision-a.revision);}
 async function backup(){return {schema:1,exportedAtISO:new Date().toISOString(),uid:uid(),device:(await get('meta',key('device')))?.value,records:await entries(),queue:await all('queue'),conflictCopies:(await all('cache')).filter(x=>x.key.includes('|conflict-copy:'))};}
 async function adoptServer(id){
  const old=await entry(id);if(!old?.conflict)throw new Error('Nenhum conflito para resolver.');
  const snap=await (w.fsGetDocFromServer||w.fsGetDoc)(doc('certificacoes',id));if(!snap.exists())throw new Error('Registro não encontrado no servidor. Mantenha a cópia local para conferência.');
  const remote={...snap.data(),id};await put('cache',{key:key('conflict-copy:'+id+':'+Date.now()),uid:uid(),data:old.record});
  const b=await db();await new Promise((res,rej)=>{const tx=b.transaction(['records','queue'],'readwrite');tx.objectStore('queue').delete(key(id));tx.objectStore('records').put({key:key(id),uid:uid(),record:remote,serverRevision:remote.revision,dirty:false,conflict:false,error:''});tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});notify();return remote;
 }
 w.CertRepo={get,put,all,key,doc,cached,settings,registerDevice,newRecord,entries,entry,saveLocal,sync,refresh,prepare,transition,savePattern,saveSettings,history,backup,adoptServer,listen};
})(window);
