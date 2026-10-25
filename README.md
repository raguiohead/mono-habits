# MONO // HABITS ⬛⬜

> Rastreador diário de hábitos estritamente monocromático, local-first, com suporte a PWA mobile, APK Android nativo, privacidade visual e sincronização em tempo real com Google Firebase.

[![Vite](https://img.shields.io/badge/Vite-6.x-zinc?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-zinc?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-zinc?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11.x-zinc?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.x-zinc?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-zinc?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Firebase Hosting](https://img.shields.io/badge/Firebase_Hosting-Live-black?style=flat-square&logo=firebase)](https://mono-habits.web.app)
[![Android APK](https://img.shields.io/badge/Android_APK-Latest_Release-zinc?style=flat-square&logo=android)](https://github.com/raguiohead/mono-habits/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-zinc?style=flat-square)](LICENSE)

**Aplicação Web:** [https://mono-habits.web.app](https://mono-habits.web.app)  
**Download do APK Android:** [GitHub Releases (Latest)](https://github.com/raguiohead/mono-habits/releases/latest)

---

## ⚡ Visão Geral

O **MONO // HABITS** foi desenhado com um princípio radical: **eliminar o ruído visual e as distrações dopaminérgicas** comuns em aplicativos de produtividade. Usando exclusivamente uma escala de cinzas rigorosa (`Zinc`), tipografia precisa e ergonomia orientada ao polegar (*Thumb Zone*), o app transforma a disciplina diária em um ritual limpo, silencioso e satisfatório.

---

## ✨ Funcionalidades Principais

1. **Foco Diário (Daily Focus) & Hábitos:**
   - Fita semanal interativa com suporte a gestos de *swipe* horizontal para alternar semanas e resumo do período.
   - Barra de progresso diária calculada em tempo real com contagem precisa e percentual.
   - Check-in ergonômico com alvos mínimos de toque (44px) e animações ágeis sem Cumulative Layout Shift (CLS).
   - Efeito visual de dia completo (*Day Complete*): inversão monocromática suave ao concluir todos os hábitos do dia.
   - Cálculo automático de sequências (*streaks*) consecutivas, melhores marcas e dias de tolerância (*graces*).
   - Suporte a hábitos de ação (positivos) e hábitos de evitação (*avoidance*).
   - Capas personalizadas para hábitos: temas visuais monocromáticos padrão ou upload de imagem própria comprimida e enquadrada no cliente (sem necessidade de armazenamento na nuvem).
2. **Modo Discreto (Privacidade Visual):**
   - Oculte nomes e notas de hábitos sensíveis com um toque no botão de olho (`Eye`/`EyeOff`), exibindo apenas ícones neutros e marcadores.
3. **Temporizador Pomodoro Integrado (Pomo Focus):**
   - Timer Pomodoro integrado com contagem regressiva, ciclos de foco e pausas configuráveis.
   - Associação de metas diárias de pomodoros a hábitos específicos ou ao foco geral.
   - Avisos sonoros/táteis e notificações de conclusão de ciclo.
4. **Lembretes Locais & Notificações:**
   - Lembretes programados executados diretamente no dispositivo (`@capacitor/local-notifications` no Android ou Notification API no navegador/PWA).
   - Notificações discretas: alertam apenas sobre a contagem de hábitos pendentes sem expor nomes sensíveis na tela de bloqueio.
   - Ação "Marcar como feito" diretamente na notificação via Service Worker com fila offline (IndexedDB).
   - Push Notifications opcionais via Firebase Cloud Messaging (FCM) para avisos do app.
5. **Compartilhamento em Imagem (Share Card):**
   - Geração de cartão visual de consistência e progresso diretamente via Canvas no cliente.
   - Permite salvar imagem em PNG ou compartilhar via Web Share API sem expor dados confidenciais ou sensíveis.
6. **Consistência em 90 Dias & Marcos (Analytics):**
   - Grade de consistência estilo GitHub cobrindo 13 semanas (91 dias).
   - Intensidade tonal monocromática calibrada conforme a taxa de conclusão de cada dia.
   - Métricas de retenção para janelas de 14 e 30 dias e comemoração de marcos (*milestones*) de disciplina.
7. **Segurança & Bloqueio de Acesso:**
   - Bloqueio por PIN/senha ou autenticação biométrica via WebAuthn, garantindo privacidade com o aparelho desbloqueado.
8. **Arquitetura Híbrida Local-First + Google Cloud:**
   - **Offline Imediato:** Funciona 100% no `localStorage` sem exigir login prévio.
   - **Google Cloud Firestore:** Ao conectar com sua Conta Google, os hábitos locais são migrados e sincronizados automaticamente em tempo real entre todos os seus dispositivos.
   - Fila de sincronização offline resiliente (IndexedDB) para garantir que ações efetuadas sem internet sejam enviadas assim que a rede retornar.
9. **Atualização In-App no Android:**
   - Verificador nativo no app Android que consulta a API de releases estáveis do GitHub (`api.github.com/repos/raguiohead/mono-habits/releases/latest`), notificando novas versões e permitindo download direto do APK.
10. **Fontes Locais & Modo 100% Offline:**
    - Tipografia com fontes empacotadas localmente via `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono`, sem dependência de conexões com CDNs externas (Google Fonts) e compatível com Content Security Policy restritivo (`font-src 'self'`).
11. **Acessibilidade Completa (A11y):**
    - Modais acessíveis via `ModalShell` com role `dialog`, controle por tecla `Esc` e retenção de foco (*focus trap*).
    - Foco visível (`:focus-visible`) para navegação por teclado.
    - Suporte nativo e manual a redução de movimento (`prefers-reduced-motion` e toggle nas configurações).
    - Modo de alto contraste monocromático (`high-contrast`) calibrado.
    - Ajuste de tamanho de texto e alvos de toque mobile confortáveis (mínimo 44x44px).
12. **Privacidade e Estatísticas de Uso Opcionais:**
    - Firebase Analytics opcional e desativado por padrão, ativado exclusivamente sob consentimento e respeitando o cabeçalho "Do Not Track" (DNT).
    - Lista restrita de eventos técnicos, sem nomes de hábitos, notas ou dados de conta.
    - Exportação completa em JSON dos dados locais e opção de exclusão definitiva da conta e dados da nuvem.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18.3, TypeScript 5.7, Vite 6.1
- **Mobile (Android):** Capacitor 8.5 (`@capacitor/android`, `@capacitor/core`, `@capacitor/local-notifications`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor-firebase/authentication`)
- **Estilização:** Tailwind CSS 3.4 (paleta estritamente monocromática `zinc`, `black`, `white`)
- **Fontes:** Fontsource Variable Fonts (`Inter`, `JetBrains Mono`) empacotadas localmente
- **Ícones:** Lucide React
- **Persistência:** LocalStorage + Google Firebase 11.4 (Firebase Auth + Cloud Firestore + Firebase Cloud Messaging + Firebase Analytics opcionais)
- **PWA:** `vite-plugin-pwa` com Service Worker customizado (`injectManifest`, Workbox 7.4) e precache offline
- **Testes:** Vitest 4.1 (testes unitários) + `@firebase/rules-unit-testing` (testes de regras de segurança do Firestore)

---

## 📁 Estrutura do Projeto

```
mono-habits/
├── .github/
│   └── workflows/
│       ├── build-android-apk.yml     # CI de testes, APKs debug/dev e release oficial
│       ├── firebase-hosting.yml      # CD automático para Firebase Hosting (branch main)
│       └── firestore-rules.yml       # Validação das regras de segurança do Firestore
├── android/                          # Projeto nativo Android (Capacitor)
├── public/                           # Assets estáticos, ícones PWA e splash
├── src/
│   ├── components/                   # Componentes de interface modulares
│   ├── context/                      # Contextos React (Habits, Settings, Pomo, Lock)
│   ├── lib/                          # Lógica de domínio, storage, regras, crypto e Firebase
│   ├── types/                        # Definições de tipagem TypeScript
│   ├── App.tsx                       # Componente raiz da aplicação
│   ├── index.css                     # Tailwind, variáveis de alto contraste e acessibilidade
│   ├── main.tsx                      # Ponto de entrada React e registro PWA
│   └── sw.ts                         # Service Worker Workbox + FCM + fila offline
├── tests/                            # Testes unitários (Vitest) e de regras (Firestore)
├── capacitor.config.ts               # Configuração do Capacitor Android
├── firebase.json                     # Regras do Firestore, emuladores e Firebase Hosting
├── firestore.rules                   # Regras de segurança de acesso por usuário
├── index.html                        # HTML base com meta tags PWA e mobile
├── package.json                      # Dependências, scripts e metadados
└── vite.config.ts                    # Configurações do Vite, PWA e rollup chunks
```

---

## 📜 Scripts npm

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento Vite (`--host 0.0.0.0 --port 3000`) |
| `npm run build` | Checagem estática de tipos (app e Service Worker) e compilação de produção com Vite |
| `npm run lint` | Validação de tipos com TypeScript (`tsc --noEmit`) |
| `npm run preview` | Pré-visualização local do build de produção (`dist/`) |
| `npm test` | Executa a suíte de testes unitários com Vitest |
| `npm run test:watch` | Executa os testes unitários em modo observação contínua |
| `npm run test:rules` | Executa os testes das regras do Firestore no emulador local |
| `npm run cap:sync` | Compila o build web e sincroniza os assets com o projeto Android (`android/`) |
| `npm run cap:open` | Abre o projeto Android no Android Studio |
| `npm run apk:debug` | Sincroniza e compila o APK Android Debug via Gradle |
| `npm run apk:release` | Sincroniza e compila o APK Android Release via Gradle |

---

## 🚀 Começando Rápido

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/raguiohead/mono-habits.git
cd mono-habits
npm install
```

### 2. Configurar Variáveis de Ambiente (Opcional para Nuvem)
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```
Preencha suas chaves do Firebase se desejar ativar a sincronização em nuvem:
```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
VITE_APP_ID=mono-habit-tracker
```
> **Nota:** Se as variáveis do Firebase não forem preenchidas, o aplicativo entrará em **Modo Local Offline** automático, persistindo perfeitamente no `localStorage`.

### 3. Executar em Desenvolvimento
```bash
npm run dev
```

### 4. Rodar Testes Unitários
```bash
npm test
```

### 5. Build de Produção
```bash
npm run build
```

---

## 🔒 Segurança do Firebase Firestore

O projeto inclui um arquivo `firestore.rules` pronto para produção. Cada usuário autenticado tem acesso estritamente restrito aos seus próprios documentos:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Configuração da Conta Google no Firebase Console:
1. No [Firebase Console](https://console.firebase.google.com/), acesse **Authentication** > **Sign-in method** e habilite o provedor **Google**.
2. Na aba **Configurações** de autenticação, em **Domínios autorizados**, certifique-se de que os domínios do Firebase Hosting (`mono-habits.web.app`, `mono-habits.firebaseapp.com` e `localhost` para testes locais) estejam listados.

---

## 🔥 Deploy no Firebase Hosting

O `firebase.json` inclui a seção `hosting` configurada para SPA, com reescrita para `index.html`, cabeçalhos de segurança (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) e política de cache otimizada para assets estáticos e Service Worker:

1. Instale a CLI: `npm i -g firebase-tools` e faça login com `firebase login`.
2. Gere o build com as variáveis `VITE_FIREBASE_*` definidas: `npm run build`.
3. Publique: `firebase deploy --only hosting` (o projeto padrão está configurado em `.firebaserc`).
4. Os domínios `mono-habits.web.app` e `mono-habits.firebaseapp.com` já vêm autorizados para login Google; para domínios próprios, cadastre-os em **Authentication > Settings > Authorized domains**.

### Deploy Automático (GitHub Actions)

O workflow `.github/workflows/firebase-hosting.yml` roda os testes, gera o build e publica no Firebase Hosting a cada push na `main` (ou manualmente em **Actions > Deploy no Firebase Hosting > Run workflow**):

1. Na máquina com Firebase CLI conectada, rode `firebase init hosting:github` (selecione `raguiohead/mono-habits`; recuse a criação de workflows duplicados de PR e merge, pois o repositório já conta com o workflow oficial configurado). A CLI gera a conta de serviço e grava o segredo `FIREBASE_SERVICE_ACCOUNT_MONO_HABITS` no GitHub.
2. Alternativa manual: no Google Cloud Console > IAM > Contas de serviço, crie uma conta com papéis **Firebase Hosting Admin** e **Service Account User**, gere a chave JSON e adicione em GitHub > Settings > Secrets and variables > Actions sob o nome `FIREBASE_SERVICE_ACCOUNT_MONO_HABITS`.
3. Opcional: cadastre os segredos `VITE_FIREBASE_*` no repositório do GitHub. Caso não sejam preenchidos, são adotados os padrões definidos em `src/lib/firebase.ts`.

> Nunca realize o commit da chave JSON da conta de serviço. Caso ela seja exposta acidentalmente, revogue-a imediatamente no console do Google Cloud e emita uma nova.

---

## 🌿 Fluxo de Branches e Releases

O desenvolvimento do **MONO // HABITS** é estruturado em torno de duas branches principais para garantir estabilidade contínua em produção e validação ágil de novas funcionalidades:

- **`development`**: Branch de integração, testes contínuos e distribuição de APKs de teste/debug.
- **`main`**: Branch estável de produção. Recebe apenas merges aprovados e testados vindos da `development`.

```
[feature/fix branch]
        │
        ▼ (Pull Request)
  [development] ──► CI: Testes + Regras + Pre-release (APKs dev e debug)
        │           ▲
        │           │ (Validação e testes manuais com mono-habits-dev.apk)
        ▼ (Pull Request com bump de versão)
     [main]     ──► CI: Release oficial v<versão> (mono-habits.apk) + Deploy Firebase Hosting
```

### Ciclo de Desenvolvimento

1. **Features e Correções:** Crie uma branch a partir de `development` (ex.: `feat/nova-tela` ou `fix/ajuste-streak`).
2. **PR para `development`:** Abra um Pull Request apontando para `development`. O CI executa a checagem de tipos, testes unitários, testes de regras do Firestore e compila o APK Debug como artefato.
3. **Integração na `development`:** Ao realizar o merge na `development`:
   - O CI compila o **APK Release ASSINADO** (com a keystore oficial do projeto) e o **APK Debug**.
   - Publica automaticamente um **GitHub Pre-release** com tag `dev-v<versão>-<run_number>` e título `Teste v<versão> (dev #<run_number>)`, anexando `mono-habits-dev.apk` e `mono-habits-debug.apk`.
   - Limpa automaticamente pre-releases anteriores com o prefixo `dev-*`, mantendo apenas os **5 mais recentes**.
   - **Isolamento de produção:** Pre-releases são marcados com `--prerelease` (nunca latest). O verificador de atualizações in-app (`src/lib/appUpdate.ts`) ignora pre-releases e procura exclusivamente por `mono-habits.apk`. Usuários de produção nunca são notificados de builds de teste.
4. **Validação:** Instale o `mono-habits-dev.apk` no dispositivo de teste e valide as alterações.
5. **Promoção para a `main`:** Após validação completa, abra um Pull Request de `development` para `main`. O merge na `main` gera a release oficial `v<versão>` com `mono-habits.apk` e dispara o deploy de produção no Firebase Hosting.

### Como Instalar o APK de Teste

1. No repositório do GitHub, acesse a aba **Releases**.
2. Abra o pre-release mais recente (identificado pela tag `dev-v<versão>-<run_number>`).
3. Baixe o arquivo **`mono-habits-dev.apk`**.
4. **Substituição direta (sem desinstalar):** Como o `mono-habits-dev.apk` é assinado com a mesma keystore de release da produção, o Android permite instalá-lo diretamente por cima da versão já instalada no aparelho. Isso preserva todo o banco de dados local (`localStorage`), configurações e estado de login.
5. **Login Google nativo funcional:** A assinatura com a chave oficial preserva o fingerprint SHA-1 cadastrado no Firebase Console, permitindo testar o fluxo completo de autenticação Google nativa.
6. *(Opcional)* Se precisar inspecionar chamadas de rede ou logs detalhados via ADB / Chrome DevTools (`chrome://inspect`), baixe o **`mono-habits-debug.apk`** (requer desinstalação prévia caso haja versão de produção instalada, devido à diferença de keystores).

### Como Subir Versão (Version Bump)

- Durante o desenvolvimento e commits na branch `development`, **não altere** a versão no `package.json`.
- O incremento da versão semver (`package.json`) é realizado **exclusivamente no Pull Request de `development` para a `main`**.
- Antes de abrir ou finalizar o PR para `main`, atualize o campo `"version"` no `package.json` (ex: de `"1.3.0"` para `"1.4.0"`).
- Quando o PR for mergeado na `main`, o workflow de CI detecta que a tag `v<versão>` ainda não existe, cria a tag e publica a release estável oficial, liberando a atualização automática para todos os usuários do app.

---

## 📊 Estatísticas de uso e avisos por push (Firebase, gratuito)

Os dois recursos são **opcionais e começam desligados** para o usuário (Configurações > Estatísticas de uso anônimas / Novidades do app). Funcionam no navegador/PWA.

- **Analytics:** usa o `VITE_FIREBASE_MEASUREMENT_ID` (o padrão do projeto já está no código). Só com consentimento, e respeitando "Não rastrear". Eventos em lista fechada (`src/lib/usage.ts`): nunca nomes de hábitos, notas ou dados de conta. Acompanhe as métricas em Firebase Console > Analytics.
- **Push (FCM) com envio manual pelo Console:**
  1. Firebase Console > Configurações do projeto > **Cloud Messaging** > **Certificados Web Push** > gerar par de chaves e copiar a **chave pública**.
  2. Cadastre-a como `VITE_FIREBASE_VAPID_KEY` no arquivo `.env.local` e, para o deploy do Firebase Hosting, configure o segredo `VITE_FIREBASE_VAPID_KEY` no GitHub Actions. Sem essa variável, a opção de push permanece oculta.
  3. Faça um novo deploy. No app, ative **Novidades do app (push)** e permita as notificações.
  4. Teste: copie o **token** (Configurações > Notificações > "Token deste aparelho") e use em Console > Engajamento > Cloud Messaging > **Enviar mensagem de teste**. Para campanhas, use "Nova campanha" > Notificações e escolha o app web como público.
- O Content Security Policy configurado no `firebase.json` autoriza conexões para `googletagmanager.com` e `google-analytics.com` especificamente para o suporte analítico com consentimento.

---

## 📄 Licença
Distribuído sob a licença MIT.