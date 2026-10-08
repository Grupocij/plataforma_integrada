// Cadastros V4.3.3 — compatibilidade Firebase 1.79.1
window.ERPDB={clientes:[],modelos:[],pecas:[],consumiveis:[],parque:[],os:[],osr:[],movimentos:[]};
window.ERPUI={page:document.body.dataset.erpPage||'',editing:null,material:null,pendingPhoto:null,removePhoto:false,maquina:null,
pagination:{
  clientes:{page:1,size:10},
  modelos:{page:1,size:10},
  pecas:{page:1,size:10},
  consumiveis:{page:1,size:10},
  parque:{page:1,size:10}
}};

const EROOT=['artifacts','plataforma-cij','public','data'];
const eCol=n=>window.fsCollection(window.AppDB,...EROOT,n);
const eDoc=(n,id)=>window.fsDoc(window.AppDB,...EROOT,n,id);
const eNorm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const eEsc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const eFmt=d=>{if(!d)return'-';const x=new Date(typeof d==='number'?d:String(d));return isNaN(x)?String(d):x.toLocaleDateString('pt-BR')};
const eAtivo=x=>x&&x.is_deleted!==true&&x.ativo!==false;
const eCliLabel=c=>c?.fantasia||c?.razao_social||c?.razaoSocial||'SEM NOME';
const eSerial=m=>String(m?.numeroSerie||m?.numero_serie||m?.serial||'').trim();
const eModel=m=>m?.modelo||'Equipamento';
const eClientName=m=>m?.clienteNome||m?.cliente_atual||m?.clienteAtual||'-';
const eStatusOS=o=>String(o?.etapaKanban||o?.status||'').toUpperCase();
const eOSAbert=o=>eAtivo(o)&&!['ENCERRADOS','ENCERRADO','EXCLUIDA','CANCELADA'].includes(eStatusOS(o));
const eMachineClient=(m,c)=>String(m?.clienteId||'')===String(c?.id||'')||(!m?.clienteId&&[c?.razao_social,c?.fantasia].some(v=>eNorm(v)&&eNorm(v)===eNorm(eClientName(m))));
const eOSClient=(o,c)=>String(o?.clienteId||'')===String(c?.id||'')||(!o?.clienteId&&[c?.razao_social,c?.fantasia].some(v=>eNorm(v)&&eNorm(v)===eNorm(o?.clienteNome||o?.cliente)));
const eOSRClient=(o,c)=>String(o?.clienteId||'')===String(c?.id||'')||[c?.razao_social,c?.fantasia].some(v=>eNorm(v)&&eNorm(v)===eNorm(o?.cliente));
const eMatCol=t=>t==='PECA'?'cadastros_pecas':'cadastros_consumiveis';
const eAddMonths=(date,months)=>{if(!date)return'';const d=new Date(date+'T12:00:00');if(isNaN(d))return'';d.setMonth(d.getMonth()+Number(months||0));return d.toISOString().slice(0,10)};
const eWarranty=m=>{const fim=m.garantiaFimISO||eAddMonths(m.dataVenda,m.garantiaMeses||12);if(!m.dataVenda||!fim)return{key:'SEM_DATA',label:'SEM DATA',cls:'erp-warranty-off'};const hoje=new Date();hoje.setHours(0,0,0,0);const d=new Date(fim+'T12:00:00'),days=Math.ceil((d-hoje)/86400000);if(days<0)return{key:'EXPIRADA',label:'EXPIRADA',cls:'erp-warranty-off',fim};if(days<=30)return{key:'VENCENDO',label:`VENCE EM ${days}D`,cls:'erp-warranty-warn',fim};return{key:'ATIVA',label:'EM GARANTIA',cls:'erp-warranty-ok',fim}};
const eLegacyStatus=(status,vinculo)=>status==='MANUTENCAO'?'Ativo CIJ - Manutenção':status==='INATIVO'?'Inativo':vinculo==='ALUGADO'?'Ativo CIJ - Alugada':vinculo==='EMPRESTADO'?'Ativo CIJ - Emprestada':vinculo==='INTERNO_CIJ'?'Ativo CIJ - Disponível':'Ativo do Cliente';


function ePageRows(rows,key){
  const cfg=ERPUI.pagination[key]||(ERPUI.pagination[key]={page:1,size:10});
  const total=rows.length,totalPages=Math.max(1,Math.ceil(total/cfg.size));
  cfg.page=Math.min(Math.max(1,cfg.page),totalPages);
  const start=(cfg.page-1)*cfg.size,end=Math.min(start+cfg.size,total);
  return {rows:rows.slice(start,end),total,totalPages,start,end,cfg};
}
function eRenderPager(key,total,totalPages,start,end){
  const box=document.getElementById('pager-'+key);if(!box)return;
  const cfg=ERPUI.pagination[key];
  box.innerHTML=`<div class="erp-pager-info">Mostrando <b>${total?start+1:0}</b>–<b>${end}</b> de <b>${total}</b></div>
  <div class="erp-pager-controls">
    <label class="erp-pager-size">Exibir
      <select class="erp-input !w-auto !py-1 !px-2" onchange="window.erpSetPageSize('${key}',this.value)">
        ${[10,25,50,100,250].map(n=>`<option value="${n}" ${cfg.size===n?'selected':''}>${n}</option>`).join('')}
      </select>
    </label>
    <button class="erp-btn erp-btn-light !min-h-8 !py-1" ${cfg.page<=1?'disabled':''} onclick="window.erpPage('${key}',${cfg.page-1})"><i class="fa-solid fa-chevron-left"></i></button>
    <span class="erp-pager-page">Página <b>${cfg.page}</b> de <b>${totalPages}</b></span>
    <button class="erp-btn erp-btn-light !min-h-8 !py-1" ${cfg.page>=totalPages?'disabled':''} onclick="window.erpPage('${key}',${cfg.page+1})"><i class="fa-solid fa-chevron-right"></i></button>
  </div>`;
}
window.erpSetPageSize=function(key,value){
  const cfg=ERPUI.pagination[key]||(ERPUI.pagination[key]={page:1,size:10});
  cfg.size=Math.max(10,Number(value)||10);cfg.page=1;window.erpRender();
};
window.erpPage=function(key,page){
  const cfg=ERPUI.pagination[key]||(ERPUI.pagination[key]={page:1,size:10});
  cfg.page=Math.max(1,Number(page)||1);window.erpRender();
  document.getElementById('tb-'+key)?.closest('.erp-card')?.scrollIntoView({behavior:'smooth',block:'start'});
};
window.erpResetPage=function(key){if(ERPUI.pagination[key])ERPUI.pagination[key].page=1;};

window.initModule=function(){
  document.getElementById('main-content')?.classList.remove('hidden');
  const watch=(name,key)=>window.fsOnSnapshot(eCol(name),snap=>{ERPDB[key]=[];snap.forEach(d=>ERPDB[key].push({id:d.id,...d.data()}));window.erpRender()},e=>console.error('[Cadastros V4]',name,e));
  watch('cadastros_clientes','clientes');watch('cadastros_equipamentos','modelos');watch('cadastros_consumiveis','consumiveis');
  watch('parque_maquinas','parque');watch('os_ordens','os');watch('suportes_osr','osr');watch('estoque_movimentacoes','movimentos');
  setTimeout(()=>window.erpInitialQuery(),600);
};

window.erpInitialQuery=function(){
  const q=new URLSearchParams(location.search),p=ERPUI.page;
  if(p==='clientes'&&q.get('edit'))window.abrirCliente(q.get('edit'));
  if(p==='cliente-ficha'&&q.get('id'))window.renderClienteFicha(q.get('id'));
  if(p==='parque'){
    if(q.get('cliente')){const s=document.getElementById('f-cliente');if(s)s.value=q.get('cliente')}
    if(q.get('novo')==='1')window.abrirMaquina(null,q.get('cliente')||'');
    if(q.get('edit'))window.abrirMaquina(q.get('edit'));
  }
  if(p==='parque-ficha'&&q.get('id'))window.renderParqueFicha(q.get('id'));
  window.erpRender();
};

window.erpRender=function(){
  const p=ERPUI.page;
  if(p==='dashboard')return window.renderDashboard();
  if(p==='clientes')return window.renderClientes();
  if(p==='cliente-ficha')return window.renderClienteFicha(new URLSearchParams(location.search).get('id'));
  if(p==='modelos')return window.renderModelos();
  if(p==='pecas')return window.renderMateriais('PECA');
  if(p==='consumiveis')return window.renderMateriais('CONSUMIVEL');
  if(p==='parque')return window.renderParque();
  if(p==='parque-ficha')return window.renderParqueFicha(new URLSearchParams(location.search).get('id'));
};
window.erpRefresh=()=>window.erpRender();
window.erpClose=id=>document.getElementById(id)?.classList.add('hidden');

window.renderDashboard=function(){
  const c=ERPDB.clientes.filter(eAtivo).length,m=ERPDB.modelos.filter(eAtivo).length,p=ERPDB.parque.filter(eAtivo).length,low=ERPDB.consumiveis.filter(x=>eAtivo(x)&&Number(x.estoqueAtual||0)<=Number(x.estoqueMinimo||0)).length;
  for(const [id,v] of [['kpi-clientes',c],['kpi-modelos',m],['kpi-parque',p],['kpi-baixo',low]]){const el=document.getElementById(id);if(el)el.textContent=v}
};


// V4.3 — CLIENTES: dados compatíveis com App do Técnico/OSR + importação em massa + anti-duplicidade
window.CLIENT_IMPORT={rows:[],issues:[],ready:false};
function eClientCnpjKey(v){return String(v||'').replace(/\D/g,'')}
function eClientHasValidCnpj(c){return eClientCnpjKey(c?.cnpj).length===14}
function eClientNameKey(v){
  let s=String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  if(!s)return '';
  // Remove apenas sufixos jurídicos no FINAL do nome. Não remove palavras do corpo do nome.
  const suffixes=['SOCIEDADE ANONIMA','S A','SA','LIMITADA','LTDA','EIRELI','EPP','ME'];
  let changed=true;
  while(changed){
    changed=false;
    for(const suf of suffixes){
      if(s===suf){s='';changed=true;break}
      if(s.endsWith(' '+suf)){s=s.slice(0,-(suf.length+1)).trim();changed=true;break}
    }
  }
  return s.replace(/\s+/g,'');
}
function eClientNameKeys(c){
  const keys=[
    eClientNameKey(c?.razao_social||c?.razaoSocial||''),
    eClientNameKey(c?.fantasia||c?.nomeFantasia||'')
  ].filter(x=>x&&x.length>=5);
  return [...new Set(keys)];
}
function eClientPrimaryNameKey(c){return eClientNameKey(c?.razao_social||c?.razaoSocial||c?.fantasia||c?.nomeFantasia||'')}
function eClientIdentityKey(c){
  const cnpj=eClientCnpjKey(c?.cnpj);
  if(cnpj.length===14)return 'cnpj_'+cnpj;
  const nome=eClientPrimaryNameKey(c);
  return nome?'nome_'+nome:'';
}
function eClientUniqueKeys(c){
  const out=[];
  const cnpj=eClientCnpjKey(c?.cnpj);
  if(cnpj.length===14)out.push('cnpj_'+cnpj);
  const razao=eClientNameKey(c?.razao_social||c?.razaoSocial||'');
  if(razao&&razao.length>=5)out.push('nome_'+razao);
  return [...new Set(out)];
}
function eClientMatchInfo(a,b){
  const aC=eClientCnpjKey(a?.cnpj),bC=eClientCnpjKey(b?.cnpj),aValid=aC.length===14,bValid=bC.length===14;
  const sameCnpj=aValid&&bValid&&aC===bC;
  const aNames=eClientNameKeys(a),bNames=eClientNameKeys(b),sameName=aNames.some(k=>bNames.includes(k));
  const cnpjConflict=aValid&&bValid&&aC!==bC;
  if(sameCnpj)return {match:true,type:'CNPJ',conflict:false};
  if(sameName&&!cnpjConflict)return {match:true,type:'NOME',conflict:false};
  if(sameName&&cnpjConflict)return {match:false,type:'NOME_CNPJ_DIFERENTE',conflict:true};
  return {match:false,type:'',conflict:false};
}
function eClientAddressComplete(c){
  const rua=String(c?.logradouro||c?.endereco||'').trim(),num=String(c?.numero||'').trim(),comp=String(c?.complemento||'').trim(),bairro=String(c?.bairro||'').trim(),cidade=String(c?.cidade||'').trim(),uf=String(c?.estado||c?.uf||'').trim().toUpperCase(),cep=String(c?.cep||'').trim();
  const linha1=[rua,num].filter(Boolean).join(', ')+(comp?(' - '+comp):'');
  const linha2=[bairro,[cidade,uf].filter(Boolean).join(' - ')].filter(Boolean).join(' | ');
  return [linha1,linha2,cep?('CEP '+cep):''].filter(Boolean).join(' | ');
}
function eClientPrincipalContact(contatos){return (contatos||[]).find(x=>x?.principal)||(contatos||[])[0]||{}}
function eClientSortContacts(contatos){const a=[...(contatos||[])];a.sort((x,y)=>(y?.principal===true)-(x?.principal===true));if(a.length&&!a.some(x=>x.principal))a[0].principal=true;return a}
function eClientCompatibility(data){
  const contatos=eClientSortContacts(data.contatos||[]),cp=eClientPrincipalContact(contatos),enderecoCompleto=eClientAddressComplete(data);
  return {...data,contatos,
    razaoSocial:data.razao_social||'',nomeFantasia:data.fantasia||'',
    contato:cp.nome||'',contatoPrincipalNome:cp.nome||'',contatoPrincipalCargo:cp.cargo||'',
    telefone:cp.telefone||'',contatoPrincipalTelefone:cp.telefone||'',whatsapp:cp.telefone||'',telefoneWhatsapp:cp.telefone||'',contatoTelefone:cp.telefone||'',contato_telefone:cp.telefone||'',
    enderecoCompleto,endereco_completo:enderecoCompleto,
    uf:data.estado||data.uf||'',estado:data.estado||data.uf||'',
    schemaCadastro:5
  };
}
function eClientExistingMatches(candidate){
  return (ERPDB.clientes||[]).filter(x=>eClientMatchInfo(candidate,x).match);
}
function eClientNameConflicts(candidate){
  return (ERPDB.clientes||[]).filter(x=>eClientMatchInfo(candidate,x).conflict);
}
function eClientReferenceCount(c){
  const id=String(c?.id||'');
  let n=0;
  n+=(ERPDB.parque||[]).filter(x=>String(x?.clienteId||'')===id).length;
  n+=(ERPDB.os||[]).filter(x=>String(x?.clienteId||'')===id).length;
  n+=(ERPDB.osr||[]).filter(x=>String(x?.clienteId||'')===id).length;
  return n;
}
function eClientCompleteness(c){
  const cp=eClientPrincipalContact(c?.contatos||[]);
  const fields=[c?.cnpj,c?.razao_social,c?.fantasia,c?.email,c?.cep,c?.logradouro||c?.endereco,c?.numero,c?.bairro,c?.cidade,c?.estado||c?.uf,cp?.nome||c?.contato,cp?.telefone||c?.telefone];
  return fields.filter(v=>String(v||'').trim()).length;
}
function eChooseClientMaster(list){
  return [...list].sort((a,b)=>{
    const ra=eClientReferenceCount(a),rb=eClientReferenceCount(b);if(rb!==ra)return rb-ra;
    const ca=eClientHasValidCnpj(a)?1:0,cb=eClientHasValidCnpj(b)?1:0;if(cb!==ca)return cb-ca;
    const aa=eClientCompleteness(a),ab=eClientCompleteness(b);if(ab!==aa)return ab-aa;
    return String(a.createdAtISO||a.atualizado_em||'').localeCompare(String(b.createdAtISO||b.atualizado_em||''));
  })[0]||null;
}
async function ePersistClientUnique(data,oldRecord=null){
  data=eClientCompatibility(data);
  const id=data.id,newKeys=eClientUniqueKeys(data),oldKeys=oldRecord?eClientUniqueKeys(oldRecord):[];
  if(!newKeys.length)throw new Error('Razão Social/CNPJ inválidos para gerar a chave única.');

  // Verificação em memória também considera os nomes antigos sem CNPJ.
  const matches=eClientExistingMatches(data).filter(x=>String(x.id)!==String(id)&&x.is_deleted!==true);
  if(matches.length)throw new Error('DUPLICADO: já existe outro cliente com o mesmo CNPJ ou nome empresarial.');

  const conflicts=eClientNameConflicts(data).filter(x=>String(x.id)!==String(id)&&x.is_deleted!==true);
  if(conflicts.length)throw new Error('REVISAR: existe cliente com o mesmo nome, porém com CNPJ diferente.');

  const clientRef=eDoc('cadastros_clientes',id);
  await window.fsRunTransaction(window.AppDB,async tx=>{
    for(const key of newKeys){
      const ref=eDoc('cadastros_clientes_chaves',key),snap=await tx.get(ref);
      if(snap.exists()&&String(snap.data()?.clienteId||'')!==String(id)){
        throw new Error('DUPLICADO: chave de CNPJ/nome já pertence a outro cliente.');
      }
    }
    for(const key of oldKeys.filter(k=>!newKeys.includes(k))){
      const ref=eDoc('cadastros_clientes_chaves',key),snap=await tx.get(ref);
      if(snap.exists()&&String(snap.data()?.clienteId||'')===String(id))tx.delete(ref);
    }
    tx.set(clientRef,data);
    for(const key of newKeys){
      tx.set(eDoc('cadastros_clientes_chaves',key),{
        clienteId:id,key,cnpj:data.cnpj||'',razao_social:data.razao_social||'',updatedAtISO:new Date().toISOString()
      });
    }
  });
  return data;
}
function eClientImportNormalizeRow(raw,rowNumber){
  const pick=(...names)=>{for(const n of names){const k=Object.keys(raw).find(x=>eNorm(x)===eNorm(n));if(k!==undefined&&String(raw[k]??'').trim()!=='')return raw[k]}return ''};
  const str=(v)=>String(v??'').trim();
  const contatos=[];
  const pNome=str(pick('Contato Principal Nome','Contato Principal','Responsável','Responsavel'));
  const pCargo=str(pick('Contato Principal Cargo','Cargo Principal','Setor Principal'));
  const pTel=str(pick('Contato Principal Telefone','Contato Principal Telefone/WhatsApp','Telefone Principal','WhatsApp Principal','Telefone'));
  if(pNome||pTel)contatos.push({id:'ct_import_'+rowNumber+'_1',nome:pNome.toUpperCase(),cargo:pCargo.toUpperCase(),telefone:pTel,principal:true});
  for(let n=2;n<=3;n++){
    const nome=str(pick(`Contato ${n} Nome`, `Contato${n} Nome`)),cargo=str(pick(`Contato ${n} Cargo`,`Contato${n} Cargo`)),tel=str(pick(`Contato ${n} Telefone`,`Contato${n} Telefone/WhatsApp`,`Telefone ${n}`));
    if(nome||tel)contatos.push({id:'ct_import_'+rowNumber+'_'+n,nome:nome.toUpperCase(),cargo:cargo.toUpperCase(),telefone:tel,principal:false});
  }
  const ativoTxt=str(pick('Ativo','Situação','Situacao')).toUpperCase();
  const data={
    razao_social:str(pick('Razão Social','Razao Social','Empresa')).toUpperCase(),
    fantasia:str(pick('Nome Fantasia','Fantasia')).toUpperCase(),
    cnpj:str(pick('CNPJ')).toUpperCase(),email:str(pick('E-mail','Email')).toLowerCase(),cep:str(pick('CEP')),
    logradouro:str(pick('Logradouro','Rua','Endereço','Endereco')).toUpperCase(),numero:str(pick('Número','Numero')).toUpperCase(),complemento:str(pick('Complemento')).toUpperCase(),
    bairro:str(pick('Bairro')).toUpperCase(),cidade:str(pick('Cidade','Município','Municipio')).toUpperCase(),estado:str(pick('UF','Estado')).toUpperCase().slice(0,2),
    observacoes:str(pick('Observações Gerais','Observacoes Gerais','Observações','Observacoes')),
    contatos:eClientSortContacts(contatos),ativo:!['NAO','NÃO','INATIVO','FALSE','0'].includes(ativoTxt),is_deleted:false,_row:rowNumber
  };
  data.uf=data.estado;return eClientCompatibility(data);
}
function eClientImportValidate(data){
  const errors=[];const cnpj=eClientCnpjKey(data.cnpj),cp=eClientPrincipalContact(data.contatos);
  if(!data.razao_social)errors.push('Razão Social obrigatória');
  if(!data.cnpj)errors.push('CNPJ obrigatório');else if(cnpj.length!==14)errors.push('CNPJ deve possuir 14 caracteres após remover pontuação');
  if(!data.logradouro)errors.push('Logradouro obrigatório');if(!data.numero)errors.push('Número obrigatório');if(!data.bairro)errors.push('Bairro obrigatório');if(!data.cidade)errors.push('Cidade obrigatória');if(!data.estado||data.estado.length!==2)errors.push('UF obrigatória (2 caracteres)');
  if(!cp.nome)errors.push('Contato principal obrigatório');if(!cp.telefone)errors.push('Telefone/WhatsApp principal obrigatório');
  return errors;
}
window.abrirImportacaoClientes=function(){
  if(navigator.onLine===false){alert('Conecte-se à internet para importar clientes.');return}
  CLIENT_IMPORT={rows:[],issues:[],ready:false};document.getElementById('import-client-file').value='';document.getElementById('import-client-summary').innerHTML='Selecione a planilha modelo preenchida.';document.getElementById('import-client-preview').innerHTML='';document.getElementById('btn-confirm-client-import').disabled=true;document.getElementById('modal-import-clientes').classList.remove('hidden');
};
window.baixarModeloImportacaoClientes=function(){
  if(!window.XLSX){alert('Biblioteca Excel ainda não carregada. Tente novamente em alguns segundos.');return}
  const headers=['Razão Social','Nome Fantasia','CNPJ','E-mail','CEP','Logradouro','Número','Complemento','Bairro','Cidade','UF','Contato Principal Nome','Contato Principal Cargo','Contato Principal Telefone/WhatsApp','Contato 2 Nome','Contato 2 Cargo','Contato 2 Telefone','Contato 3 Nome','Contato 3 Cargo','Contato 3 Telefone','Observações Gerais','Ativo'];
  const ws=XLSX.utils.aoa_to_sheet([headers]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'IMPORTAR_CLIENTES');
  const ex=XLSX.utils.json_to_sheet([{'Razão Social':'EMPRESA EXEMPLO INDUSTRIAL LTDA','Nome Fantasia':'EMPRESA EXEMPLO','CNPJ':'12.345.678/0001-90','E-mail':'contato@exemplo.com.br','CEP':'89200-000','Logradouro':'RUA INDUSTRIAL','Número':'1000','Complemento':'GALPÃO 2','Bairro':'DISTRITO INDUSTRIAL','Cidade':'JOINVILLE','UF':'SC','Contato Principal Nome':'JOÃO SILVA','Contato Principal Cargo':'MANUTENÇÃO','Contato Principal Telefone/WhatsApp':'(47) 99999-0000','Contato 2 Nome':'MARIA SOUZA','Contato 2 Cargo':'COMPRAS','Contato 2 Telefone':'(47) 3333-0000','Contato 3 Nome':'','Contato 3 Cargo':'','Contato 3 Telefone':'','Observações Gerais':'EXEMPLO — NÃO IMPORTAR ESTA ABA','Ativo':'SIM'}]);XLSX.utils.book_append_sheet(wb,ex,'EXEMPLO_PREENCHIDO');
  XLSX.writeFile(wb,'modelo_importacao_clientes.xlsx');
};
window.processarImportacaoClientes=function(file){
  if(!file)return;if(!window.XLSX){alert('Biblioteca Excel não carregada.');return}
  const reader=new FileReader();reader.onload=e=>{try{
    const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}),sheet=wb.Sheets['IMPORTAR_CLIENTES']||wb.Sheets[wb.SheetNames[0]],raw=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
    const rows=raw.map((r,i)=>eClientImportNormalizeRow(r,i+2)).filter(r=>r.razao_social||r.cnpj),issues=[];
    const seenCnpj=new Map(),seenNames=new Map();

    rows.forEach(r=>{
      r._docDigits=String(r.cnpj||'').replace(/\D/g,'');
      r._skipCpf=r._docDigits.length===11;
      r._errors=r._skipCpf?[]:eClientImportValidate(r);
      r._nameKeys=eClientNameKeys(r);
      if(r._skipCpf)return;

      if(r._docDigits.length===14){
        const arr=seenCnpj.get(r._docDigits)||[];arr.push(r._row);seenCnpj.set(r._docDigits,arr);
      }
      r._nameKeys.forEach(k=>{const arr=seenNames.get(k)||[];arr.push({row:r._row,cnpj:r._docDigits});seenNames.set(k,arr)});
    });

    rows.forEach(r=>{
      if(r._skipCpf){r._action='IGNORAR_CPF';return}

      if(r._docDigits.length===14){
        const dupRows=seenCnpj.get(r._docDigits)||[];
        if(dupRows.length>1)r._errors.push('Mesmo CNPJ repetido na planilha (linhas '+dupRows.join(', ')+')');
      }

      for(const nk of r._nameKeys){
        const same=seenNames.get(nk)||[];
        if(same.length>1){
          const distinct=[...new Set(same.map(x=>x.cnpj).filter(x=>x.length===14))];
          if(distinct.length<=1)r._errors.push('Mesmo nome empresarial repetido na planilha (linhas '+same.map(x=>x.row).join(', ')+')');
          else r._errors.push('Mesmo nome empresarial com CNPJs diferentes na planilha. Revisar linhas '+same.map(x=>x.row).join(', '));
          break;
        }
      }

      const matches=eClientExistingMatches(r),activeMatches=matches.filter(x=>x.is_deleted!==true),deletedMatches=matches.filter(x=>x.is_deleted===true);
      const conflicts=eClientNameConflicts(r).filter(x=>x.is_deleted!==true);

      if(conflicts.length){
        r._errors.push('Existe cadastro com o mesmo nome, porém CNPJ diferente: '+conflicts.map(eCliLabel).join(' / '));
      }

      if(activeMatches.length>1){
        r._errors.push('Já existem cadastros duplicados no banco para este cliente. Use "Revisar duplicados" antes de importar.');
        r._action='DUPLICADO_BANCO';
      }else if(activeMatches.length===1){
        r._action='ATUALIZAR';r._existing=activeMatches[0];
      }else if(deletedMatches.length){
        r._action='REATIVAR';r._existing=eChooseClientMaster(deletedMatches);
      }else{
        r._action='NOVO';
      }

      if(r._errors.length)issues.push(...r._errors.map(m=>`Linha ${r._row}: ${m}`));
    });

    const importaveis=rows.filter(r=>!r._skipCpf);
    CLIENT_IMPORT={rows,issues,ready:importaveis.length>0&&!issues.length};

    const c={NOVO:0,ATUALIZAR:0,REATIVAR:0,IGNORAR_CPF:0,DUPLICADO_BANCO:0};
    rows.forEach(r=>c[r._action]=(c[r._action]||0)+1);

    document.getElementById('import-client-summary').innerHTML=
      `<b>${rows.length}</b> linha(s) · `+
      `<span class="text-emerald-700"><b>${c.NOVO||0}</b> novos</span> · `+
      `<span class="text-blue-700"><b>${c.ATUALIZAR||0}</b> atualizar</span> · `+
      `<span class="text-amber-700"><b>${c.REATIVAR||0}</b> reativar</span> · `+
      `<span class="text-slate-600"><b>${c.IGNORAR_CPF||0}</b> CPF ignorados</span> · `+
      `<span class="text-purple-700"><b>${c.DUPLICADO_BANCO||0}</b> duplicados já existentes</span> · `+
      `<span class="text-rose-700"><b>${issues.length}</b> problema(s)</span>`;

    document.getElementById('import-client-preview').innerHTML=
      rows.slice(0,150).map(r=>{
        const status=r._errors.length?'ERRO':r._action;
        const cls=r._errors.length?'text-rose-600':
          r._action==='NOVO'?'text-emerald-700':
          r._action==='REATIVAR'?'text-amber-700':
          r._action==='IGNORAR_CPF'?'text-slate-500':'text-blue-700';
        return `<div class="grid grid-cols-[54px_1fr_150px_150px] gap-2 items-center py-1.5 border-t text-[10px]">
          <span>L${r._row}</span>
          <span><b>${eEsc(r.razao_social)}</b><br><span class="text-slate-500">${eEsc(r.fantasia||'')} · ${eEsc(r.cidade)} / ${eEsc(r.estado)}</span></span>
          <span class="font-mono">${eEsc(r._skipCpf?'CPF '+(r.cnpj||''):(r.cnpj||'-'))}</span>
          <span class="font-black ${cls}">${status==='IGNORAR_CPF'?'IGNORADO CPF':status}</span>
        </div>`;
      }).join('')+
      (issues.length?`<div class="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-[10px] text-rose-800"><b>Corrija/revise antes de importar:</b><br>${issues.slice(0,60).map(eEsc).join('<br>')}${issues.length>60?'<br>...':''}</div>`:'');

    document.getElementById('btn-confirm-client-import').disabled=!CLIENT_IMPORT.ready;
  }catch(err){console.error(err);alert('Não foi possível ler a planilha: '+(err.message||err))}};
  reader.readAsArrayBuffer(file);
};
window.confirmarImportacaoClientes=async function(){
  if(!CLIENT_IMPORT.ready)return;const btn=document.getElementById('btn-confirm-client-import');btn.disabled=true;let novos=0,atualizados=0,reativados=0,ignoradosCpf=0;
  try{for(const r of CLIENT_IMPORT.rows){
    if(r._skipCpf||r._action==='IGNORAR_CPF'){ignoradosCpf++;continue}
    const old=r._existing||null,id=old?.id||('cli_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),now=new Date().toISOString();const clean={...old,...r,id,is_deleted:false,ativo:r.ativo!==false,createdAtISO:old?.createdAtISO||now,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||'',importacaoLote:true};delete clean._row;delete clean._key;delete clean._errors;delete clean._action;delete clean._existing;delete clean._docDigits;delete clean._skipCpf;await ePersistClientUnique(clean,old);if(r._action==='NOVO')novos++;else if(r._action==='REATIVAR')reativados++;else atualizados++}
    alert(`Importação concluída.\n\nNovos: ${novos}\nAtualizados: ${atualizados}\nReativados: ${reativados}\nIgnorados por CPF: ${ignoradosCpf}`);document.getElementById('modal-import-clientes').classList.add('hidden');
  }catch(err){console.error(err);alert('Importação interrompida: '+(err.message||err))}finally{btn.disabled=false}
};


function eClientSafeDuplicateGroups(){
  const active=(ERPDB.clientes||[]).filter(x=>x.is_deleted!==true),groups=[],used=new Set();

  const adjacency=new Map(active.map(c=>[c.id,new Set()]));
  for(let i=0;i<active.length;i++){
    for(let j=i+1;j<active.length;j++){
      const a=active[i],b=active[j],mi=eClientMatchInfo(a,b);
      if(mi.match){adjacency.get(a.id).add(b.id);adjacency.get(b.id).add(a.id)}
    }
  }

  for(const c of active){
    if(used.has(c.id)||!adjacency.get(c.id)?.size)continue;
    const stack=[c.id],ids=[],seen=new Set();
    while(stack.length){
      const id=stack.pop();if(seen.has(id))continue;seen.add(id);used.add(id);ids.push(id);
      for(const n of adjacency.get(id)||[])stack.push(n);
    }
    const list=ids.map(id=>active.find(x=>x.id===id)).filter(Boolean);
    const cnpjs=[...new Set(list.map(x=>eClientCnpjKey(x.cnpj)).filter(x=>x.length===14))];
    // Seguro somente quando o grupo possui no máximo UM CNPJ válido.
    if(list.length>1)groups.push({items:list,safe:cnpjs.length<=1,cnpjs});
  }
  return groups;
}
function eClientMergeContacts(list){
  const out=[],seen=new Set();
  for(const c of list){
    const arr=Array.isArray(c.contatos)&&c.contatos.length?c.contatos:[{nome:c.contato||c.contatoPrincipalNome||'',telefone:c.telefone||c.contatoPrincipalTelefone||'',principal:false}];
    for(const ct of arr){
      const key=(String(ct.telefone||'').replace(/\D/g,'')||eClientNameKey(ct.nome||''));
      if(!key||seen.has(key))continue;seen.add(key);out.push({...ct,id:ct.id||('ct_merge_'+Date.now()+'_'+out.length),nome:String(ct.nome||'').toUpperCase(),cargo:String(ct.cargo||ct.setor||'').toUpperCase(),telefone:ct.telefone||'',principal:false});
    }
  }
  if(out.length)out[0].principal=true;
  return out;
}
function eClientBestField(list,fields){
  const sorted=[...list].sort((a,b)=>eClientCompleteness(b)-eClientCompleteness(a));
  for(const c of sorted)for(const f of fields){const v=c?.[f];if(String(v||'').trim())return v}
  return '';
}
function eClientMergedData(group,master){
  const now=new Date().toISOString(),list=group.items;
  const observations=[...new Set(list.map(x=>String(x.observacoes||'').trim()).filter(Boolean))].join('\n\n--- Cadastro consolidado ---\n');
  return eClientCompatibility({...master,
    id:master.id,
    razao_social:String(eClientBestField(list,['razao_social','razaoSocial'])||master.razao_social||'').toUpperCase(),
    fantasia:String(eClientBestField(list,['fantasia','nomeFantasia'])||master.fantasia||'').toUpperCase(),
    cnpj:eClientBestField(list,['cnpj'])||master.cnpj||'',
    email:String(eClientBestField(list,['email'])||'').toLowerCase(),
    cep:eClientBestField(list,['cep'])||'',
    logradouro:String(eClientBestField(list,['logradouro','endereco'])||'').toUpperCase(),
    numero:String(eClientBestField(list,['numero'])||'').toUpperCase(),
    complemento:String(eClientBestField(list,['complemento'])||'').toUpperCase(),
    bairro:String(eClientBestField(list,['bairro'])||'').toUpperCase(),
    cidade:String(eClientBestField(list,['cidade'])||'').toUpperCase(),
    estado:String(eClientBestField(list,['estado','uf'])||'').toUpperCase().slice(0,2),
    uf:String(eClientBestField(list,['estado','uf'])||'').toUpperCase().slice(0,2),
    contatos:eClientMergeContacts(list),
    observacoes:observations,
    ativo:true,is_deleted:false,
    consolidadoDuplicados:true,consolidadoEmISO:now,
    updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||''
  });
}
window.abrirRevisaoDuplicados=function(){
  const groups=eClientSafeDuplicateGroups(),safe=groups.filter(g=>g.safe),conf=groups.filter(g=>!g.safe);
  window.CLIENT_DUP_GROUPS=safe;
  document.getElementById('dup-summary').innerHTML=`<b>${safe.length}</b> grupo(s) seguros para consolidar · <b>${conf.length}</b> grupo(s) exigem revisão manual porque possuem CNPJs diferentes.`;
  document.getElementById('dup-list').innerHTML=
    safe.map((g,idx)=>{
      const master=eChooseClientMaster(g.items);
      return `<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div class="text-xs font-black text-emerald-800">Grupo ${idx+1} · será mantido o ID de ${eEsc(eCliLabel(master))}</div>
        ${g.items.map(x=>`<div class="mt-1 text-[10px] text-slate-700">• ${eEsc(eCliLabel(x))} · CNPJ ${eEsc(x.cnpj||'SEM CNPJ')} · vínculos ${eClientReferenceCount(x)}</div>`).join('')}
      </div>`;
    }).join('')+
    conf.map(g=>`<div class="rounded-xl border border-amber-200 bg-amber-50 p-3"><div class="text-xs font-black text-amber-800">Revisão manual — mesmo nome com CNPJs diferentes</div>${g.items.map(x=>`<div class="mt-1 text-[10px]">• ${eEsc(eCliLabel(x))} · ${eEsc(x.cnpj||'SEM CNPJ')}</div>`).join('')}</div>`).join('')+
    (!groups.length?'<div class="text-xs text-slate-400 text-center py-8">Nenhum grupo duplicado encontrado pela regra segura.</div>':'');
  document.getElementById('btn-consolidar-duplicados').disabled=!safe.length;
  document.getElementById('modal-duplicados-clientes').classList.remove('hidden');
};
window.consolidarDuplicadosSeguros=async function(){
  const groups=window.CLIENT_DUP_GROUPS||[];if(!groups.length)return;
  if(!confirm(`Consolidar ${groups.length} grupo(s) duplicado(s)?\n\nA operação preservará um ID principal, migrará vínculos de Parque/OS/OSR e ocultará os registros duplicados.`))return;
  const btn=document.getElementById('btn-consolidar-duplicados');btn.disabled=true;let done=0;
  try{
    for(const group of groups){
      const master=eChooseClientMaster(group.items),dups=group.items.filter(x=>x.id!==master.id),dupIds=new Set(dups.map(x=>String(x.id))),merged=eClientMergedData(group,master),masterName=eCliLabel(merged),now=new Date().toISOString();

      // Primeiro migra referências de ID.
      for(const m of (ERPDB.parque||[]).filter(x=>dupIds.has(String(x.clienteId||'')))){
        await window.fsSetDoc(eDoc('parque_maquinas',m.id),{...m,clienteId:master.id,clienteNome:masterName,cliente_atual:masterName,clienteAtual:masterName,updatedAtISO:now,clienteConsolidadoDe:[m.clienteId]});
      }
      for(const o of (ERPDB.os||[]).filter(x=>dupIds.has(String(x.clienteId||'')))){
        await window.fsSetDoc(eDoc('os_ordens',o.id),{...o,clienteId:master.id,clienteNome:masterName,cliente:masterName,updatedAtISO:now,clienteConsolidadoDe:o.clienteId||''});
      }
      for(const o of (ERPDB.osr||[]).filter(x=>dupIds.has(String(x.clienteId||'')))){
        await window.fsSetDoc(eDoc('suportes_osr',o.id),{...o,clienteId:master.id,cliente:masterName,updatedAtISO:now,clienteConsolidadoDe:o.clienteId||''});
      }

      // Salva master e chaves; locks pertencentes aos duplicados podem ser reapontados.
      await window.fsRunTransaction(window.AppDB,async tx=>{
        tx.set(eDoc('cadastros_clientes',master.id),merged);
        const masterKeys=eClientUniqueKeys(merged);
        for(const key of masterKeys){
          const ref=eDoc('cadastros_clientes_chaves',key),snap=await tx.get(ref);
          if(!snap.exists()||String(snap.data()?.clienteId||'')===String(master.id)||dupIds.has(String(snap.data()?.clienteId||''))){
            tx.set(ref,{clienteId:master.id,key,cnpj:merged.cnpj||'',razao_social:merged.razao_social||'',updatedAtISO:now});
          }
        }
        for(const d of dups){
          tx.set(eDoc('cadastros_clientes',d.id),{...d,is_deleted:true,ativo:false,mergedIntoClientId:master.id,mergedIntoClientName:masterName,mergedAtISO:now,updatedAtISO:now});
          for(const key of eClientUniqueKeys(d)){
            const ref=eDoc('cadastros_clientes_chaves',key),snap=await tx.get(ref);
            if(snap.exists()&&String(snap.data()?.clienteId||'')===String(d.id)){
              if(masterKeys.includes(key))tx.set(ref,{clienteId:master.id,key,cnpj:merged.cnpj||'',razao_social:merged.razao_social||'',updatedAtISO:now});
              else tx.delete(ref);
            }
          }
        }
      });
      done++;
    }
    alert(`Consolidação concluída.\n\n${done} grupo(s) processado(s).\n\nOs registros duplicados foram ocultados e os vínculos por clienteId foram migrados para o cadastro principal.`);
    document.getElementById('modal-duplicados-clientes').classList.add('hidden');
  }catch(err){console.error(err);alert('A consolidação foi interrompida:\n\n'+(err.message||err))}
  finally{btn.disabled=false}
};

window.renderClientes=function(){
  const q=(document.getElementById('busca')?.value||'').toLowerCase(),sit=document.getElementById('situacao')?.value||'';
  const allRows=ERPDB.clientes.filter(c=>c.is_deleted!==true).filter(c=>(!sit||(sit==='ATIVO'?c.ativo!==false:c.ativo===false))&&(!q||JSON.stringify(c).toLowerCase().includes(q))).sort((a,b)=>eCliLabel(a).localeCompare(eCliLabel(b),'pt-BR'));
  const pg=ePageRows(allRows,'clientes'),rows=pg.rows;
  const tb=document.getElementById('tb-clientes');if(!tb)return;
  tb.innerHTML=rows.length?rows.map(c=>{
    const maq=ERPDB.parque.filter(m=>eAtivo(m)&&eMachineClient(m,c)).length,ab=ERPDB.os.filter(o=>eOSAbert(o)&&eOSClient(o,c)).length,cp=(c.contatos||[]).find(x=>x.principal)||(c.contatos||[])[0]||{};
    return `<tr><td><a class="font-black text-blue-700 hover:underline" href="cliente_ficha.html?id=${encodeURIComponent(c.id)}">${eEsc(eCliLabel(c))}</a><div class="text-[10px] text-slate-400 mt-1">${eEsc(c.razao_social||'')}</div></td><td>${eEsc(c.cnpj||'-')}</td><td>${eEsc([c.cidade,c.estado||c.uf].filter(Boolean).join(' / ')||'-')}</td><td><b>${eEsc(cp.nome||c.contato||'-')}</b><div class="text-[10px] text-slate-500">${eEsc(cp.telefone||c.telefone||'-')}</div></td><td><b>${maq}</b></td><td><b>${ab}</b></td><td><span class="erp-pill ${c.ativo===false?'bg-slate-100 text-slate-500':'bg-emerald-50 text-emerald-700'}">${c.ativo===false?'INATIVO':'ATIVO'}</span></td><td class="whitespace-nowrap"><a class="erp-btn erp-btn-light" href="cliente_ficha.html?id=${encodeURIComponent(c.id)}">Ficha</a> <button class="erp-btn erp-btn-light" onclick="window.abrirCliente('${eEsc(c.id)}')"><i class="fa-solid fa-pen"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="text-center text-slate-400 py-10">Nenhum cliente encontrado.</td></tr>';
  eRenderPager('clientes',pg.total,pg.totalPages,pg.start,pg.end);
};
window.adicionarContato=function(ct={}){
  const box=document.getElementById('contatos'),row=document.createElement('div');row.className='grid md:grid-cols-[1fr_.75fr_1fr_auto_auto] gap-2 contato-row';
  row.innerHTML=`<input class="erp-input c-nome" placeholder="Nome" value="${eEsc(ct.nome||'')}"><input class="erp-input c-cargo" placeholder="Cargo/Setor" value="${eEsc(ct.cargo||ct.setor||'')}"><input class="erp-input c-tel" placeholder="WhatsApp / telefone" value="${eEsc(ct.telefone||'')}"><label class="text-[10px] font-bold text-slate-500 flex items-center gap-1"><input type="radio" name="ct-principal" class="c-principal" ${ct.principal?'checked':''}> Principal</label><button type="button" class="erp-btn erp-btn-danger !w-10 !px-0" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>`;
  box.appendChild(row);if(box.children.length===1&&!ct.principal)row.querySelector('.c-principal').checked=true;
};
window.abrirCliente=function(id=null){
  const c=id?ERPDB.clientes.find(x=>String(x.id)===String(id)):null;ERPUI.editing=c||null;
  document.getElementById('cliente-titulo').textContent=c?'Editar cliente':'Novo cliente';
  const vals={'cli-id':c?.id||'','cli-razao':c?.razao_social||'','cli-fantasia':c?.fantasia||'','cli-cnpj':c?.cnpj||'','cli-email':c?.email||'','cli-cep':c?.cep||'','cli-logradouro':c?.logradouro||c?.endereco||'','cli-numero':c?.numero||'','cli-complemento':c?.complemento||'','cli-bairro':c?.bairro||'','cli-cidade':c?.cidade||'','cli-uf':c?.estado||c?.uf||'','cli-obs':c?.observacoes||''};
  Object.entries(vals).forEach(([i,v])=>{const el=document.getElementById(i);if(el)el.value=v});
  document.getElementById('cli-ativo').value=String(c?.ativo!==false);document.getElementById('contatos').innerHTML='';(c?.contatos?.length?c.contatos:[{}]).forEach(window.adicionarContato);
  document.getElementById('modal-cliente').classList.remove('hidden');
};
window.salvarCliente=async function(e){
  e.preventDefault();
  let id=document.getElementById('cli-id').value||('cli_'+Date.now()),old=ERPDB.clientes.find(x=>x.id===id)||null,now=new Date().toISOString(),razao=document.getElementById('cli-razao').value.trim().toUpperCase(),cnpj=document.getElementById('cli-cnpj').value.trim().toUpperCase();

  const contatos=eClientSortContacts([...document.querySelectorAll('.contato-row')].map((r,i)=>({
    id:old?.contatos?.[i]?.id||('ct_'+Date.now()+'_'+i),
    nome:r.querySelector('.c-nome').value.trim().toUpperCase(),
    cargo:r.querySelector('.c-cargo').value.trim().toUpperCase(),
    telefone:r.querySelector('.c-tel').value.trim(),
    principal:r.querySelector('.c-principal').checked
  })).filter(x=>x.nome||x.telefone));

  const log=document.getElementById('cli-logradouro').value.trim().toUpperCase(),num=document.getElementById('cli-numero').value.trim().toUpperCase(),comp=document.getElementById('cli-complemento').value.trim().toUpperCase();
  let data=eClientCompatibility({...old,id,razao_social:razao,fantasia:document.getElementById('cli-fantasia').value.trim().toUpperCase(),cnpj,contatos,email:document.getElementById('cli-email').value.trim().toLowerCase(),cep:document.getElementById('cli-cep').value.trim(),logradouro:log,numero:num,complemento:comp,bairro:document.getElementById('cli-bairro').value.trim().toUpperCase(),cidade:document.getElementById('cli-cidade').value.trim().toUpperCase(),estado:document.getElementById('cli-uf').value.trim().toUpperCase(),uf:document.getElementById('cli-uf').value.trim().toUpperCase(),observacoes:document.getElementById('cli-obs').value.trim(),ativo:document.getElementById('cli-ativo').value==='true',is_deleted:false,createdAtISO:old?.createdAtISO||now,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||''});

  const errors=eClientImportValidate(data);if(errors.length){alert('Corrija o cadastro antes de salvar:\n\n- '+errors.join('\n- '));return}

  const matches=eClientExistingMatches(data).filter(x=>String(x.id)!==String(id)),activeMatches=matches.filter(x=>x.is_deleted!==true),deletedMatches=matches.filter(x=>x.is_deleted===true);
  const conflicts=eClientNameConflicts(data).filter(x=>String(x.id)!==String(id)&&x.is_deleted!==true);

  if(activeMatches.length){
    const m=eChooseClientMaster(activeMatches);
    alert(`Cadastro duplicado bloqueado.\n\nJá existe um cliente compatível por ${eClientMatchInfo(data,m).type==='CNPJ'?'CNPJ':'NOME'}:\n${eCliLabel(m)}\nCNPJ: ${m.cnpj||'SEM CNPJ'}\n\nUse a ficha existente em vez de criar outro cadastro.`);
    return;
  }
  if(conflicts.length){
    alert(`Revisão necessária.\n\nExiste cliente com o MESMO NOME, mas CNPJ diferente:\n${conflicts.map(x=>`${eCliLabel(x)} — ${x.cnpj||'SEM CNPJ'}`).join('\n')}\n\nO sistema não uniu automaticamente para evitar juntar estabelecimentos diferentes.`);
    return;
  }
  if(!old&&deletedMatches.length){
    const m=eChooseClientMaster(deletedMatches);id=m.id;old=m;data={...data,id,createdAtISO:m.createdAtISO||data.createdAtISO};
  }
  try{await ePersistClientUnique(data,old);window.erpClose('modal-cliente')}
  catch(err){console.error(err);alert('Não foi possível salvar o cliente.\n\n'+(err.message||err))}
};
window.removerCliente=async function(id){
  const c=ERPDB.clientes.find(x=>x.id===id);if(!c)return;const machines=ERPDB.parque.filter(m=>eAtivo(m)&&eMachineClient(m,c));if(machines.length){alert(`Este cliente possui ${machines.length} máquina(s) vinculada(s). Transfira ou inative as máquinas antes de remover o cliente.`);return}
  if(!confirm('Remover este cliente da base ativa? O histórico será preservado.'))return;const now=new Date().toISOString();await window.fsSetDoc(eDoc('cadastros_clientes',id),{...c,is_deleted:true,ativo:false,deletedAtISO:now,deletedBy:window.nomeUsuarioLogado||window.currentUser?.email||'',updatedAtISO:now});
};

window.renderClienteFicha=function(id){
  const c=ERPDB.clientes.find(x=>String(x.id)===String(id));if(!c)return;
  const maquinas=ERPDB.parque.filter(m=>eAtivo(m)&&eMachineClient(m,c)),oss=ERPDB.os.filter(o=>eAtivo(o)&&eOSClient(o,c)),osrs=ERPDB.osr.filter(o=>o?.is_deleted!==true&&eOSRClient(o,c)),ab=oss.filter(eOSAbert).length,cp=(c.contatos||[]).find(x=>x.principal)||(c.contatos||[])[0]||{};
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('ficha-nome',eCliLabel(c));set('ficha-meta',[c.razao_social,c.cnpj].filter(Boolean).join(' · ')||'Cadastro oficial');
  const kp=document.getElementById('ficha-kpis');if(kp)kp.innerHTML=[['Máquinas',maquinas.length],['OS abertas',ab],['OS/OSR',oss.length+osrs.length],['Situação',c.ativo===false?'INATIVO':'ATIVO']].map(x=>`<div class="erp-kpi"><span>${x[0]}</span><b class="!text-lg">${eEsc(x[1])}</b></div>`).join('');
  const dados=document.getElementById('ficha-dados');if(dados)dados.innerHTML=[['CNPJ',c.cnpj],['E-mail',c.email],['Contato principal',(cp.nome||c.contato||'-')+' · '+(cp.telefone||c.telefone||'-')],['Endereço',[c.logradouro||c.endereco,c.numero,c.complemento,c.bairro,c.cidade,c.estado||c.uf].filter(Boolean).join(', ')]].map(x=>`<div><div class="erp-label">${x[0]}</div><div class="text-xs font-semibold">${eEsc(x[1]||'-')}</div></div>`).join('');
  set('ficha-obs',c.observacoes||'Nenhuma observação geral registrada.');
  const mbox=document.getElementById('ficha-maquinas');if(mbox)mbox.innerHTML=maquinas.length?maquinas.map(m=>`<a href="parque_ficha.html?id=${encodeURIComponent(m.id)}" class="erp-card p-3 hover:border-blue-300"><div class="flex justify-between gap-2"><b class="text-xs text-blue-700">${eEsc(m.modelo||'Equipamento')}</b><span class="erp-pill bg-slate-100 text-slate-600">${eEsc(m.statusOperacional||'OPERACIONAL')}</span></div><div class="text-[10px] text-slate-500 mt-2">SN: <b>${eEsc(eSerial(m)||'-')}</b></div><div class="text-[10px] text-slate-500 mt-1">${eEsc(m.localInstalacao||m.identificacaoLocal||'Local não informado')}</div></a>`).join(''):'<div class="text-xs text-slate-400">Nenhum equipamento associado.</div>';
  const hist=[...oss.map(o=>({tipo:'OS',num:o.osNumber||o.numero||o.id,data:o.createdAtISO||o.updatedAtISO,desc:o.descricaoInicial||o.status||o.etapaKanban||'',status:o.etapaKanban||o.status||''})),...osrs.map(o=>({tipo:'OSR',num:o.osr||o.numero||o.id,data:o.timestamp||o.data_formatada,desc:o.defeito||o.solucao||'',status:o.conclusao||''}))].sort((a,b)=>new Date(b.data||0)-new Date(a.data||0));
  const hbox=document.getElementById('ficha-historico');if(hbox)hbox.innerHTML=hist.length?hist.slice(0,120).map(h=>`<div class="erp-timeline-item"><div class="flex flex-wrap justify-between gap-2"><b class="text-xs">${eEsc(h.tipo)} · ${eEsc(h.num||'-')}</b><span class="text-[10px] text-slate-400">${eEsc(eFmt(h.data))}</span></div><div class="text-[10px] text-slate-600 mt-1">${eEsc(h.desc||'-')}</div><span class="erp-pill bg-slate-100 text-slate-600 mt-2">${eEsc(h.status||'-')}</span></div>`).join(''):'<div class="text-xs text-slate-400">Nenhuma OS ou OSR encontrada.</div>';
  const edit=document.getElementById('btn-editar-cliente');if(edit)edit.href=`cadastros_clientes.html?edit=${encodeURIComponent(c.id)}`;const nova=document.getElementById('btn-nova-maquina');if(nova)nova.href=`parque_maquinas.html?cliente=${encodeURIComponent(c.id)}&novo=1`;
};

window.renderModelos=function(){
  const q=(document.getElementById('busca')?.value||'').toLowerCase(),sit=document.getElementById('situacao')?.value||'',tb=document.getElementById('tb-modelos');if(!tb)return;
  const allRows=ERPDB.modelos.filter(x=>x.is_deleted!==true).filter(x=>(!sit||(sit==='ATIVO'?x.ativo!==false:x.ativo===false))&&(!q||JSON.stringify(x).toLowerCase().includes(q))).sort((a,b)=>String(a.modelo||'').localeCompare(String(b.modelo||''),'pt-BR'));
  const pg=ePageRows(allRows,'modelos'),rows=pg.rows;
  tb.innerHTML=rows.length?rows.map(m=>{const qv=ERPDB.parque.filter(p=>eAtivo(p)&&(String(p.equipamentoCatalogoId||'')===String(m.id)||(!p.equipamentoCatalogoId&&eNorm(p.modelo)===eNorm(m.modelo)))).length;return `<tr><td class="font-mono">${eEsc(m.codigo||'-')}</td><td><b>${eEsc(m.fabricante||m.marca||'-')}</b></td><td><b class="text-blue-700">${eEsc(m.modelo||'-')}</b></td><td>${eEsc(m.tipo||'-')}</td><td>${eEsc(m.categoria||'-')}</td><td><b>${qv}</b></td><td><span class="erp-pill ${m.ativo===false?'bg-slate-100 text-slate-500':'bg-emerald-50 text-emerald-700'}">${m.ativo===false?'INATIVO':'ATIVO'}</span></td><td><button class="erp-btn erp-btn-light" onclick="window.abrirModelo('${eEsc(m.id)}')"><i class="fa-solid fa-pen"></i></button></td></tr>`}).join(''):'<tr><td colspan="8" class="text-center text-slate-400 py-10">Nenhum modelo cadastrado.</td></tr>';
  eRenderPager('modelos',pg.total,pg.totalPages,pg.start,pg.end);
};
window.abrirModelo=function(id=null){const m=id?ERPDB.modelos.find(x=>x.id===id):null;const vals={'mod-id':m?.id||'','mod-codigo':m?.codigo||'','mod-marca':m?.fabricante||m?.marca||'','mod-modelo':m?.modelo||'','mod-tipo':m?.tipo||'','mod-categoria':m?.categoria||'','mod-obs':m?.observacoes||''};Object.entries(vals).forEach(([i,v])=>document.getElementById(i).value=v);document.getElementById('mod-ativo').value=String(m?.ativo!==false);document.getElementById('modelo-titulo').textContent=m?'Editar modelo':'Novo modelo';document.getElementById('modal-modelo').classList.remove('hidden')};
window.salvarModelo=async function(e){e.preventDefault();const id=document.getElementById('mod-id').value||('eq_'+Date.now()),old=ERPDB.modelos.find(x=>x.id===id)||{},now=new Date().toISOString(),marca=document.getElementById('mod-marca').value.trim().toUpperCase(),modelo=document.getElementById('mod-modelo').value.trim().toUpperCase(),codigo=document.getElementById('mod-codigo').value.trim().toUpperCase();const dup=ERPDB.modelos.find(x=>x.id!==id&&x.is_deleted!==true&&((codigo&&String(x.codigo||'').toUpperCase()===codigo)||(eNorm(x.modelo)===eNorm(modelo)&&eNorm(x.fabricante||x.marca)===eNorm(marca))));if(dup){alert('Já existe um modelo com este código ou marca/modelo.');return}await window.fsSetDoc(eDoc('cadastros_equipamentos',id),{...old,id,codigo,fabricante:marca,marca,modelo,tipo:document.getElementById('mod-tipo').value.trim().toUpperCase(),categoria:document.getElementById('mod-categoria').value.trim().toUpperCase(),observacoes:document.getElementById('mod-obs').value.trim(),ativo:document.getElementById('mod-ativo').value==='true',is_deleted:false,createdAtISO:old.createdAtISO||now,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||'',schemaCadastro:4});window.erpClose('modal-modelo')};

window.renderMateriais=function(tipo){
  const arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis,tb=document.getElementById(tipo==='PECA'?'tb-pecas':'tb-consumiveis');if(!tb)return;
  const q=(document.getElementById('busca')?.value||'').toLowerCase(),sit=document.getElementById('situacao')?.value||'',allRows=arr.filter(x=>x.is_deleted!==true).filter(x=>(!sit||(sit==='ATIVO'?x.ativo!==false:x.ativo===false))&&(!q||JSON.stringify(x).toLowerCase().includes(q))).sort((a,b)=>String(a.nome||a.descricao||'').localeCompare(String(b.nome||b.descricao||''),'pt-BR'));
  const key=tipo==='PECA'?'pecas':'consumiveis',pg=ePageRows(allRows,key),rows=pg.rows;
  tb.innerHTML=rows.length?rows.map(x=>{const est=Number(x.estoqueAtual||0),min=Number(x.estoqueMinimo||0),low=est<=min,photo=tipo==='PECA'?`<td>${x.fotoURL?`<img src="${eEsc(x.fotoURL)}" class="erp-photo" alt="Foto da peça">`:'<div class="erp-photo flex items-center justify-center text-slate-300"><i class="fa-solid fa-image"></i></div>'}</td>`:'';return `<tr class="${est<=0?'erp-stock-zero':low?'erp-stock-low':''}">${photo}<td class="font-mono">${eEsc(x.sku||x.codigo||'-')}</td><td><b class="text-blue-700">${eEsc(x.nome||x.descricao||'-')}</b>${tipo==='CONSUMIVEL'?`<div class="text-[10px] text-slate-500">${eEsc(x.tipo||'-')}</div>`:''}</td>${tipo==='CONSUMIVEL'?`<td>${eEsc(x.tipo||'-')}</td>`:''}<td>${eEsc(x.unidade||'UN')}</td><td><b>${est.toLocaleString('pt-BR')}</b>${low?'<span class="erp-pill bg-amber-50 text-amber-700 ml-2">BAIXO</span>':''}</td><td>${min.toLocaleString('pt-BR')}</td><td>${eEsc(x.localizacaoEstoque||x.localizacao||'-')}</td><td class="whitespace-nowrap"><button class="erp-btn erp-btn-light" onclick="window.abrirMovimento('${tipo}','${eEsc(x.id)}')"><i class="fa-solid fa-right-left"></i></button> <button class="erp-btn erp-btn-light" onclick="window.abrirMaterial('${eEsc(x.id)}','${tipo}')"><i class="fa-solid fa-pen"></i></button></td></tr>`}).join(''):`<tr><td colspan="${tipo==='PECA'?9:8}" class="text-center text-slate-400 py-10">Nenhum cadastro encontrado.</td></tr>`;  eRenderPager(key,pg.total,pg.totalPages,pg.start,pg.end);
};
window.abrirMaterial=function(id=null,tipo='PECA'){
  const arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis,x=id?arr.find(v=>v.id===id):null;ERPUI.material=x?{...x,__tipo:tipo}:{__tipo:tipo};ERPUI.pendingPhoto=null;ERPUI.removePhoto=false;
  const vals={'mat-id':x?.id||'','mat-codigo':x?.sku||x?.codigo||'','mat-nome':x?.nome||x?.descricao||'','mat-subtipo':x?.tipo||'','mat-unidade':x?.unidade||'UN','mat-estoque':x?.estoqueAtual??x?.quantity??x?.qtd??x?.quantidade??0,'mat-minimo':x?.estoqueMinimo??0,'mat-local':x?.localizacaoEstoque||x?.localizacao||'','mat-obs':x?.observacoes||''};Object.entries(vals).forEach(([i,v])=>{const el=document.getElementById(i);if(el)el.value=v});
  const saldoInput=document.getElementById('mat-estoque');saldoInput.readOnly=!!x||!eCanStock();saldoInput.title=x?'Para alterar o saldo, use Movimentar estoque.':!eCanStock()?'Crie com saldo zero. O estoque autorizado fará a entrada.':'Saldo inicial: será registrado junto do histórico.';document.getElementById('mat-ativo').disabled=!!x;
  document.getElementById('mat-ativo').value=String(x?.ativo!==false);document.getElementById('material-titulo').textContent=x?'Editar cadastro':tipo==='PECA'?'Nova peça':'Novo consumível';document.getElementById('row-subtipo')?.classList.toggle('hidden',tipo!=='CONSUMIVEL');document.getElementById('row-foto')?.classList.toggle('hidden',tipo!=='PECA');
  const prev=document.getElementById('foto-preview');if(prev){prev.src=x?.fotoURL||'';prev.classList.toggle('hidden',!x?.fotoURL)}const ph=document.getElementById('foto-placeholder');if(ph)ph.classList.toggle('hidden',!!x?.fotoURL);const fi=document.getElementById('mat-foto');if(fi)fi.value='';
  document.getElementById('modal-material').classList.remove('hidden');
};
window.previewFotoPeca=function(input){const f=input.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){alert('Selecione uma imagem.');input.value='';return}if(f.size>5*1024*1024){alert('A foto deve ter no máximo 5 MB.');input.value='';return}ERPUI.pendingPhoto=f;ERPUI.removePhoto=false;const url=URL.createObjectURL(f),p=document.getElementById('foto-preview');p.src=url;p.classList.remove('hidden');document.getElementById('foto-placeholder')?.classList.add('hidden')};
window.removerFotoPeca=function(){ERPUI.pendingPhoto=null;ERPUI.removePhoto=true;const p=document.getElementById('foto-preview');p.src='';p.classList.add('hidden');document.getElementById('foto-placeholder')?.classList.remove('hidden');const i=document.getElementById('mat-foto');if(i)i.value=''};
function eCanStock(){const p=window.userProfile||{},em=String(window.currentUser?.email||'').toLowerCase();return p.perfil==='Master'||['marcos@grupocij.com','marcos@grupocij.com.br','marcos.bazacas@grupocij.com','marcos.bazacas@grupocij.com.br','adm@grupocij.com','adm@grupocij.com.br'].includes(em)||p.permissoesMateriais?.gerenciar_estoque===true;}
let eStockCallable;
async function eStockCall(action,payload){
 if(!navigator.onLine)throw new Error('Conecte à internet para confirmar a movimentação do estoque.');
 const input={operationId:crypto.randomUUID(),action,payload};
 if(window.__CIJMateriaisCall)return window.__CIJMateriaisCall(input);
 if(!eStockCallable)eStockCallable=Promise.all([import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js')]).then(([a,f])=>f.httpsCallable(f.getFunctions(a.getApp(),'us-central1'),'cijMateriaisOS',{timeout:60000}));
 return (await (await eStockCallable)(input)).data;
}
async function eSaveCatalog(tipo,id,data,quantity,expectedExisting){
 const col=eMatCol(tipo),ref=eDoc(col,id),mid='inicial_'+crypto.randomUUID(),now=new Date().toISOString();
 return window.fsRunTransaction(window.AppDB,async tx=>{
  const snap=await tx.get(ref),old=snap.exists()?snap.data():null;
  if(!expectedExisting&&old)throw new Error('Este cadastro já existe. Atualize a lista e abra a edição; o saldo inicial não será lançado novamente.');
  if(expectedExisting&&!old)throw new Error('Este cadastro não existe mais. Atualize a lista.');
  if(old&&Number(old.estoqueAtual??old.quantity??old.qtd??old.quantidade??0)!==quantity)throw new Error('O saldo foi alterado. Faça a movimentação pelo botão Movimentar estoque, com motivo e confirmação do servidor.');
  if(old&&(old.ativo!==false)!==(data.ativo!==false))throw new Error('Para inativar um item, use o Estoque de Peças e confira o saldo e as pendências.');
  const next={...(old||{}),...data,updatedAtISO:now};
  if(old){next.ativo=old.ativo;next.is_deleted=old.is_deleted;Object.keys(next).forEach(k=>{if(next[k]===undefined)delete next[k]});}
  else{
   next.estoqueAtual=quantity;next.quantity=quantity;next.is_deleted=false;next.createdAtISO=now;
   if(quantity>0){
    if(!eCanStock())throw new Error('Seu usuário pode criar o cadastro com saldo zero. Para informar o saldo inicial, é necessária a permissão Gerenciar estoque.');
    next.cadastroSaldoInicialId=mid;
    tx.set(eDoc('estoque_movimentacoes',mid),{id:mid,materialColecao:col,materialTipo:tipo,materialId:id,materialNome:data.nome,codigo:data.codigo,tipoMovimento:'SALDO_INICIAL',quantidade:quantity,saldoAnterior:0,saldoPosterior:quantity,motivo:'SALDO INICIAL DO CADASTRO',createdAtISO:now,usuarioUid:window.currentUser.uid,usuarioEmail:String(window.currentUser.email).toLowerCase(),usuario:window.nomeUsuarioLogado||window.currentUser.email});
   }
  }
  tx.set(ref,next);return next;
 });
}
window.salvarMaterial=async function(e){
 e.preventDefault();
 const tipo=ERPUI.material?.__tipo||'PECA',arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis;
 const id=document.getElementById('mat-id').value||((tipo==='PECA'?'peca_':'cons_')+crypto.randomUUID());
 document.getElementById('mat-id').value=id;
 const old=arr.find(x=>x.id===id)||{},codigo=document.getElementById('mat-codigo').value.trim().toUpperCase(),nome=document.getElementById('mat-nome').value.trim().toUpperCase();
 if(!nome)throw new Error('Informe a descrição do material.');
 if(arr.some(x=>x.id!==id&&x.is_deleted!==true&&((codigo&&String(x.sku||x.codigo||'').toUpperCase()===codigo)||eNorm(x.nome||x.descricao)===eNorm(nome))))throw new Error('Já existe cadastro com este código ou descrição.');
 const quantity=Number(document.getElementById('mat-estoque').value||0),minimum=Number(document.getElementById('mat-minimo').value||0);
 if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(minimum)||minimum<0)throw new Error('Informe saldos e estoque mínimo válidos, sem valores negativos.');
 let data={id,codigo,sku:codigo,nome,descricao:nome,tipo:tipo==='CONSUMIVEL'?document.getElementById('mat-subtipo').value.trim().toUpperCase():'PECA',unidade:document.getElementById('mat-unidade').value,estoqueMinimo:minimum,localizacaoEstoque:document.getElementById('mat-local').value.trim().toUpperCase(),observacoes:document.getElementById('mat-obs').value.trim(),ativo:document.getElementById('mat-ativo').value==='true',atualizado_em:new Date().toISOString(),atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||'',schemaCadastro:4};
 let uploadedPath='';
 if(tipo==='PECA'&&ERPUI.pendingPhoto){const f=ERPUI.pendingPhoto;if(!window.fbUploadBytes)throw new Error('Atualize o core.js para enviar fotos.');uploadedPath=`cadastros_pecas/${id}/foto_${crypto.randomUUID()}.jpg`;const ref=window.fbStorageRef(window.AppStorage,uploadedPath);await window.fbUploadBytes(ref,f,{contentType:f.type||'image/jpeg'});data.fotoURL=await window.fbGetDownloadURL(ref);data.fotoStoragePath=uploadedPath;}
 if(tipo==='PECA'&&ERPUI.removePhoto){data.fotoURL='';data.fotoStoragePath='';}
 await eSaveCatalog(tipo,id,data,quantity,!!old.id);
 if(tipo==='PECA'&&(ERPUI.removePhoto||uploadedPath)&&old.fotoStoragePath&&old.fotoStoragePath!==uploadedPath){try{await window.fbDeleteObject(window.fbStorageRef(window.AppStorage,old.fotoStoragePath))}catch(error){console.warn('[Cadastros] foto anterior preservada',error.code);}}
 window.erpClose('modal-material');
};
window.abrirMovimento=function(tipo,id){const arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis,x=arr.find(v=>v.id===id);if(!x)return;if(!eCanStock()){alert('Seu usuário precisa da permissão Gerenciar estoque para lançar entradas ou inventários.');return;}ERPUI.material={...x,__tipo:tipo};document.getElementById('mov-material').textContent=`${x.sku||x.codigo||''} · ${x.nome||x.descricao||''} · Saldo: ${Number(x.estoqueAtual??x.quantity??0).toLocaleString('pt-BR')} ${x.unidade||'UN'}`;const select=document.getElementById('mov-tipo');select.querySelector('option[value="SAIDA"]')?.remove();select.value='ENTRADA';document.getElementById('mov-qtd').value='';document.getElementById('mov-motivo').value='';document.getElementById('mov-ref').value='';document.getElementById('modal-movimento').classList.remove('hidden');};
window.salvarMovimento=async function(e){e.preventDefault();const x=ERPUI.material;if(!x)return;const kind=document.getElementById('mov-tipo').value;if(kind==='SAIDA')throw new Error('Para retirar uma peça, faça a requisição dentro da OS e identifique o responsável.');await eStockCall('STOCK_MOVE',{materialId:x.id,materialTipo:x.__tipo,origin:'MATRIZ',kind:kind==='ENTRADA'?'Entrada':'Ajuste',quantity:document.getElementById('mov-qtd').value,reason:document.getElementById('mov-motivo').value.trim(),reference:document.getElementById('mov-ref').value.trim(),expectedStockTimestamp:x.updatedAtISO||''});window.erpClose('modal-movimento');};

window.erpPopulateParque=function(){
  const clientes=ERPDB.clientes.filter(eAtivo).sort((a,b)=>eCliLabel(a).localeCompare(eCliLabel(b),'pt-BR')),mods=ERPDB.modelos.filter(eAtivo).sort((a,b)=>String(a.modelo||'').localeCompare(String(b.modelo||''),'pt-BR'));
  const f=document.getElementById('f-cliente');if(f){const v=f.value;f.innerHTML='<option value="">Todos os clientes</option>'+clientes.map(c=>`<option value="${eEsc(c.id)}">${eEsc(eCliLabel(c))}</option>`).join('');f.value=v}
  const ci=document.getElementById('maq-cliente-id');if(ci){const v=ci.value;ci.innerHTML='<option value="">Selecione...</option>'+clientes.map(c=>`<option value="${eEsc(c.id)}">${eEsc(eCliLabel(c))}${c.razao_social&&c.fantasia&&c.razao_social!==c.fantasia?' · '+eEsc(c.razao_social):''}</option>`).join('');ci.value=v}
  const mi=document.getElementById('maq-modelo-id');if(mi){const v=mi.value;mi.innerHTML='<option value="">Selecione...</option>'+mods.map(m=>`<option value="${eEsc(m.id)}">${eEsc((m.fabricante||m.marca||'')+(m.fabricante||m.marca?' · ':'')+(m.modelo||'-')+(m.tipo?' · '+m.tipo:''))}</option>`).join('');mi.value=v}
  const tr=document.getElementById('tr-cliente');if(tr){const v=tr.value;tr.innerHTML='<option value="">Selecione...</option>'+clientes.map(c=>`<option value="${eEsc(c.id)}">${eEsc(eCliLabel(c))}</option>`).join('');tr.value=v}
};
window.renderParque=function(){
  window.erpPopulateParque();const q=(document.getElementById('busca')?.value||'').toLowerCase(),st=document.getElementById('f-status')?.value||'',cid=document.getElementById('f-cliente')?.value||'',wg=document.getElementById('f-garantia')?.value||'',all=ERPDB.parque.filter(eAtivo),allRows=all.filter(m=>(!st||String(m.statusOperacional||'OPERACIONAL')===st)&&(!cid||String(m.clienteId||'')===cid)&&(!wg||eWarranty(m).key===wg)&&(!q||JSON.stringify([eSerial(m),m.modelo,m.fabricante,m.marca,eClientName(m),m.localInstalacao]).toLowerCase().includes(q))).sort((a,b)=>eClientName(a).localeCompare(eClientName(b),'pt-BR')),pg=ePageRows(allRows,'parque'),rows=pg.rows;
  for(const [id,v] of [['kpi-total',all.length],['kpi-garantia',all.filter(m=>eWarranty(m).key==='ATIVA').length],['kpi-vencendo',all.filter(m=>eWarranty(m).key==='VENCENDO').length],['kpi-manut',all.filter(m=>String(m.statusOperacional||'')==='MANUTENCAO').length]]){const el=document.getElementById(id);if(el)el.textContent=v}
  const tb=document.getElementById('tb-parque');if(!tb)return;tb.innerHTML=rows.length?rows.map(m=>{const w=eWarranty(m),c=ERPDB.clientes.find(x=>String(x.id)===String(m.clienteId));return `<tr><td><a class="font-mono font-black text-indigo-700 hover:underline" href="parque_ficha.html?id=${encodeURIComponent(m.id)}"><i class="fa-solid fa-qrcode mr-1 text-slate-400"></i>${eEsc(eSerial(m)||'-')}</a></td><td><b>${eEsc(m.fabricante||m.marca||'')}</b><div class="text-blue-700 font-black">${eEsc(eModel(m))}</div><div class="text-[10px] text-slate-500">${eEsc(m.tipoEquipamento||'')}</div></td><td><a class="font-bold hover:underline" href="cliente_ficha.html?id=${encodeURIComponent(m.clienteId||'')}">${eEsc(c?eCliLabel(c):eClientName(m))}</a></td><td>${eEsc(eFmt(m.dataVenda))}</td><td><span class="erp-pill ${w.cls}">${eEsc(w.label)}</span><div class="text-[10px] text-slate-500 mt-1">${eEsc(w.fim?eFmt(w.fim):'-')}</div></td><td>${eEsc(eFmt(m.dataInstalacaoAtual||m.data_instalacao))}<div class="text-[10px] text-slate-500 mt-1">${eEsc(m.localInstalacao||m.identificacaoLocal||'-')}</div></td><td><span class="erp-pill ${String(m.statusOperacional)==='MANUTENCAO'?'bg-amber-50 text-amber-700':String(m.statusOperacional)==='INATIVO'?'bg-slate-100 text-slate-500':'bg-emerald-50 text-emerald-700'}">${eEsc(m.statusOperacional||'OPERACIONAL')}</span></td><td class="whitespace-nowrap"><a class="erp-btn erp-btn-light" href="parque_ficha.html?id=${encodeURIComponent(m.id)}">Ficha</a> <button class="erp-btn erp-btn-light" onclick="window.abrirMaquina('${eEsc(m.id)}')"><i class="fa-solid fa-pen"></i></button></td></tr>`}).join(''):'<tr><td colspan="8" class="text-center text-slate-400 py-10">Nenhuma máquina encontrada.</td></tr>';  eRenderPager('parque',pg.total,pg.totalPages,pg.start,pg.end);
};
window.atualizarModeloResumo=function(){const m=ERPDB.modelos.find(x=>String(x.id)===String(document.getElementById('maq-modelo-id').value)),b=document.getElementById('modelo-resumo');if(b)b.innerHTML=m?`<b>${eEsc(m.fabricante||m.marca||'-')} · ${eEsc(m.modelo||'-')}</b><br>Tipo: ${eEsc(m.tipo||'-')} · Categoria: ${eEsc(m.categoria||'-')}`:'Selecione um modelo cadastrado na base mestre.'};
window.atualizarGarantia=function(){const el=document.getElementById('maq-garantia-fim');if(el)el.value=eAddMonths(document.getElementById('maq-venda').value,document.getElementById('maq-garantia-meses').value)||''};
window.abrirMaquina=function(id=null,clienteId=''){window.erpPopulateParque();const m=id?ERPDB.parque.find(x=>String(x.id)===String(id)):null;ERPUI.maquina=m||null;const vals={'maq-id':m?.id||'','maq-serie':eSerial(m),'maq-modelo-id':m?.equipamentoCatalogoId||'','maq-cliente-id':m?.clienteId||clienteId||'','maq-vinculo':m?.tipoVinculo||m?.modalidade||'VENDIDO','maq-venda':m?.dataVenda||'','maq-garantia-meses':m?.garantiaMeses??12,'maq-status':m?.statusOperacional||'OPERACIONAL','maq-instalacao':m?.dataInstalacaoAtual||m?.data_instalacao||'','maq-local':m?.localInstalacao||m?.identificacaoLocal||'','maq-obs':m?.observacoes||''};Object.entries(vals).forEach(([i,v])=>document.getElementById(i).value=v);document.getElementById('maq-serie').readOnly=!!m;document.getElementById('maquina-titulo').textContent=m?'Editar máquina':'Nova máquina';window.atualizarModeloResumo();window.atualizarGarantia();document.getElementById('modal-maquina').classList.remove('hidden')};
window.salvarMaquina=async function(e){e.preventDefault();const id=document.getElementById('maq-id').value||('pm_'+Date.now()),old=ERPDB.parque.find(x=>x.id===id)||{},sn=document.getElementById('maq-serie').value.trim().toUpperCase(),mid=document.getElementById('maq-modelo-id').value,cid=document.getElementById('maq-cliente-id').value,m=ERPDB.modelos.find(x=>String(x.id)===String(mid)),c=ERPDB.clientes.find(x=>String(x.id)===String(cid));if(!m||!c){alert('Selecione cliente e modelo válidos.');return}const dup=ERPDB.parque.find(x=>x.id!==id&&eAtivo(x)&&eNorm(eSerial(x))===eNorm(sn));if(dup){alert('Já existe uma máquina ativa com este número de série.');return}const venda=document.getElementById('maq-venda').value,gm=Number(document.getElementById('maq-garantia-meses').value||0),inst=document.getElementById('maq-instalacao').value,status=document.getElementById('maq-status').value,vinc=document.getElementById('maq-vinculo').value,now=new Date().toISOString(),cn=eCliLabel(c);await window.fsSetDoc(eDoc('parque_maquinas',id),{...old,id,numeroSerie:sn,numero_serie:sn,serial:sn,equipamentoCatalogoId:mid,modelo:m.modelo||'',fabricante:m.fabricante||m.marca||'',marca:m.fabricante||m.marca||'',tipoEquipamento:m.tipo||'',categoriaEquipamento:m.categoria||'',codigoEquipamento:m.codigo||'',clienteId:cid,clienteNome:cn,cliente_atual:cn,clienteAtual:cn,tipoVinculo:vinc,modalidade:vinc,statusOperacional:status,status:eLegacyStatus(status,vinc),dataVenda:venda,garantiaMeses:gm,garantiaFimISO:eAddMonths(venda,gm),dataPrimeiraInstalacao:old.dataPrimeiraInstalacao||old.data_instalacao||inst,dataInstalacaoAtual:inst,data_instalacao:inst,localInstalacao:document.getElementById('maq-local').value.trim().toUpperCase(),identificacaoLocal:document.getElementById('maq-local').value.trim().toUpperCase(),observacoes:document.getElementById('maq-obs').value.trim(),historico_transferencias:old.historico_transferencias||[],ativo:true,is_deleted:false,createdAtISO:old.createdAtISO||now,updatedAtISO:now,atualizadoPor:window.nomeUsuarioLogado||window.currentUser?.email||'',schemaParque:4});window.erpClose('modal-maquina')};

window.renderParqueFicha=function(id){
  const m=ERPDB.parque.find(x=>String(x.id)===String(id));if(!m)return;ERPUI.maquina=m;const c=ERPDB.clientes.find(x=>String(x.id)===String(m.clienteId)),w=eWarranty(m),title=document.getElementById('ficha-maq-titulo'),sub=document.getElementById('ficha-maq-sub');if(title)title.textContent=`${m.fabricante||m.marca||''} ${eModel(m)}`.trim();if(sub)sub.textContent=`SN ${eSerial(m)} · ${c?eCliLabel(c):eClientName(m)}`;
  const qr=document.getElementById('qr-ficha');if(qr&&window.QRCode){qr.innerHTML='';new QRCode(qr,{text:eSerial(m),width:170,height:170})}const qs=document.getElementById('qr-serie');if(qs)qs.textContent=eSerial(m);
  const res=document.getElementById('ficha-maq-resumo');if(res)res.innerHTML=[['Cliente',c?eCliLabel(c):eClientName(m)],['Local',m.localInstalacao||m.identificacaoLocal||'-'],['Data da venda',eFmt(m.dataVenda)],['Garantia',w.label+(w.fim?' · '+eFmt(w.fim):'')],['Instalação atual',eFmt(m.dataInstalacaoAtual||m.data_instalacao)],['Status',m.statusOperacional||'OPERACIONAL'],['Vínculo',m.tipoVinculo||m.modalidade||'-'],['Observações',m.observacoes||'-']].map(([a,b])=>`<div class="erp-card p-3"><div class="erp-label">${eEsc(a)}</div><div class="text-xs font-bold">${eEsc(b)}</div></div>`).join('');
  const os=ERPDB.os.filter(o=>eAtivo(o)&&(String(o.parqueMaquinaId||'')===String(m.id)||String(o.equipamentoNumeroSerie||'')===eSerial(m))),osr=ERPDB.osr.filter(o=>o.is_deleted!==true&&eNorm(o.serial)===eNorm(eSerial(m))),tr=(m.historico_transferencias||[]).map(t=>({tipo:'TRANSFERÊNCIA',num:t.cliente_novo||t.clienteNovo||'',data:t.createdAtISO||t.data,desc:t.motivo||''})),hist=[...os.map(o=>({tipo:'OS',num:o.osNumber||o.numero||o.id,data:o.createdAtISO||o.updatedAtISO,desc:o.descricaoInicial||o.status||''})),...osr.map(o=>({tipo:'OSR',num:o.osr||o.numero||o.id,data:o.timestamp||o.data_formatada,desc:o.defeito||o.solucao||''})),...tr].sort((a,b)=>new Date(b.data||0)-new Date(a.data||0));
  const hb=document.getElementById('ficha-maq-historico');if(hb)hb.innerHTML=hist.length?hist.map(h=>`<div class="erp-timeline-item"><div class="flex justify-between gap-2"><b class="text-xs">${eEsc(h.tipo)} · ${eEsc(h.num||'-')}</b><span class="text-[10px] text-slate-400">${eEsc(eFmt(h.data))}</span></div><div class="text-[10px] text-slate-600 mt-1">${eEsc(h.desc||'-')}</div></div>`).join(''):'<div class="text-xs text-slate-400">Nenhum histórico encontrado.</div>';
  const edit=document.getElementById('btn-editar-maquina');if(edit)edit.href=`parque_maquinas.html?edit=${encodeURIComponent(m.id)}`;const cl=document.getElementById('btn-cliente-maquina');if(cl)cl.href=`cliente_ficha.html?id=${encodeURIComponent(m.clienteId||'')}`;
};
window.abrirTransferencia=function(){const m=ERPUI.maquina;if(!m)return;window.erpPopulateParque();document.getElementById('tr-resumo').textContent=`${eModel(m)} · SN ${eSerial(m)} · Cliente atual: ${eClientName(m)}`;document.getElementById('tr-cliente').value='';document.getElementById('tr-data').value=new Date().toISOString().slice(0,10);document.getElementById('tr-local').value='';document.getElementById('tr-motivo').value='';document.getElementById('modal-transferencia').classList.remove('hidden')};
window.salvarTransferencia=async function(e){e.preventDefault();const m=ERPUI.maquina,cid=document.getElementById('tr-cliente').value,c=ERPDB.clientes.find(x=>String(x.id)===String(cid));if(!m||!c)return;if(String(m.clienteId||'')===String(cid)){alert('A máquina já está vinculada a este cliente.');return}const now=new Date().toISOString(),nome=eCliLabel(c),tr={id:'tr_'+Date.now(),clienteAntigoId:m.clienteId||'',cliente_antigo:eClientName(m),clienteNovoId:cid,cliente_novo:nome,data:document.getElementById('tr-data').value,motivo:document.getElementById('tr-motivo').value.trim().toUpperCase(),localAnterior:m.localInstalacao||'',localNovo:document.getElementById('tr-local').value.trim().toUpperCase(),responsavel:window.nomeUsuarioLogado||window.currentUser?.email||'',createdAtISO:now};const data={...m,clienteId:cid,clienteNome:nome,cliente_atual:nome,clienteAtual:nome,dataInstalacaoAtual:tr.data,data_instalacao:tr.data,localInstalacao:tr.localNovo||m.localInstalacao||'',identificacaoLocal:tr.localNovo||m.identificacaoLocal||'',historico_transferencias:[...(m.historico_transferencias||[]),tr],updatedAtISO:now};await window.fsSetDoc(eDoc('parque_maquinas',m.id),data);ERPUI.maquina=data;window.erpClose('modal-transferencia');window.renderParqueFicha(m.id)};
window.imprimirEtiqueta=function(){const m=ERPUI.maquina;if(!m||!window.QRCode)return;const temp=document.createElement('div');temp.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(temp);new QRCode(temp,{text:eSerial(m),width:220,height:220});setTimeout(()=>{const qr=temp.querySelector('canvas')?.toDataURL()||temp.querySelector('img')?.src||'',w=window.open('','_blank');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${eEsc(eSerial(m))}</title><style>@page{size:70mm 50mm;margin:3mm}body{font-family:Arial;text-align:center;margin:0}.sn{font-size:14px;font-weight:900}.mod{font-size:10px;margin-top:2px}img{width:30mm;height:30mm}</style></head><body><img src="${qr}"><div class="sn">${eEsc(eSerial(m))}</div><div class="mod">${eEsc((m.fabricante||m.marca||'')+' '+eModel(m))}</div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);w.document.close();temp.remove()},180)};

// Central de OS 1.77 — atalhos a partir de cadastros já salvos.
window.erpPodeCriarOS=()=>window.portalTemAcessoModulo?.('assistencia.html')===true;
window.erpCriarOSCadastro=function(clienteId,parqueId=''){
  if(!window.erpPodeCriarOS()){alert('Seu usuário precisa de acesso à Assistência Técnica para criar uma OS.');return}
  const m=parqueId?ERPDB.parque.find(x=>String(x.id)===String(parqueId)):null;
  const cid=String(m?.clienteId||clienteId||'');
  const c=ERPDB.clientes.find(x=>String(x.id)===cid);
  if(!c||!eAtivo(c)){alert('Salve ou ative o cadastro do cliente antes de criar a OS.');return}
  if(parqueId&&(!m||!eAtivo(m))){alert('O equipamento precisa estar salvo e ativo no Parque de Máquinas.');return}
  if(document.getElementById('modal-cliente')&&!document.getElementById('modal-cliente').classList.contains('hidden')||document.getElementById('modal-maquina')&&!document.getElementById('modal-maquina').classList.contains('hidden')){
    if(!confirm('A OS será aberta com os dados já salvos. Alterações ainda não salvas nesta janela serão descartadas. Continuar?'))return;
  }
  const params=new URLSearchParams({novaOS:'1',clienteId:cid,origemCadastro:parqueId?'equipamento':'cliente'});
  if(parqueId)params.set('parqueMaquinaId',String(parqueId));
  location.href='assistencia.html?'+params.toString();
};
function erpAtalhoOS(anchor,clienteId,parqueId=''){
  if(!anchor)return;
  const container=anchor.parentElement;
  let button=container.querySelector('[data-erp-criar-os]');
  if(!button){button=document.createElement('button');button.type='button';button.className='erp-btn erp-btn-primary';button.dataset.erpCriarOs='1';button.innerHTML='<i class="fa-solid fa-plus"></i> Criar OS';container.appendChild(button)}
  const c=ERPDB.clientes.find(x=>String(x.id)===String(clienteId));
  const m=parqueId?ERPDB.parque.find(x=>String(x.id)===String(parqueId)):null;
  button.classList.toggle('hidden',!window.erpPodeCriarOS()||!c||!eAtivo(c)||(!!parqueId&&(!m||!eAtivo(m))));
  button.onclick=()=>window.erpCriarOSCadastro(clienteId,parqueId);
  if(window.portalTemAcessoModulo?.('central_os.html')){
    let link=container.querySelector('[data-erp-central-os]');
    if(!link){link=document.createElement('a');link.className='erp-btn erp-btn-light';link.dataset.erpCentralOs='1';link.textContent='Consultar OS';container.appendChild(link)}
    link.href='central_os.html?'+new URLSearchParams({clienteId:String(clienteId||''),status:'TODAS'}).toString();
    link.classList.toggle('hidden',!c);
  }
}
const erpRenderClienteFichaAnterior=window.renderClienteFicha;
window.renderClienteFicha=function(id){const result=erpRenderClienteFichaAnterior.apply(this,arguments);erpAtalhoOS(document.getElementById('btn-editar-cliente'),id);return result};
const erpRenderParqueFichaAnterior=window.renderParqueFicha;
window.renderParqueFicha=function(id){const result=erpRenderParqueFichaAnterior.apply(this,arguments);const m=ERPDB.parque.find(x=>String(x.id)===String(id));erpAtalhoOS(document.getElementById('btn-editar-maquina'),m?.clienteId||'',id);return result};
const erpAbrirClienteAnterior=window.abrirCliente;
window.abrirCliente=function(id){const result=erpAbrirClienteAnterior.apply(this,arguments);erpAtalhoOS(document.querySelector('#modal-cliente button[type="submit"],#modal-cliente button:not([type])'),id);return result};
const erpAbrirMaquinaAnterior=window.abrirMaquina;
window.abrirMaquina=function(id){const result=erpAbrirMaquinaAnterior.apply(this,arguments);const m=ERPDB.parque.find(x=>String(x.id)===String(id));erpAtalhoOS(document.querySelector('#modal-maquina button[type="submit"],#modal-maquina button:not([type])'),m?.clienteId||'',id);return result};

// Os formulários mantêm os dados preenchidos quando uma gravação é recusada.
for(const name of ['salvarCliente','salvarModelo','salvarMaterial','salvarMovimento','salvarMaquina','salvarTransferencia']){
 const save=window[name];if(!save)continue;
 window[name]=async function(event,...args){
  event?.preventDefault?.();const form=event?.target,button=event?.submitter;
  if(form?.dataset?.cijSaving==='1')return;
  if(form?.dataset)form.dataset.cijSaving='1';if(button)button.disabled=true;
  try{return await save.call(this,event,...args);}catch(error){
   console.error('[Cadastros] gravação recusada',error.code||error.name);
   const message=['permission-denied','functions/permission-denied'].includes(error.code)?'Não foi possível salvar. Confira o acesso a Cadastros e a permissão Gerenciar estoque para saldos iniciais; publique as regras Firestore 1.79.1.':error.code==='unavailable'?'A gravação não pôde ser confirmada. Verifique a conexão e atualize a lista antes de repetir.':error.message||'Não foi possível confirmar a gravação.';
   alert(message);
  }finally{if(form?.dataset)delete form.dataset.cijSaving;if(button)button.disabled=false;}
 };
}
