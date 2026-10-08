# CIJ — Quatro propostas de navegação para homologação

## O que está incluído
- `home_sugestao_1_menu_lateral.html`: menu lateral fixo.
- `home_sugestao_2_mega_menu.html`: mega menu expansível por áreas.
- `home_sugestao_4_busca_global.html`: pesquisa global de módulos autorizados com Ctrl+K.
- `home_sugestao_5_abas_trabalho.html`: abas de navegação e pré-visualização; **não** carrega módulos reais em iframes.
- `cij-navegacao-testes.js` e `cij-navegacao-testes.css`: recursos comuns.

## Instalação sem substituir a Home atual
1. Faça cópia de segurança do repositório publicado.
2. Envie os 6 arquivos acima para a **mesma pasta onde estão `index.html` e `core.js`**, no site de homologação.
3. **Não substitua `core.js`**, pois as novas páginas usam o Core já publicado para autenticação e filtragem do menu.
4. Abra as quatro URLs relativas correspondentes aos nomes dos HTMLs.
5. Teste com usuário Master e usuário comum: os módulos exibidos devem respeitar a função `portalTemAcessoModulo` exposta pelo Core.
6. Compare navegação no computador e celular. Não publique em produção sem validar os quatro cenários.

## Limitações transparentes
- São protótipos funcionais de navegação: navegam para as páginas HTML existentes, mas **não modificam** fluxos internos, formulários, módulos, Firestore, Storage ou permissões.
- A busca é de nomes de módulos, não uma busca real em clientes ou OS. Isso é deliberado para não ler dados sem configurar controles próprios.
- Abas da sugestão 5 representam **atalhos navegacionais**. Ao usar «Abrir módulo original», o navegador abre a página já existente; não é uma SPA nem conserva formulários em memória.
- Favoritos e históricos são salvos apenas no armazenamento local do navegador, separados por UID; não vão ao Firebase.
- A exibição de um módulo nesta Home não concede acesso real. Os módulos e o Firebase devem continuar validando suas próprias permissões.
- Nenhum código backend foi publicado e nenhum dado de produção foi alterado.
