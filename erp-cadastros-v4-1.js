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
  watch('cadastros_clientes','clientes');watch('cadastros_equipamentos','modelos');watch('cadastros_pecas','pecas');watch('cadastros_consumiveis','consumiveis');
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
  const c=ERPDB.clientes.filter(eAtivo).length,m=ERPDB.modelos.filter(eAtivo).length,p=ERPDB.parque.filter(eAtivo).length,low=[...ERPDB.pecas,...ERPDB.consumiveis].filter(x=>eAtivo(x)&&Number(x.estoqueAtual||0)<=Number(x.estoqueMinimo||0)).length;
  for(const [id,v] of [['kpi-clientes',c],['kpi-modelos',m],['kpi-parque',p],['kpi-baixo',low]]){const el=document.getElementById(id);if(el)el.textContent=v}
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
  e.preventDefault();const id=document.getElementById('cli-id').value||('cli_'+Date.now()),old=ERPDB.clientes.find(x=>x.id===id)||{},now=new Date().toISOString(),razao=document.getElementById('cli-razao').value.trim().toUpperCase(),cnpj=document.getElementById('cli-cnpj').value.trim();
  const dup=ERPDB.clientes.find(x=>x.id!==id&&x.is_deleted!==true&&((cnpj&&x.cnpj===cnpj)||eNorm(x.razao_social)===eNorm(razao)));if(dup){alert('Já existe cliente com esta Razão Social ou CNPJ.');return}
  const contatos=[...document.querySelectorAll('.contato-row')].map((r,i)=>({id:old?.contatos?.[i]?.id||('ct_'+Date.now()+'_'+i),nome:r.querySelector('.c-nome').value.trim().toUpperCase(),cargo:r.querySelector('.c-cargo').value.trim().toUpperCase(),telefone:r.querySelector('.c-tel').value.trim(),principal:r.querySelector('.c-principal').checked})).filter(x=>x.nome||x.telefone);if(contatos.length&&!contatos.some(x=>x.principal))contatos[0].principal=true;const cp=contatos.find(x=>x.principal)||contatos[0]||{};
  const log=document.getElementById('cli-logradouro').value.trim().toUpperCase(),num=document.getElementById('cli-numero').value.trim().toUpperCase(),comp=document.getElementById('cli-complemento').value.trim().toUpperCase();
  const data={...old,id,razao_social:razao,fantasia:document.getElementById('cli-fantasia').value.trim().toUpperCase(),cnpj,contatos,contato:cp.nome||'',telefone:cp.telefone||'',contatoPrincipalNome:cp.nome||'',contatoPrincipalTelefone:cp.telefone||'',email:document.getElementById('cli-email').value.trim().toLowerCase(),cep:document.getElementById('cli-cep').value.trim(),logradouro:log,numero:num,complemento:comp,endereco:[log,num,comp].filter(Boolean).join(', '),bairro:document.getElementById('cli-bairro').value.trim().toUpperCase(),cidade:document.getElementById('cli-cidade').value.trim().toUpperCase(),estado:document.getElementById('cli-uf').value.trim().toUpperCase(),uf:document.getElementById('cli-uf').value.trim().toUpperCase(),observacoes:document.getElementById('cli-obs').value.trim(),ativo:document.getElementById('cli-ativo').value==='true',is_deleted:false,createdAtISO:old.createdAtISO||now,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||'',schemaCadastro:4};
  await window.fsSetDoc(eDoc('cadastros_clientes',id),data);window.erpClose('modal-cliente');
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
  const vals={'mat-id':x?.id||'','mat-codigo':x?.sku||x?.codigo||'','mat-nome':x?.nome||x?.descricao||'','mat-subtipo':x?.tipo||'','mat-unidade':x?.unidade||'UN','mat-estoque':x?.estoqueAtual??0,'mat-minimo':x?.estoqueMinimo??0,'mat-local':x?.localizacaoEstoque||x?.localizacao||'','mat-obs':x?.observacoes||''};Object.entries(vals).forEach(([i,v])=>{const el=document.getElementById(i);if(el)el.value=v});
  document.getElementById('mat-ativo').value=String(x?.ativo!==false);document.getElementById('material-titulo').textContent=x?'Editar cadastro':tipo==='PECA'?'Nova peça':'Novo consumível';document.getElementById('row-subtipo')?.classList.toggle('hidden',tipo!=='CONSUMIVEL');document.getElementById('row-foto')?.classList.toggle('hidden',tipo!=='PECA');
  const prev=document.getElementById('foto-preview');if(prev){prev.src=x?.fotoURL||'';prev.classList.toggle('hidden',!x?.fotoURL)}const ph=document.getElementById('foto-placeholder');if(ph)ph.classList.toggle('hidden',!!x?.fotoURL);const fi=document.getElementById('mat-foto');if(fi)fi.value='';
  document.getElementById('modal-material').classList.remove('hidden');
};
window.previewFotoPeca=function(input){const f=input.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){alert('Selecione uma imagem.');input.value='';return}if(f.size>5*1024*1024){alert('A foto deve ter no máximo 5 MB.');input.value='';return}ERPUI.pendingPhoto=f;ERPUI.removePhoto=false;const url=URL.createObjectURL(f),p=document.getElementById('foto-preview');p.src=url;p.classList.remove('hidden');document.getElementById('foto-placeholder')?.classList.add('hidden')};
window.removerFotoPeca=function(){ERPUI.pendingPhoto=null;ERPUI.removePhoto=true;const p=document.getElementById('foto-preview');p.src='';p.classList.add('hidden');document.getElementById('foto-placeholder')?.classList.remove('hidden');const i=document.getElementById('mat-foto');if(i)i.value=''};
window.salvarMaterial=async function(e){
  e.preventDefault();const tipo=ERPUI.material?.__tipo||'PECA',arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis,id=document.getElementById('mat-id').value||((tipo==='PECA'?'peca_':'cons_')+Date.now()),old=arr.find(x=>x.id===id)||{},now=new Date().toISOString(),codigo=document.getElementById('mat-codigo').value.trim().toUpperCase(),nome=document.getElementById('mat-nome').value.trim().toUpperCase(),dup=arr.find(x=>x.id!==id&&x.is_deleted!==true&&((codigo&&String(x.sku||x.codigo||'').toUpperCase()===codigo)||eNorm(x.nome||x.descricao)===eNorm(nome)));if(dup){alert('Já existe cadastro com este código ou descrição.');return}
  const estoque=Number(document.getElementById('mat-estoque').value||0);let data={...old,id,codigo,sku:codigo,nome,descricao:nome,tipo:tipo==='CONSUMIVEL'?document.getElementById('mat-subtipo').value.trim().toUpperCase():'PECA',unidade:document.getElementById('mat-unidade').value,estoqueAtual:estoque,estoqueMinimo:Number(document.getElementById('mat-minimo').value||0),localizacaoEstoque:document.getElementById('mat-local').value.trim().toUpperCase(),observacoes:document.getElementById('mat-obs').value.trim(),ativo:document.getElementById('mat-ativo').value==='true',is_deleted:false,createdAtISO:old.createdAtISO||now,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||'',schemaCadastro:4};
  await window.fsSetDoc(eDoc(eMatCol(tipo),id),data);
  if(tipo==='PECA'&&ERPUI.removePhoto&&old.fotoStoragePath){try{await window.fbDeleteObject(window.fbStorageRef(window.AppStorage,old.fotoStoragePath))}catch(_){}data.fotoURL='';data.fotoStoragePath='';await window.fsSetDoc(eDoc('cadastros_pecas',id),data)}
  if(tipo==='PECA'&&ERPUI.pendingPhoto){
    if(!window.fbUploadBytes)throw new Error('Firebase Storage não inicializado no core.js.');
    const f=ERPUI.pendingPhoto,ext=(f.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,''),sp=`cadastros_pecas/${id}/foto_${Date.now()}.${ext}`,ref=window.fbStorageRef(window.AppStorage,sp);
    await window.fbUploadBytes(ref,f,{contentType:f.type||'image/jpeg'});const url=await window.fbGetDownloadURL(ref);
    if(old.fotoStoragePath&&old.fotoStoragePath!==sp){try{await window.fbDeleteObject(window.fbStorageRef(window.AppStorage,old.fotoStoragePath))}catch(_){}}
    data={...data,fotoURL:url,fotoStoragePath:sp,fotoAtualizadaEmISO:new Date().toISOString()};await window.fsSetDoc(eDoc('cadastros_pecas',id),data);
  }
  if(!old.id&&estoque!==0){const mid='mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);await window.fsSetDoc(eDoc('estoque_movimentacoes',mid),{id:mid,materialTipo:tipo,materialId:id,materialNome:nome,tipoMovimento:'SALDO_INICIAL',quantidade:estoque,saldoAnterior:0,saldoPosterior:estoque,motivo:'SALDO INICIAL DO CADASTRO',createdAtISO:now,usuario:window.nomeUsuarioLogado||window.currentUser?.email||''})}
  window.erpClose('modal-material');
};
window.abrirMovimento=function(tipo,id){const arr=tipo==='PECA'?ERPDB.pecas:ERPDB.consumiveis,x=arr.find(v=>v.id===id);if(!x)return;ERPUI.material={...x,__tipo:tipo};document.getElementById('mov-material').textContent=`${x.sku||x.codigo||''} · ${x.nome||x.descricao||''} · Saldo: ${Number(x.estoqueAtual||0).toLocaleString('pt-BR')} ${x.unidade||'UN'}`;document.getElementById('mov-tipo').value='ENTRADA';document.getElementById('mov-qtd').value='';document.getElementById('mov-motivo').value='';document.getElementById('mov-ref').value='';document.getElementById('modal-movimento').classList.remove('hidden')};
window.salvarMovimento=async function(e){e.preventDefault();const x=ERPUI.material;if(!x)return;const tipo=document.getElementById('mov-tipo').value,q=Number(document.getElementById('mov-qtd').value||0),anterior=Number(x.estoqueAtual||0);let posterior=anterior;if(tipo==='ENTRADA')posterior=anterior+q;else if(tipo==='SAIDA')posterior=anterior-q;else posterior=q;if(posterior<0){alert('O movimento resultaria em estoque negativo.');return}const now=new Date().toISOString(),id='mov_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),collection=eMatCol(x.__tipo);await window.fsSetDoc(eDoc(collection,x.id),{...x,estoqueAtual:posterior,updatedAtISO:now,atualizado_em:now,atualizado_por:window.nomeUsuarioLogado||window.currentUser?.email||''});await window.fsSetDoc(eDoc('estoque_movimentacoes',id),{id,materialTipo:x.__tipo,materialId:x.id,materialNome:x.nome||x.descricao||'',codigo:x.sku||x.codigo||'',tipoMovimento:tipo,quantidade:q,saldoAnterior:anterior,saldoPosterior:posterior,motivo:document.getElementById('mov-motivo').value.trim().toUpperCase(),referencia:document.getElementById('mov-ref').value.trim().toUpperCase(),createdAtISO:now,usuarioUid:window.currentUser?.uid||'',usuario:window.nomeUsuarioLogado||window.currentUser?.email||''});window.erpClose('modal-movimento')};

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
