// core.js - MOTOR CENTRAL DO PORTAL GRUPO CIJ

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, persistentLocalCache, persistentMultipleTabManager, initializeFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 1. INJETAR LAYOUT GLOBAL (CABEÇALHO, MENU, LOGIN E TOAST)
const injectLayout = () => {
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
                    <input type="email" id="auth-email" required placeholder="seu.nome@grupocij.com.br" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-600 font-medium">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Senha</label>
                    <input type="password" id="auth-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-600">
                </div>
                <button type="submit" class="w-full py-3 bg-[#002d72] hover:bg-blue-900 text-white font-extrabold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2">
                    <i class="fa-solid fa-right-to-bracket"></i> Entrar
                </button>
            </form>
        </div>
    </div>

    <!-- CABEÇALHO SUPERIOR FIXO -->
    <header class="bg-[#0f172a] text-white shadow-md border-b border-slate-800 sticky top-0 z-[9990] h-16 shrink-0 w-full no-print">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
            <div class="flex items-center justify-between h-full gap-4">
                
                <!-- LOGO E BADGE -->
                <div class="flex items-center gap-3 shrink-0">
                    <div class="p-1.5 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 hidden sm:flex">
                        <svg style="width: 28px; height: 28px; display: inline-block;" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M50 10 L85 45 L50 80 L15 45 Z" fill="#0077C8"/>
                            <path d="M50 20 L75 45 L50 70 L25 45 Z" fill="#64B5F6"/>
                        </svg>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">Portal CIJ</span>
                        <span id="user-role-badge-top" class="text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 bg-slate-800 text-slate-300 border-slate-600">Verificando...</span>
                    </div>
                </div>

                <!-- MENU DESKTOP -->
                <nav class="hidden lg:flex items-center gap-1 flex-1 justify-center h-full">
                    
                    <div id="top-nav-tecnica" class="relative group h-full flex items-center hidden">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800"><i class="fa-solid fa-wrench text-teal-400"></i> Técnica <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="bg-slate-50/80 px-4 py-2 border-b border-slate-100"><span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Módulos Operacionais</span></div>
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="solicitacoes-lista.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-list-check"></i></div><div><h4 class="text-xs font-bold text-slate-900">Lista Solicitações</h4></div></a>
                                <a href="despesas.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-receipt"></i></div><div><h4 class="text-xs font-bold text-slate-900">Controle Despesas</h4></div></a>
                                <a href="veiculos_mobile.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-car"></i></div><div><h4 class="text-xs font-bold text-slate-900">Veículos Mobile</h4></div></a>
                            </div>
                        </div>
                    </div>

                    <div id="top-nav-vendas" class="relative group h-full flex items-center hidden">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800"><i class="fa-solid fa-handshake text-blue-400"></i> Comercial <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[38rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="bg-slate-50/80 px-4 py-2 border-b border-slate-100"><span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Área de Vendas & Comercial</span></div>
                            <div class="p-2 grid grid-cols-3 gap-1 text-slate-800">
                                <a href="comissoes-azul.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-chart-line"></i></div><div><h4 class="text-xs font-bold text-slate-900">Comissões Azul</h4></div></a>
                                <a href="ranking.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-trophy"></i></div><div><h4 class="text-xs font-bold text-slate-900">Ranking Vendas</h4></div></a>
                                <a href="estoque-novos.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-boxes-stacked"></i></div><div><h4 class="text-xs font-bold text-slate-900">Estoque Novos</h4></div></a>
                                <a href="solicitacao.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-signature"></i></div><div><h4 class="text-xs font-bold text-slate-900">Solicitação CIJ</h4></div></a>
                                <a href="simulador.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-calculator"></i></div><div><h4 class="text-xs font-bold text-slate-900">Simulador Financeiro</h4></div></a>
                            </div>
                        </div>
                    </div>

                    <div id="top-nav-admin" class="relative group h-full flex items-center hidden">
                        <button class="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1.5 rounded-lg hover:bg-slate-800"><i class="fa-solid fa-shield-halved text-purple-400"></i> Admin <i class="fa-solid fa-chevron-down text-[9px] opacity-60 transition-transform group-hover:rotate-180"></i></button>
                        <div class="absolute top-14 left-1/2 -translate-x-1/2 mt-1 w-[32rem] bg-white rounded-2xl shadow-2xl border border-slate-200 opacity-0 invisible scale-95 z-[9999] transition-all transform origin-top group-hover:opacity-100 group-hover:visible group-hover:scale-100 overflow-hidden">
                            <div class="bg-slate-50/80 px-4 py-2 border-b border-slate-100"><span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Administrativo & Operações</span></div>
                            <div class="p-2 grid grid-cols-2 gap-1 text-slate-800">
                                <a href="estoque-novos.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-boxes-stacked"></i></div><div><h4 class="text-xs font-bold text-slate-900">Estoque Novos</h4></div></a>
                                <a href="estoque.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-box-open"></i></div><div><h4 class="text-xs font-bold text-slate-900">Estoque Usados</h4></div></a>
                                <a href="veiculos.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0"><i class="fa-solid fa-car-tunnel"></i></div><div><h4 class="text-xs font-bold text-slate-900">Veículos Gerencial</h4></div></a>
                                <a href="vendas.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-cart-shopping"></i></div><div><h4 class="text-xs font-bold text-slate-900">Vendas (Saídas)</h4></div></a>
                                <a href="painel_administrativo.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-shield-halved"></i></div><div><h4 class="text-xs font-bold text-slate-900">Painel Diretoria</h4></div></a>
                                <a href="usuarios.html" class="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200"><div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-100 flex items-center justify-center shrink-0"><i class="fa-solid fa-users-gear"></i></div><div><h4 class="text-xs font-bold text-slate-900">Gerenciar Usuários</h4></div></a>
                            </div>
                        </div>
                    </div>

                </nav>

                <!-- BOTOES DA DIREITA -->
                <div class="flex items-center gap-2 shrink-0">
                    <a href="index.html" class="hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition items-center gap-1.5"><i class="fa-solid fa-house"></i> Home</a>
                    <button onclick="window.fazerLogout()" class="hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-bold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 transition items-center gap-1.5"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
                    <!-- MENU HAMBURGUER (MOBILE) -->
                    <button onclick="window.toggleMobileMenu()" class="lg:hidden text-slate-300 hover:text-white text-xl p-1 px-2 border border-slate-700 rounded-lg bg-slate-800">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                </div>

            </div>
        </div>
    </header>

    <!-- MENU SIDEBAR MOBILE (OCULTO POR PADRÃO) -->
    <div id="mobile-overlay" onclick="window.toggleMobileMenu()" class="fixed inset-0 bg-black/60 z-[105] hidden opacity-0 transition-opacity duration-300 backdrop-blur-sm lg:hidden"></div>
    <div id="mobile-sidebar" class="fixed inset-y-0 right-0 w-[280px] bg-[#0f172a] shadow-2xl z-[110] transform translate-x-full transition-transform duration-300 border-l border-slate-700 flex flex-col lg:hidden">
        <div class="p-5 flex justify-between items-center border-b border-slate-800 bg-[#0b1120]">
            <span class="font-bold text-white text-sm uppercase tracking-wider">Módulos</span>
            <button onclick="window.toggleMobileMenu()" class="text-slate-400 hover:text-white text-2xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <a href="index.html" class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700"><i class="fa-solid fa-house text-blue-400"></i> Página Inicial</a>
            <a href="estoque-novos.html" class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700"><i class="fa-solid fa-boxes-stacked text-cyan-400"></i> Estoque Novos</a>
            <a href="comissoes-azul.html" class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700"><i class="fa-solid fa-chart-line text-indigo-400"></i> Comissões Azul</a>
            <a href="ranking.html" class="flex items-center gap-3 p-3 bg-slate-800 rounded-xl text-slate-200 text-sm font-bold border border-slate-700"><i class="fa-solid fa-trophy text-amber-400"></i> Ranking Vendas</a>
        </div>
        <div class="p-4 border-t border-slate-800 bg-[#0b1120]">
            <button onclick="window.fazerLogout()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 transition flex items-center justify-center gap-2"><i class="fa-solid fa-right-from-bracket"></i> Sair da Conta</button>
        </div>
    </div>

    <!-- TOAST DE NOTIFICAÇÃO -->
    <div id="toast" class="fixed bottom-5 right-5 hidden z-[9999] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
        <i id="toast-icon" class="fa-solid fa-circle-check text-emerald-400"></i>
        <span id="toast-message" class="text-xs font-semibold">Sucesso!</span>
    </div>
    `;

    document.body.insertAdjacentHTML('afterbegin', layoutHTML);
};

// Dispara a injeção do HTML imediatamente
injectLayout();

// 2. CONFIGURAÇÃO DO FIREBASE
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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// EXPOR O FIREBASE PARA OS SEUS MÓDULOS HTML USAREM
window.AppAuth = auth;
window.AppDB = db;
window.fsCollection = collection;
window.fsDoc = doc;
window.fsSetDoc = setDoc;
window.fsDeleteDoc = deleteDoc;
window.fsOnSnapshot = onSnapshot;

// 3. FUNÇÕES GLOBAIS DE INTERFACE
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

window.mostrarNotificacao = function(msg, isError = false) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = msg;
    document.getElementById('toast-icon').className = isError ? 'fa-solid fa-circle-xmark text-red-400' : 'fa-solid fa-circle-check text-emerald-400';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
};

window.fazerLogout = () => signOut(auth);

window.handleLogin = async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
    } catch (err) {
        alert("Erro no login: Usuário ou senha incorretos.");
    }
};

window.verificarPermissoesGlobais = function(perfil, nome) {
    const badgeTop = document.getElementById('user-role-badge-top');
    if(badgeTop) badgeTop.innerText = perfil + ' • ' + nome;

    const isAdmin = perfil === 'Admin';
    const isTecnico = perfil === 'Técnico';
    const isVendedor = perfil === 'Vendedor';
    const isFinanceiro = perfil === 'Financeiro';

    const showTecnica = isAdmin || isTecnico;
    const showVendas = isAdmin || isVendedor;
    const showAdmin = isAdmin;
    const showFin = isAdmin || isFinanceiro;

    document.getElementById('top-nav-tecnica')?.classList.toggle('hidden', !showTecnica);
    document.getElementById('top-nav-vendas')?.classList.toggle('hidden', !showVendas);
    document.getElementById('top-nav-admin')?.classList.toggle('hidden', !showAdmin);
    document.getElementById('top-nav-financeiro')?.classList.toggle('hidden', !showFin);
};

// 4. OBSERVADOR DE LOGIN GERAL
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    if (user) {
        const cleanEmail = (user.email || '').toLowerCase().trim();
        let perfilEncontrado = 'Admin'; 
        let nomeEncontrado = cleanEmail.split('@')[0].toUpperCase();

        try {
            const snap = await getDocs(collection(db, 'artifacts', 'plataforma-cij', 'public', 'data', 'usuarios_permissoes'));
            const usuarios = [];
            snap.forEach(d => usuarios.push(d.data()));
            const dbUser = usuarios.find(u => u.email.toLowerCase() === cleanEmail);
            if (dbUser) {
                nomeEncontrado = dbUser.nome || nomeEncontrado;
                perfilEncontrado = dbUser.perfil || 'Admin';
            }
        } catch (e) { console.warn("Aviso Permissões:", e); }

        window.currentUser = user;
        window.nomeUsuarioLogado = nomeEncontrado;
        window.isUserAdminOrFinance = (perfilEncontrado === 'Admin' || perfilEncontrado === 'Financeiro');
        
        window.verificarPermissoesGlobais(perfilEncontrado, nomeEncontrado);

        // Dispara a função do módulo específico, se existir na página HTML
        if (typeof window.initModule === 'function') {
            window.initModule(perfilEncontrado);
        } else {
            loginScreen.classList.add('hidden'); // Libera tela se módulo não tiver bloqueios
        }
    } else {
        loginScreen.classList.remove('hidden');
        document.getElementById('auth-form').classList.remove('hidden');
    }
});
