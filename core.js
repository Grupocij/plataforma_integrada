// core.js 1.79.4 - MOTOR CENTRAL DO PORTAL GRUPO CIJ — Certificação 1.0.0 / Assistência 1.78.0
import {instalarPushCIJ} from "./push-client.js?v=20261001-push1";

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDoc, getDocs, getDocFromServer, getDocsFromServer, query, where, runTransaction, persistentLocalCache, persistentMultipleTabManager, initializeFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBlob, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = 'manifest.json';
    document.head.appendChild(manifestLink);
}

// FASE 1.66.1 — Service Worker único para Portal e App do Técnico.
// Não registrar um segundo worker no mesmo escopo: dois workers concorrentes
// faziam o cache da Assistência ser removido e causavam tela em branco no refresh offline.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
            .catch(err => console.warn('[Portal CIJ] Service Worker não registrado:', err));
    });
}

const injectLayout = () => {
    if (document.querySelector('header')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        @media(min-width:1024px){header .core-global-search{width:clamp(110px,12vw,180px)!important;flex:0 1 auto!important;min-width:110px}}
        @media(min-width:1024px) and (max-width:1279px){#desktop-nav-menu button{padding-left:6px!important;padding-right:6px!important;font-size:11px!important}}
        #cat-diretoria { display: none !important; }
        body.diretoria-unlocked #cat-diretoria { display: flex !important; }
        .mobile-secret { display: none !important; }
        body.diretoria-unlocked .mobile-secret { display: flex !important; }
        
        .pulse-alert-global { animation: pulse-yellow-global 1.5s infinite; }
        @keyframes pulse-yellow-global {
            0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        .notif-bell-btn{position:relative;width:36px;height:34px;border-radius:10px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;display:flex;align-items:center;justify-content:center;transition:.15s}
        .notif-bell-btn:hover{background:#334155;color:#fff}.notif-badge{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #0f172a}
        .notif-panel{position:fixed;right:12px;top:70px;width:min(410px,calc(100vw - 24px));max-height:min(680px,calc(100vh - 86px));z-index:10050;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 25px 70px rgba(15,23,42,.25);overflow:hidden;color:#0f172a}
        .notif-panel.hidden{display:none}.notif-list{max-height:500px;overflow-y:auto}.notif-item{display:flex;gap:10px;padding:12px;border-bottom:1px solid #f1f5f9;background:#fff;text-align:left;width:100%}.notif-item:hover{background:#f8fafc}.notif-item.unread{background:#eff6ff}
        .notif-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.notif-icon.info{background:#dbeafe;color:#1d4ed8}.notif-icon.warning{background:#fef3c7;color:#b45309}.notif-icon.success{background:#d1fae5;color:#047857}.notif-icon.danger{background:#fee2e2;color:#b91c1c}.notif-item.danger{border-left:4px solid #dc2626;background:#fff7f7}.notif-item.danger.unread{background:#fff1f2}.notif-item.danger .notif-title{color:#b91c1c}.notif-item.danger .notif-icon{animation:notifDangerPulse 1.25s ease-in-out infinite}@keyframes notifDangerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        .notif-title{font-size:11px;font-weight:900}.notif-message{font-size:10px;line-height:1.45;color:#475569;margin-top:2px}.notif-meta{font-size:9px;color:#94a3b8;margin-top:4px}.notif-dot{width:8px;height:8px;border-radius:999px;background:#2563eb;flex:0 0 auto;margin-top:5px}
        @media(max-width:720px){.notif-panel{right:6px;left:6px;top:62px;width:auto;max-height:calc(100vh - 72px);border-radius:16px}.notif-list{max-height:calc(100vh - 235px)}}
    `;
    document.head.appendChild(style);

    const layoutHTML = `
    <!-- TELA DE LOGIN -->
    <div id="login-screen" class="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-200 text-center space-y-6">
            <div class="flex flex-col items-center justify-center gap-2">
                <svg class="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 10 L85 45 L50 80 L15 45 Z" fill="#002D72"/>
                    <path d="M50 20 L75 45 L50 70 L25 45 Z" fill="#0077C8" fill-opacity="0.8"/>
                    <path d="M50 30 L65 45 L50 60 L35 45 Z" fill="#64B5F6"/>
                </svg>
                <h1 class="text-2xl font-black text-[#002d72] tracking-tight mt-1">PORTAL GRUPO CIJ</h1>
                <p id="login-message" class="text-xs font-semibold text-slate-500">Acesso Restrito</p>
            </div>
            <form id="auth-form" class="space-y-4 text-left" onsubmit="window.handleLogin(event)">
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail Corporativo</label>
                    <input type="email" id="auth-email" required placeholder="seu.nome@grupocij.com.br" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-600 font-medium text-slate-900">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Senha</label>
                    <input type="password" id="auth-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-600 text-slate-900">
                </div>
                
                <div class="flex items-center justify-between text-xs pt-1">
                    <label class="flex items-center gap-2 text-slate-600 font-semibold cursor-pointer select-none">
                        <input type="checkbox" id="lembrar-dispositivo" class="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"> Lembrar neste dispositivo
                    </label>
                    <button type="button" onclick="window.esqueciMinhaSenha()" class="text-blue-600 hover:text-blue-800 font-bold transition cursor-pointer">Esqueci a senha?</button>
                </div>

                <button type="submit" class="w-full py-3 bg-[#002d72] hover:bg-blue-900 text-white font-extrabold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2">
                    <i class="fa-solid fa-right-to-bracket"></i> Entrar
                </button>
            </form>
        </div>
    </div>

    <!-- CABEÇALHO SUPERIOR FIXO -->
    <header class="bg-[#0f172a] text-white shadow-md border-b border-slate-800 sticky top-0 z-[9990] h-16 shrink-0 w-full no-print">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
            <div class="flex items-center justify-between h-full gap-2 sm:gap-4">
                
                <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div class="flex items-center gap-3 shrink-0">
                        <div class="p-1.5 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 hidden sm:flex">
                            <svg style="width: 28px; height: 28px; display: inline-block;" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 10 L85 45 L50 80 L15 45 Z" fill="#0077C8"/>
                                <path d="M50 20 L75 45 L50 70 L25 45 Z" fill="#64B5F6"/>
                            </svg>
                        </div>
                        <div class="flex flex-col justify-center hidden sm:flex">
                            <span id="secret-trigger-btn" class="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 cursor-pointer select-none transition hover:bg-amber-900">COMERCIAL & GESTÃO</span>
                            <span id="user-role-badge-top" class="text-[9px] font-bold text-slate-400 mt-0.5">Carregando...</span>
                        </div>
                    </div>

                    <!-- Caixa de Pesquisa Global Flexível Mobile -->
                    <div class="core-global-search relative flex-1 sm:w-64 sm:flex-none ml-0 sm:ml-2">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                        <input type="text" id="global-search-input" onkeyup="window.filterGlobalModules()" placeholder="Buscar módulo..." class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-slate-700 transition-all placeholder-slate-500">
                        <ul id="global-search-results" class="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden z-[9999] hidden max-h-60 overflow-y-auto custom-scrollbar"></ul>
                    </div>
                </div>

                <nav class="hidden lg:flex items-center gap-1 flex-1 justify-center h-full" id="desktop-nav-menu">
                    
                    <!-- SERVIÇOS -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-servicos">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-truck-fast text-emerald-400"></i> Serviços <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="suporte-mobile.html" data-module="suporte-mobile.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-headset"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Suporte OSR</h4><p class="text-[10px] text-slate-500">Novo chamado mobile</p></div></a>

                                <a href="assistencia.html" data-module="assistencia.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-screwdriver-wrench"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Assistência Técnica</h4><p class="text-[10px] text-slate-500">Kanban, OS, orçamento e gestão</p></div></a>

                                <a href="certificacao.html" data-module="certificacao.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-circle-check"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Certificação de Equipamentos</h4><p class="text-[10px] text-slate-500">Serviço offline, revisão e certificados</p></div></a>

                                <a href="padroes_teste.html" data-module="padroes_teste.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-ruler-combined"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Padrões de Teste</h4><p class="text-[10px] text-slate-500">Banco, calibração em laboratório e campo</p></div></a>

                                <a href="cert_alertas.html" data-module="cert_alertas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-bell"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Alertas de Certificação</h4><p class="text-[10px] text-slate-500">Revisão, envio e liberação para faturar</p></div></a>

                                <a href="central_os.html" data-module="central_os.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-table-list"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Central de OS</h4><p class="text-[10px] text-slate-500">Consulta, indicadores e faturamento</p></div></a>

                                <a href="assistencia.html?modo=tecnico" data-module="app_tecnico.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-mobile-screen-button"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">App do Técnico</h4><p class="text-[10px] text-slate-500">Execução mobile e offline</p></div></a>

                                <a href="parque_consulta.html" data-module="parque_consulta.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-industry"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Consulta Parque</h4><p class="text-[10px] text-slate-500">Somente leitura · histórico OS/OSR</p></div></a>

                                <a href="servicos_osr.html" data-module="servicos_osr.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-table-list"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Gestão de OSR</h4><p class="text-[10px] text-slate-500">Painel de atendimentos</p></div></a>

                                <a href="veiculos_mobile.html" data-module="veiculos_mobile.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-car"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Veículos Mobile</h4><p class="text-[10px] text-slate-500">Retirada da frota</p></div></a>
                            </div>
                        </div>
                    </div>

                    <!-- COMERCIAL -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-comercial">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-handshake text-blue-400"></i> Comercial <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[32rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="simulador.html" data-module="simulador.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-calculator"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Simulador Financeiro</h4></div></a>
                                <a href="solicitacao.html" data-module="solicitacao.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-signature"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Solicitação CIJ</h4></div></a>
                                <a href="tabelas.html" data-module="tabelas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-pdf"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Documentos Oficiais</h4></div></a>
                                <a href="ranking.html" data-module="ranking.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center shrink-0"><i class="fa-solid fa-trophy"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Ranking de Vendas</h4></div></a>
                            </div>
                        </div>
                    </div>

                    <!-- ESTOQUE E LOGÍSTICA -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-estoque">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-boxes-stacked text-cyan-400"></i> Logística <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="requisicao_material.html" data-module="requisicao_material.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-toolbox"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Req. de Material</h4><p class="text-[10px] text-slate-500">Aprovação/Baixas</p></div></a>
                                <a href="estoque_pecas.html" data-module="estoque_pecas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-boxes-stacked"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Estoque de Peças</h4><p class="text-[10px] text-slate-500">Endereçamento, fotos e movimentações</p></div></a>
                                <a href="estoque-novos.html" data-module="estoque-novos.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-boxes-stacked"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Estoque Novos</h4><p class="text-[10px] text-slate-500">Máquinas Faturamento</p></div></a>
                                <a href="estoque.html" data-module="estoque.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-box-open"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Estoque Geral</h4><p class="text-[10px] text-slate-500">Usados e Demonstração</p></div></a>
                            </div>
                        </div>
                    </div>

                    <!-- ADMINISTRATIVO -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-admin">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-shield-halved text-purple-400"></i> Administrativo <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[32rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="solicitacoes-lista.html" data-module="solicitacoes-lista.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-list-check"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Lista Solicitações</h4></div></a>
                                <a href="veiculos.html" data-module="veiculos.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0"><i class="fa-solid fa-car-tunnel"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Veículos Gerencial</h4></div></a>
                                <a href="vendas.html" data-module="vendas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-cart-shopping"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Vendas (Saídas)</h4></div></a>
                                <a href="admin.html" data-module="admin.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-shield-halved"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Painel Diretoria</h4></div></a>
                                <a href="usuarios.html" data-module="usuarios.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-100 flex items-center justify-center shrink-0"><i class="fa-solid fa-users-gear"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Gerenciar Usuários</h4></div></a>
                                <a href="central_cadastros.html" data-module="central_cadastros.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-database"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Central Cadastros</h4></div></a>
                                <a href="parque_maquinas.html" data-module="parque_maquinas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-industry"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Parque de Máquinas</h4><p class="text-[10px] text-slate-500">Ativos, garantia e QR Code</p></div></a>
                                <a href="formcraft_sandbox.html" data-module="formcraft_sandbox.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-flask-vial"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">FormCraft (Beta)</h4></div></a>
                            </div>
                        </div>
                    </div>

                    <!-- FINANCEIRO -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-financeiro">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-sack-dollar text-amber-400"></i> Financeiro <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 right-0 mt-1 w-[38rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="despesas.html" data-module="despesas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-receipt"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Controle Despesas</h4></div></a>
                                <a href="dashboard_despesas.html" data-module="dashboard_despesas.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-chart-pie"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Dashboard Gerencial</h4></div></a>
                                <a href="comissoes-azul.html" data-module="comissoes-azul.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-chart-line"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Comissões Azul</h4></div></a>
                                <a href="comissoes_beta.html" data-module="comissoes_beta.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-amber-50 transition border border-amber-100"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-flask"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Gestão de Comissões Beta</h4><p class="text-[10px] text-amber-700">Ambiente de testes</p></div></a>
                                <a href="comissoes-consumiveis.html" data-module="comissoes-consumiveis.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-invoice-dollar"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Com. Consumíveis</h4></div></a>
                                <a href="comissoes-representantes.html" data-module="comissoes-representantes.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0"><i class="fa-solid fa-hand-holding-dollar"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Com. Representantes</h4></div></a>
                            </div>
                        </div>
                    </div>

                    <!-- DIRETORIA SECRETO -->
                    <div class="relative group h-full flex items-center nav-category" id="cat-diretoria">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"><i class="fa-solid fa-vault text-amber-500"></i> Diretoria <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 right-0 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="p-2 flex flex-col gap-1 text-slate-800">
                                <a href="diretoria-custos.html" data-module="diretoria-custos.html" class="nav-item flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-scale-balanced"></i></div><div><h4 class="text-xs font-bold text-slate-900 mt-1">Custos & Margens</h4></div></a>
                            </div>
                        </div>
                    </div>

                </nav>

                <div class="flex items-center gap-2 shrink-0 ml-2">
                    <button id="notif-bell-btn" onclick="window.toggleNotificationCenter()" class="notif-bell-btn" title="Notificações"><i class="fa-solid fa-bell"></i><span id="notif-badge" class="notif-badge hidden">0</span></button>
                    <a href="index.html" class="hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition items-center gap-1.5 hover:bg-slate-800"><i class="fa-solid fa-house"></i> Home</a>
                    <button onclick="window.fazerLogout()" class="hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-bold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 transition items-center gap-1.5 cursor-pointer"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
                    <!-- Botão Menu Mobile Corrigido -->
                    <button onclick="window.toggleMobileMenu()" class="lg:hidden text-slate-300 hover:text-white text-xl p-1 px-2 border border-slate-700 rounded-lg bg-slate-800 cursor-pointer">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                </div>
            </div>
        </div>
    </header>

    <section id="notif-panel" class="notif-panel hidden no-print">
        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
            <div><div class="text-xs font-black"><i class="fa-solid fa-bell text-blue-600 mr-1"></i>Notificações</div><div id="notif-subtitle" class="text-[9px] text-slate-500 mt-0.5">Carregando...</div></div>
            <button onclick="window.toggleNotificationCenter(false)" class="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-500"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-2">
            <button id="notif-enable-device" onclick="window.ativarNotificacoesDispositivo()" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-blue-600 text-white"><i class="fa-solid fa-mobile-screen mr-1"></i>Ativar no dispositivo</button>
            <button onclick="window.testarPushDispositivo()" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-blue-300 text-blue-700 bg-blue-50">Testar push</button>
            <button onclick="window.desativarPushDispositivo()" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-slate-300 text-slate-600 bg-white">Desativar neste aparelho</button>
            <a id="notif-push-config" href="push-configuracao.html" class="hidden px-2.5 py-1.5 rounded-lg text-[10px] font-black text-blue-700">Configurar envio</a>
            <button id="notif-test-vibrate" onclick="window.testarVibracaoDispositivo()" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-amber-300 text-amber-700 bg-amber-50"><i class="fa-solid fa-mobile-screen-button mr-1"></i>Testar vibração</button>
            <button onclick="window.marcarTodasNotificacoesLidas()" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-slate-300 text-slate-600 bg-white"><i class="fa-solid fa-check-double mr-1"></i>Marcar todas como lidas</button>
            <div id="notif-device-status" class="w-full text-[9px] text-slate-500"></div>
        </div>
        <div id="notif-list" class="notif-list"><div class="p-8 text-center text-xs text-slate-400">Nenhuma notificação.</div></div>
    </section>

    <!-- Sidebar Mobile -->
    <div id="mobile-overlay" onclick="window.toggleMobileMenu()" class="fixed inset-0 bg-black/60 z-[105] hidden opacity-0 transition-opacity duration-300 backdrop-blur-sm lg:hidden"></div>
    <div id="mobile-sidebar" class="fixed inset-y-0 right-0 w-[280px] bg-[#0f172a] shadow-2xl z-[110] transform translate-x-full transition-transform duration-300 border-l border-slate-700 flex flex-col lg:hidden">
        <div class="p-5 flex justify-between items-center border-b border-slate-800 bg-[#0b1120]">
            <span class="font-bold text-white text-sm uppercase tracking-wider">Módulos</span>
            <button onclick="window.toggleMobileMenu()" class="text-slate-400 hover:text-white text-2xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-2" id="mobile-menu-container"></div>
        <div class="p-4 border-t border-slate-800 bg-[#0b1120] space-y-2">
            <button onclick="window.fazerLogout()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 transition flex items-center justify-center gap-2 cursor-pointer"><i class="fa-solid fa-right-from-bracket"></i> Sair da Conta</button>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', layoutHTML);

    let secretClicks = 0;
    let secretTimeout;
    const secretBtn = document.getElementById('secret-trigger-btn');
    
    if (secretBtn) {
        secretBtn.addEventListener('click', () => {
            secretClicks++;
            clearTimeout(secretTimeout);
            secretTimeout = setTimeout(() => { secretClicks = 0; }, 1000);
            if (secretClicks >= 3) {
                document.body.classList.toggle('diretoria-unlocked');
                secretClicks = 0;
            }
        });
    }
};

injectLayout();

const firebaseConfig = {
    apiKey: "AIzaSyDW05GuYDxXUCmtWfSxhfap1-l6_qkNspw",
    authDomain: "plataforma-cij.firebaseapp.com",
    projectId: "plataforma-cij",
    storageBucket: "plataforma-cij.firebasestorage.app",
    messagingSenderId: "949985395100",
    appId: "1:949985395100:web:cf881e0c91c63175228859"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
} catch (error) {
    db = getFirestore(app);
}

instalarPushCIJ(app, notifSetDeviceStatus);
window.AppAuth = auth;
window.AppDB = db;
window.AppStorage = storage;
window.fbStorageRef = storageRef;
window.fbUploadBytes = uploadBytes;
window.fbGetDownloadURL = getDownloadURL;
window.fbDeleteObject = deleteObject;
window.fsCollection = collection;
window.fsDoc = doc;
window.fsSetDoc = setDoc;
window.fsDeleteDoc = deleteDoc;
window.fsOnSnapshot = onSnapshot;
window.fsGetDoc = getDoc;
window.fsGetDocs = getDocs;
window.fsRunTransaction = runTransaction;
window.fsGetDocFromServer = getDocFromServer;
window.fsGetDocsFromServer = getDocsFromServer;
window.fsQuery = query;
window.fsWhere = where;
window.fbGetBlob = getBlob;


const moduleAccessAliases = {
    'cadastros_clientes.html': 'central_cadastros.html',
    'cliente_ficha.html': 'central_cadastros.html',
    'cadastros_modelos.html': 'central_cadastros.html',
    'cadastros_pecas.html': 'estoque_pecas.html',
    'cadastros_consumiveis.html': 'central_cadastros.html',
    'parque_ficha.html': 'parque_maquinas.html'
};

const globalModulesMap = [
    { name: 'Suporte OSR', url: 'suporte-mobile.html', icon: 'fa-headset text-blue-500' },
    { name: 'Assistência Técnica', url: 'assistencia.html', icon: 'fa-screwdriver-wrench text-blue-500' },
    { name: 'Certificação de Equipamentos', url: 'certificacao.html', icon: 'fa-file-circle-check text-teal-600' },
    { name: 'Padrões de Teste', url: 'padroes_teste.html', icon: 'fa-ruler-combined text-teal-600' },
    { name: 'Alertas de Certificação', url: 'cert_alertas.html', icon: 'fa-bell text-teal-600' },
    { name: 'Central de OS', url: 'central_os.html', icon: 'fa-table-list text-cyan-600' },
    { name: 'App do Técnico', url: 'app_tecnico.html', href: 'assistencia.html?modo=tecnico', icon: 'fa-mobile-screen-button text-sky-500' },
    { name: 'Consulta Parque', url: 'parque_consulta.html', icon: 'fa-industry text-indigo-700' },
    { name: 'Gestão de OSR', url: 'servicos_osr.html', icon: 'fa-table-list text-indigo-500' },
    { name: 'Veículos Mobile', url: 'veiculos_mobile.html', icon: 'fa-car text-emerald-600' },
    { name: 'Simulador Financeiro', url: 'simulador.html', icon: 'fa-calculator text-teal-600' },
    { name: 'Solicitação CIJ', url: 'solicitacao.html', icon: 'fa-file-signature text-blue-600' },
    { name: 'Documentos Oficiais', url: 'tabelas.html', icon: 'fa-file-pdf text-amber-600' },
    { name: 'Ranking de Vendas', url: 'ranking.html', icon: 'fa-trophy text-orange-500' },
    { name: 'Req. de Material', url: 'requisicao_material.html', icon: 'fa-toolbox text-amber-600' },
    { name: 'Estoque de Peças', url: 'estoque_pecas.html', icon: 'fa-boxes-stacked text-sky-700' },
    { name: 'Estoque Novos', url: 'estoque-novos.html', icon: 'fa-boxes-stacked text-cyan-600' },
    { name: 'Estoque Usados/Geral', url: 'estoque.html', icon: 'fa-box-open text-slate-600' },
    { name: 'Lista de Solicitações', url: 'solicitacoes-lista.html', icon: 'fa-list-check text-orange-600' },
    { name: 'Veículos Gerencial', url: 'veiculos.html', icon: 'fa-car-tunnel text-teal-700' },
    { name: 'Vendas (Saídas)', url: 'vendas.html', icon: 'fa-cart-shopping text-rose-600' },
    { name: 'Painel Diretoria', url: 'admin.html', icon: 'fa-shield-halved text-purple-600' },
    { name: 'Gerenciar Usuários', url: 'usuarios.html', icon: 'fa-users-gear text-slate-800' },
    { name: 'Central de Cadastros', url: 'central_cadastros.html', icon: 'fa-database text-blue-600' },
    { name: 'Parque de Máquinas', url: 'parque_maquinas.html', icon: 'fa-industry text-indigo-700' },
    { name: 'FormCraft (Beta)', url: 'formcraft_sandbox.html', icon: 'fa-flask-vial text-orange-500' },
    { name: 'Controle de Despesas', url: 'despesas.html', icon: 'fa-receipt text-sky-600' },
    { name: 'Dashboard Gerencial', url: 'dashboard_despesas.html', icon: 'fa-chart-pie text-emerald-700' },
    { name: 'Comissões Azul', url: 'comissoes-azul.html', icon: 'fa-chart-line text-indigo-600' },
    { name: 'Gestão de Comissões Beta', url: 'comissoes_beta.html', icon: 'fa-flask text-amber-600' },
    { name: 'Com. Consumíveis', url: 'comissoes-consumiveis.html', icon: 'fa-file-invoice-dollar text-amber-700' },
    { name: 'Com. Representantes', url: 'comissoes-representantes.html', icon: 'fa-hand-holding-dollar text-cyan-800' },
    { name: 'Custos & Margens (Diretoria)', url: 'diretoria-custos.html', icon: 'fa-scale-balanced text-amber-600' }
];

window.filterGlobalModules = function() {
    const input = document.getElementById('global-search-input').value.toLowerCase();
    const resultBox = document.getElementById('global-search-results');
    
    if (input.length < 1) { resultBox.classList.add('hidden'); return; }

    const allowedModules = Array.from(document.querySelectorAll('#desktop-nav-menu a.nav-item'))
                             .filter(a => a.style.display !== 'none')
                             .map(a => a.getAttribute('data-module'));

    if (document.body.classList.contains('diretoria-unlocked')) {
        allowedModules.push('diretoria-custos.html');
    }

    const filtered = globalModulesMap.filter(m => m.name.toLowerCase().includes(input) && allowedModules.includes(m.url));

    if (filtered.length > 0) {
        resultBox.innerHTML = filtered.map(m => `
            <li class="border-b border-slate-100 last:border-0">
                <a href="${m.href || m.url}" class="flex items-center gap-3 p-3 hover:bg-slate-50 transition text-xs font-bold text-slate-700">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><i class="fa-solid ${m.icon}"></i></div>
                    ${m.name}
                </a>
            </li>
        `).join('');
        resultBox.classList.remove('hidden');
    } else {
        resultBox.innerHTML = `<li class="p-4 text-center text-xs text-slate-500 font-medium">Nenhum módulo encontrado.</li>`;
        resultBox.classList.remove('hidden');
    }
};

document.addEventListener('click', function(e) {
    const searchBox = document.getElementById('global-search-results');
    if (searchBox && !e.target.closest('.relative.flex-1.sm\\:w-64')) {
        searchBox.classList.add('hidden');
    }
});

window.toggleMobileMenu = function() {
    const sidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if(sidebar.classList.contains('translate-x-full')) {
        sidebar.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
};

window.fazerLogout = async () => { await window.desativarPushDispositivo?.(); return signOut(auth); };

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const lembrar = document.getElementById('lembrar-dispositivo')?.checked || false;

    try {
        await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        alert("Erro no login: E-mail ou senha incorretos.");
    }
};

window.esqueciMinhaSenha = async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
        alert("Por favor, preencha o campo de e-mail corporativo primeiro para recuperar a senha.");
        document.getElementById('auth-email').focus();
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.");
    } catch (err) {
        alert("Erro ao enviar e-mail de recuperação: " + err.message);
    }
};


// FASE 1.66.3 — controle estrito de módulos.
// Master é a única exceção global. Demais perfis obedecem aos checkboxes.
function userHasModuleAccess(dbUser, url) {
    if (!dbUser || !url) return false;
    if (dbUser.perfil === 'Master') return true;
    const mods = Array.isArray(dbUser.modulos) ? dbUser.modulos : [];
    return mods.includes(url);
}

function userHasGlobalView(dbUser, url) {
    if (!dbUser || !url) return false;
    if (dbUser.perfil === 'Master') return true;
    const vg = dbUser.visaoGlobalPorTela || {};
    return vg[url] === true;
}

window.portalTemAcessoModulo = url => userHasModuleAccess(window.userProfile, url);
window.portalTemVisaoGlobal = url => userHasGlobalView(window.userProfile, url);

window.aplicarPermissoesDeModulos = function(dbUser) {
    const allLinks = document.querySelectorAll('a.nav-item');
    allLinks.forEach(link => {
        const url = link.getAttribute('data-module');
        link.style.display = userHasModuleAccess(dbUser, url) ? 'flex' : 'none';
    });

    const categories = document.querySelectorAll('.nav-category');
    categories.forEach(cat => {
        const linksInside = Array.from(cat.querySelectorAll('a.nav-item'));
        const hasVisibleLink = linksInside.some(l => l.style.display !== 'none');
        if (hasVisibleLink && cat.id !== 'cat-diretoria') cat.style.display = 'flex';
        else if (cat.id !== 'cat-diretoria') cat.style.display = 'none';
    });

    const mobContainer = document.getElementById('mobile-menu-container');
    if(mobContainer) {
        mobContainer.innerHTML = '<a href="index.html" class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700 hover:bg-slate-700"><i class="fa-solid fa-house text-blue-400"></i> Home</a>';

        globalModulesMap.forEach(m => {
            if (userHasModuleAccess(dbUser, m.url)) {
                const isSecret = m.url === 'diretoria-custos.html' ? 'mobile-secret' : '';
                mobContainer.innerHTML += `<a href="${m.href || m.url}" class="${isSecret} flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700 hover:bg-slate-700"><i class="fa-solid ${m.icon} w-5 text-center"></i> ${m.name}</a>`;
            }
        });
    }

    const badgeTop = document.getElementById('user-role-badge-top');
    if(badgeTop) badgeTop.innerText = dbUser.perfil + ' • ' + (dbUser.nome || window.currentUser.email.split('@')[0].toUpperCase());
};

// ==========================================
// CENTRAL UNIVERSAL DE NOTIFICAÇÕES & ALERTAS — V1.76
// ==========================================
window.__notifState={rows:[],readIds:new Set(),profile:null,user:null,initial:true,startedAt:Date.now(),unsubs:[]};
function notifSafeId(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,140)}
function notifUserKey(){const s=window.__notifState;return String(s.user?.email||s.profile?.email||s.user?.uid||'').toLowerCase().trim()}
function notifReadDocId(id){return notifSafeId(notifUserKey())+'__'+notifSafeId(id)}
function notifTarget(n,profile,user){
    if(!n)return false;
    const email=String(user?.email||profile?.email||'').toLowerCase().trim();
    const uid=String(user?.uid||profile?.authUid||profile?.uid||'').trim();
    const perfil=String(profile?.perfil||'').toLowerCase().trim();
    const emails=(n.targetEmails||[]).map(x=>String(x||'').toLowerCase().trim()).filter(Boolean);
    const uids=(n.targetUids||[]).map(x=>String(x||'').trim()).filter(Boolean);
    const profiles=(n.targetProfiles||[]).map(x=>String(x||'').toLowerCase().trim()).filter(Boolean);

    // Regra estrita: não existe mais exceção para Master.
    // O usuário só recebe se for destinatário explícito ou se o alerta for broadcast.
    if(n.broadcast===true)return true;
    if(email&&emails.includes(email))return true;
    if(uid&&uids.includes(uid))return true;
    if(perfil&&profiles.includes(perfil))return true;
    return false;
}
function notifTs(n){return Number(n.timestamp||Date.parse(n.createdAtISO||'')||0)}
function notifEsc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function notifType(n){const t=String(n.tipo||'info').toLowerCase();return ['info','warning','success','danger'].includes(t)?t:'info'}
function notifVibrationPattern(n){
    const t=notifType(n);
    if(t==='danger')return [350,120,350,120,650];
    if(t==='warning')return [250,100,250];
    if(t==='success')return [120];
    return [180,90,180];
}
function notifDeviceTitle(n){
    return notifType(n)==='danger' ? `URGENTE · ${n.titulo||'Portal CIJ'}` : (n.titulo||'Portal CIJ');
}

function notifSetDeviceStatus(message,kind='info'){
    const el=document.getElementById('notif-device-status');if(!el)return;
    el.className='w-full text-[9px] '+(kind==='ok'?'text-emerald-700':kind==='error'?'text-rose-700':kind==='warning'?'text-amber-700':'text-slate-500');
    el.textContent=message||'';
}
function notifVibrationCapability(){
    return {
        api:typeof navigator!=='undefined'&&typeof navigator.vibrate==='function',
        activated:!!navigator.userActivation?.hasBeenActive,
        permission:('Notification'in window)?Notification.permission:'unsupported'
    };
}
window.testarVibracaoDispositivo=function(){
    const cap=notifVibrationCapability();
    if(!cap.api){
        notifSetDeviceStatus('Este navegador/aparelho não oferece a API de vibração para páginas web.','error');
        alert('A vibração não é suportada pelo navegador deste aparelho.');
        return false;
    }
    let ok=false;
    try{ok=navigator.vibrate([300,120,300,120,500])===true}catch(_){ok=false}
    if(ok)notifSetDeviceStatus('O navegador aceitou o comando de vibração. Se não vibrou, revise Som/Vibração e Não Perturbe no celular.','ok');
    else notifSetDeviceStatus('O navegador recusou o comando de vibração neste aparelho.','warning');
    return ok;
};

function notifIcon(t){return ({info:'fa-circle-info',warning:'fa-triangle-exclamation',success:'fa-circle-check',danger:'fa-circle-exclamation'})[t]||'fa-bell'}
window.enviarNotificacaoApp=async function(payloadOrMessage,targetEmails=[],targetProfiles=[],tipo='info'){
    const p=(payloadOrMessage&&typeof payloadOrMessage==='object')?{...payloadOrMessage}:{mensagem:String(payloadOrMessage||''),targetEmails,targetProfiles,tipo};
    const mensagem=String(p.mensagem||p.message||'').trim();if(!mensagem)return null;
    const id=p.id||('notif_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),now=Date.now();
    const data={id,titulo:p.titulo||p.title||'Portal CIJ',mensagem,tipo:p.tipo||tipo||'info',
      targetEmails:(p.targetEmails||targetEmails||[]).map(x=>String(x||'').toLowerCase().trim()).filter(Boolean),
      targetUids:(p.targetUids||[]).map(x=>String(x||'').trim()).filter(Boolean),targetProfiles:(p.targetProfiles||targetProfiles||[]).filter(Boolean),
      broadcast:p.broadcast===true,modulo:p.modulo||'',url:p.url||'',actionLabel:p.actionLabel||'Abrir',osId:p.osId||'',osNumber:p.osNumber||'',
      eventType:p.eventType||'',sourceId:p.sourceId||'',dedupeKey:p.dedupeKey||'',createdAtISO:new Date(now).toISOString(),
      createdByEmail:String(window.currentUser?.email||'').toLowerCase(),createdByName:window.nomeUsuarioLogado||'',timestamp:now};
    try{await setDoc(doc(db,'artifacts','plataforma-cij','public','data','notificacoes_app',id),data);return id}
    catch(e){console.error('[Core] envio de notificação',e);return null}
};
window.toggleNotificationCenter=function(force){const p=document.getElementById('notif-panel');if(!p)return;const open=typeof force==='boolean'?force:p.classList.contains('hidden');p.classList.toggle('hidden',!open);if(open)window.renderNotificationCenter?.()};
async function notifMarkRead(id){
    if(!id||!notifUserKey())return;window.__notifState.readIds.add(String(id));
    try{const rid=notifReadDocId(id);await setDoc(doc(db,'artifacts','plataforma-cij','public','data','notificacoes_app_leituras',rid),{id:rid,notificationId:id,userKey:notifUserKey(),lidaEmISO:new Date().toISOString(),timestamp:Date.now()})}catch(e){console.warn('[Core] leitura notificação',e)}
}
window.abrirNotificacao=async function(id){const n=(window.__notifState.rows||[]).find(x=>String(x.id)===String(id));if(!n)return;await notifMarkRead(id);window.renderNotificationCenter?.();if(n.url)location.href=n.url};
window.marcarTodasNotificacoesLidas=async function(){const s=window.__notifState,rows=(s.rows||[]).filter(n=>notifTarget(n,s.profile,s.user));for(const n of rows){if(!s.readIds.has(String(n.id)))await notifMarkRead(n.id)}window.renderNotificationCenter?.()};
window.renderNotificationCenter=function(){
    const s=window.__notifState,box=document.getElementById('notif-list'),badge=document.getElementById('notif-badge'),sub=document.getElementById('notif-subtitle');if(!box||!s.profile)return;
    const rows=(s.rows||[]).filter(n=>notifTarget(n,s.profile,s.user)).sort((a,b)=>notifTs(b)-notifTs(a)).slice(0,80),unread=rows.filter(n=>!s.readIds.has(String(n.id))).length;
    if(badge){badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hidden',unread===0)}
    if(sub)sub.textContent=unread?`${unread} não lida${unread===1?'':'s'} · ${rows.length} recentes`:`${rows.length} notificação${rows.length===1?'':'ões'} · tudo em dia`;
    window.dispatchEvent(new CustomEvent('cij-notifications-updated',{detail:{unread}}));
    box.innerHTML=rows.length?rows.map(n=>{const unreadRow=!s.readIds.has(String(n.id)),t=notifType(n);return `<button class="notif-item ${t==='danger'?'danger':''} ${unreadRow?'unread':''}" onclick="window.abrirNotificacao('${notifEsc(n.id)}')"><span class="notif-icon ${t}"><i class="fa-solid ${notifIcon(t)}"></i></span><span class="min-w-0 flex-1"><span class="notif-title">${notifEsc(n.titulo||'Portal CIJ')}</span><span class="notif-message block">${notifEsc(n.mensagem||'')}</span><span class="notif-meta block">${new Date(notifTs(n)).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}${n.osNumber?' · '+notifEsc(n.osNumber):''}</span></span>${unreadRow?'<span class="notif-dot"></span>':''}</button>`}).join(''):'<div class="p-8 text-center text-xs text-slate-400"><i class="fa-regular fa-bell-slash text-2xl mb-2"></i><div>Nenhuma notificação para você.</div></div>';
};
async function notifShowDevice(n){
    // O push é exibido pelo worker, evitando duplicação com o radar do Firestore.
    if(window.cijPushEstaAtivo?.())return;
    if(!('Notification'in window)||Notification.permission!=='granted')return;
    const pattern=notifVibrationPattern(n),danger=notifType(n)==='danger';
    try{
        if(typeof navigator.vibrate==='function'&&navigator.userActivation?.hasBeenActive){
            navigator.vibrate(pattern);
        }
    }catch(_){}
    try{
        const reg=await navigator.serviceWorker?.ready;
        if(reg)await reg.showNotification(notifDeviceTitle(n),{
            body:n.mensagem||'',icon:'assistencia-icon-192.png',badge:'assistencia-icon-192.png',
            tag:n.dedupeKey||n.id,renotify:danger,silent:false,vibrate:pattern,requireInteraction:danger,
            data:{url:n.url||location.href,notificationId:n.id,tipo:notifType(n)}
        });
    }catch(e){console.warn('[Core] alerta dispositivo',e)}
}
window.iniciarRadarNotificacoes=function(dbUser){
    const s=window.__notifState;s.profile=dbUser;s.user=window.currentUser;s.startedAt=Date.now();s.initial=true;for(const u of s.unsubs||[]){try{u()}catch(_){}}s.unsubs=[];
    const reads=collection(db,'artifacts','plataforma-cij','public','data','notificacoes_app_leituras'),notifs=collection(db,'artifacts','plataforma-cij','public','data','notificacoes_app');
    s.unsubs.push(onSnapshot(reads,snap=>{const key=notifUserKey(),set=new Set();snap.forEach(d=>{const x=d.data();if(String(x.userKey||'').toLowerCase()===key)set.add(String(x.notificationId||''))});s.readIds=set;window.renderNotificationCenter?.()},e=>console.warn('[Core] leituras',e)));
    s.unsubs.push(onSnapshot(notifs,snap=>{const prev=new Set((s.rows||[]).map(x=>String(x.id)));s.rows=[];snap.forEach(d=>s.rows.push({id:d.id,...d.data()}));const fresh=s.rows.filter(n=>!prev.has(String(n.id))&&notifTarget(n,dbUser,window.currentUser)&&notifTs(n)>=s.startedAt-2500);window.renderNotificationCenter?.();if(!s.initial)fresh.sort((a,b)=>notifTs(a)-notifTs(b)).forEach(notifShowDevice);s.initial=false},e=>console.warn('[Core] notificações',e)));
    // A permissão do navegador não basta: push-client confirma o registro no servidor.
};

// FASE 1.66.2 — perfil autenticado local para inicialização offline
const CORE_OFFLINE_PROFILE_KEY='cij_core_offline_profile_v2';

function saveCoreOfflineProfile(user,profile){
    try{
        if(!user||!profile)return;
        localStorage.setItem(CORE_OFFLINE_PROFILE_KEY,JSON.stringify({
            uid:user.uid||'',
            email:String(user.email||profile.email||'').toLowerCase().trim(),
            profile:{...profile},
            savedAtISO:new Date().toISOString(),
            schemaVersion:2
        }));
    }catch(e){
        console.warn('[Core] não foi possível salvar perfil offline',e);
    }
}

function readCoreOfflineProfile(user){
    try{
        const raw=localStorage.getItem(CORE_OFFLINE_PROFILE_KEY);
        if(!raw)return null;
        const row=JSON.parse(raw);
        const email=String(user?.email||'').toLowerCase().trim();
        if(!row?.profile)return null;
        if(row.uid&&user?.uid&&String(row.uid)!==String(user.uid))return null;
        if(row.email&&email&&String(row.email)!==email)return null;
        return {...row.profile};
    }catch(_){
        return null;
    }
}

onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    if (user) {
        if(loginScreen) loginScreen.classList.add('hidden');
        
        // Atualiza a identificação de acesso emitida pelo servidor; mantém a sessão e o push.
        if (navigator.onLine !== false && typeof user.getIdToken === 'function') {
            try { await user.getIdToken(true); }
            catch (e) { console.warn('[Core] atualização da identificação de acesso', e); }
        }
        const cleanEmail = (user.email || '').toLowerCase().trim();
        let dbUser = null;

        try {
            const snap = await getDocs(collection(db, 'artifacts', 'plataforma-cij', 'public', 'data', 'usuarios_permissoes'));
            snap.forEach(d => { 
                if (String(d.data().email||'').toLowerCase().trim() === cleanEmail) {
                    dbUser = {...d.data(), id:d.id};
                }
            });
        } catch (e) {
            console.error("Erro ao ler permissões", e);
            if (navigator.onLine === false) {
                dbUser = readCoreOfflineProfile(user);
                if (dbUser) console.info("[Core] Perfil de acesso restaurado do armazenamento local.");
            }
        }

        // Se a consulta retornou vazia durante cold-start offline, tenta o último perfil
        // autenticado deste mesmo UID/e-mail antes de aplicar qualquer bloqueio.
        if (!dbUser && navigator.onLine === false) {
            dbUser = readCoreOfflineProfile(user);
        }

        // LISTA VIP MASTER (Cobre as variações do seu e-mail corporativo)
        const emailsMaster = ['marcos@grupocij.com', 'marcos@grupocij.com.br', 'marcos.bazacas@grupocij.com', 'marcos.bazacas@grupocij.com.br', 'adm@grupocij.com', 'adm@grupocij.com.br'];

        // NOVA REGRA DE SEGURANÇA: Bloqueio Total (Leão de Chácara)
        if (!dbUser) {
            if (emailsMaster.includes(cleanEmail)) {
                // Salva-vidas Master
                dbUser = { 
                    email: cleanEmail, nome: 'Marcos Bazacas', perfil: 'Master', 
                    visaoGlobalPorTela: {}, modulos: globalModulesMap.map(m => m.url) 
                };
            } else {
                if (navigator.onLine === false) {
                    console.warn("[Core] Usuário autenticado, mas perfil de permissões ainda não está disponível offline.");
                    const msg=document.getElementById('login-message');
                    if(msg)msg.textContent='Sem conexão. Abra este módulo online uma vez para armazenar suas permissões neste aparelho.';
                    if(loginScreen)loginScreen.classList.remove('hidden');
                    return;
                }
                alert("⚠️ ACESSO BLOQUEADO!\nSeu e-mail (" + cleanEmail + ") não possui permissão de acesso ao Portal. Procure a administração.");
                signOut(auth);
                return;
            }
        }

        // SEGREDO DE ESTADO: Garante que o Marcos sempre será Master, mesmo que editem o banco.
        if (emailsMaster.includes(cleanEmail)) {
            dbUser.perfil = 'Master';
            dbUser.nome = 'Marcos Bazacas'; // Garante o seu nome oficial
            if (!dbUser.modulos) dbUser.modulos = globalModulesMap.map(m => m.url); // Força acesso a tudo
        }

        saveCoreOfflineProfile(user, dbUser);

        window.__assistOfflineColdSession = false;
        window.currentUser = user;
        window.nomeUsuarioLogado = dbUser.nome || cleanEmail.split('@')[0].toUpperCase();
        window.userProfile = dbUser; 
        
        const isMaster = dbUser.perfil === 'Master';
        const isAdministrativo = dbUser.perfil === 'Administrativo';
        const vg = dbUser.visaoGlobalPorTela || {};
        
        let currentPath = window.location.pathname.split('/').pop();
        if (!currentPath) currentPath = 'index.html';

        // A nova experiência do App do Técnico vive dentro de assistencia.html?modo=tecnico,
        // mas continua usando a permissão independente app_tecnico.html no Gerenciar Usuários.
        const paramsAcesso = new URLSearchParams(window.location.search);
        const modoTecnicoAssistencia = currentPath === 'assistencia.html' &&
            (paramsAcesso.get('modo') === 'tecnico' || paramsAcesso.get('app') === 'tecnico');
        const currentAccessModule = modoTecnicoAssistencia ? 'app_tecnico.html' : (moduleAccessAliases[currentPath] || currentPath);

        // VISÃO GLOBAL — Master vê tudo; demais obedecem à configuração do módulo
        window.userVisaoGlobal = userHasGlobalView(dbUser, currentAccessModule);

        // Acesso explícito por módulo para todo usuário não-Master.
        if (!isMaster && currentAccessModule !== 'index.html' && currentAccessModule !== 'home_personalizada.html') {
            if (!userHasModuleAccess(dbUser, currentAccessModule)) {
                alert("Acesso Negado: Você não tem permissão para acessar este módulo.");
                window.location.href = 'index.html';
                return;
            }
        }

        window.aplicarPermissoesDeModulos(dbUser);

        if (typeof window.iniciarRadarNotificacoes === 'function') {
            window.iniciarRadarNotificacoes(dbUser);
        }

        window.cijIniciarPush?.(user);
        const pushConfig=document.getElementById('notif-push-config');
        if(pushConfig)pushConfig.classList.toggle('hidden', !isMaster);
        if (typeof window.initModule === 'function') window.initModule(dbUser.perfil);
    } else {
        window.cijIniciarPush?.(null);
        for(const unsubscribe of window.__notifState.unsubs||[]){try{unsubscribe()}catch(_){}}
        window.__notifState.unsubs=[];window.__notifState.rows=[];window.currentUser=null;
        window.dispatchEvent(new Event('portal-session-ended'));
        if(loginScreen) loginScreen.classList.remove('hidden');
        const authForm = document.getElementById('auth-form');
        if(authForm) authForm.classList.remove('hidden');
    }
});