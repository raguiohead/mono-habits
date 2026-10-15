# MONO // HABITS ⬛⬜

> Rastreador diário de hábitos estritamente monocromático, local-first, com suporte a PWA mobile, privacidade visual e sincronização em tempo real com Google Firebase.

[![Vite](https://img.shields.io/badge/Vite-6.x-zinc?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.x-zinc?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-zinc?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-11.x-zinc?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-zinc?style=flat-square)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-zinc?style=flat-square)](LICENSE)

---

## ⚡ Visão Geral

O **MONO // HABITS** foi desenhado com um princípio radical: **eliminar o ruído visual e as distrações dopaminérgicas** comuns em aplicativos de produtividade. Usando exclusivamente uma escala de cinzas rigorosa (`Zinc`), tipografia precisa e ergonomia orientada ao polegar (*Thumb Zone*), o app transforma a disciplina diária em um ritual limpo e satisfatório.

---

## ✨ Funcionalidades Principais

1. **Foco Diário (Daily Focus):**
   - Fita semanal interativa com suporte a gestos de *swipe* horizontal para alternar semanas.
   - Barra de progresso diária calculada em tempo real com contagem precisa.
   - Check-in tátil com alvos mínimos de toque (44px) e animações responsivas sem layout shift.
   - Cálculo automático de ofensivas (*streaks*) consecutivas.
2. **Modo Discreto (Privacidade Visual):**
   - Oculte nomes de hábitos sensíveis com um toque no botão de olho (`Eye`/`EyeOff`), exibindo apenas o ícone minimalista e marcadores.
3. **Consistência em 90 Dias (Analytics):**
   - Grade de consistência estilo GitHub cobrindo 13 semanas (91 dias).
   - Intensidade tonal monocromática calibrada conforme a taxa de conclusão do dia.
   - Métricas de retenção para janelas de 14 e 30 dias.
4. **Arquitetura Híbrida Local-First + Google Cloud:**
   - **Offline Imediato:** Funciona 100% no `localStorage` sem exigir login prévio.
   - **Google Cloud Firestore:** Ao conectar com sua Conta Google, os hábitos locais são migrados e sincronizados automaticamente em tempo real entre todos os seus dispositivos.
5. **PWA Mobile Instalável:**
   - Ícone monocromático vetorial e meta tags para execução em tela cheia (*standalone*) no iOS e Android.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18, TypeScript, Vite
- **Estilização:** Tailwind CSS (paleta estritamente monocromática `zinc`, `black`, `white`)
- **Ícones:** Lucide React (16 ícones minimalistas de categorias)
- **Persistência:** LocalStorage + Google Firebase (Firebase Auth + Cloud Firestore)
- **PWA:** `vite-plugin-pwa` com Service Worker e precache offline
- **Testes:** Vitest (100% de cobertura nos cálculos de streaks, datas e estatísticas)

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
2. Na aba **Configurações** de autenticação, em **Domínios autorizados**, adicione o domínio do seu deploy na Vercel (ex: `mono-habits.vercel.app` ou `localhost`).

---

## 🌐 Deploy na Vercel

O projeto possui `vercel.json` configurado com cabeçalhos de segurança (CSP, HSTS, X-Content-Type-Options) e reescrita SPA:

1. Importe o repositório na [Vercel](https://vercel.com/new).
2. Configure as variáveis de ambiente (`VITE_FIREBASE_*`) nas configurações do projeto na Vercel.
3. O build e deploy serão realizados automaticamente a cada push na branch `main`.

---

## 📄 Licença
Distribuído sob a licença MIT.
