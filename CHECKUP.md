# 🛡️ CHECKUP COMPLETO DO PROJETO — MONO // HABITS

**Versão da Aplicação:** 1.2.0  
**Data da Auditoria:** 24 de Outubro de 2026  
**Ambiente de Análise:** Branch de inspeção `raguiohead/checkup-seguranca-ux`  
**Escopo:** Análise estática, arquitetural e comportamental de Segurança, Regras do Firestore, Acessibilidade (WCAG 2.2), Usabilidade/UX, Performance, PWA e Qualidade de Código.

---

## 1. Resumo Executivo

### 1.1 Nota Geral de Saúde do Projeto: **8.3 / 10 (Grau B+)**

O **MONO // HABITS** é uma aplicação PWA e híbrida Android (via Capacitor) notavelmente bem estruturada, orientada à filosofia local-first, com design monocromático intencional e forte rigor criptográfico na trava local por PIN (PBKDF2 com 210.000 iterações, sal aleatório e WebAuthn). A suíte de testes unitários automatizados é exemplar: **306 testes passam com 100% de sucesso**, e os testes de regras com emulador local do Firestore (**8 testes de segurança**) cobrem os caminhos felizes e restrições estruturais.

Entretanto, foram identificados pontos cegos críticos e de alta severidade relacionados ao ciclo de vida de **sincronização offline-online** (risco de sobrescrita e perda de dados), **duplo registro do Service Worker** na WebView nativa do Android (bypassing da guarda programática do Capacitor), **bloqueio de CSP** na consulta de novas versões via GitHub Releases, e **barreiras de acessibilidade (WCAG 2.2)** em formulários e contrastes de cor monocromáticos.

---

### 1.2 Top 5 Riscos Identificados

| # | Risco | Severidade | Categoria | Impacto Principal |
|---|---|:---:|---|---|
| **1** | **Sobrescrita e Perda de Dados em Modo Offline-Online** | **Crítica** | Usabilidade / Sync | Check-ins e hábitos criados/editados enquanto o usuário está offline com conta conectada são descartados incondicionalmente pelo snapshot remoto ao reconectar à internet. |
| **2** | **Duplo Registro de Service Worker no Android Nativo (Capacitor)** | **Alta** | PWA / Mobile | O plugin `vite-plugin-pwa` injeta `registerSW.js` sem a guarda `!Capacitor.isNativePlatform()`, ativando o SW no esquema `https://localhost` do Android e arriscando conflitos de cache no WebView. |
| **3** | **Bloqueio de Checagem de Atualizações por CSP Restritivo** | **Alta** | Segurança / Conectividade | A consulta à API do GitHub (`api.github.com`) para checar novas releases do APK é bloqueada silenciosamente pelo CSP em navegadores modernos por ausência em `connect-src`. |
| **4** | **Vulnerabilidades Críticas e Altas na Cadeia de Suprimentos (Build/Test)** | **Alta** | Segurança / Supply Chain | O `npm audit` acusa 20 vulnerabilidades (3 críticas, 4 altas), incluindo Path Traversal no `tar` via `@capacitor/assets` e Prototype Pollution para RCE no `tinypool` via `vitest`. |
| **5** | **Campos de Formulário sem Associação com `<label>` (WCAG 3.3.2)** | **Alta** | Acessibilidade | Os campos principais ("Nome do Hábito" e "Categoria") no modal de criação possuem `<label>` sem atributo `htmlFor` e `<input>` sem `id`, deixando tecnologias assistivas sem identificação do campo. |

---

## 2. Achados por Categoria

---

### 2.1 Segurança (Security & Hardening)

#### [SEC-01] Bloqueio do endpoint de verificação de atualizações por Content Security Policy (CSP)
* **Severidade:** **Alta**
* **Arquivo:** [`vercel.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vercel.json#L40-L42) e [`firebase.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firebase.json#L32-L35)
* **Evidência:**
  ```json
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' https://apis.google.com; ... connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com; ..."
  ```
  O arquivo [`src/lib/appUpdate.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/lib/appUpdate.ts#L7-L8) declara:
  ```ts
  const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/raguiohead/mono-habits/releases/latest';
  ```
* **Impacto:** O navegador bloqueia a chamada fetch com erro de violação de política (`Refused to connect to 'https://api.github.com/...' because it violates CSP connect-src`). Toda verificação web/PWA falha silenciosamente.
* **Recomendação de Correção:**
  Adicionar `https://api.github.com` à diretiva `connect-src` em ambos [`vercel.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vercel.json#L41) e [`firebase.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firebase.json#L34):
  ```diff
  - connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com;
  + connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://api.github.com;
  ```

---

#### [SEC-02] Dependências com vulnerabilidades críticas e altas no ecossistema de desenvolvimento
* **Severidade:** **Alta**
* **Arquivo:** [`package.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/package.json#L35-L55) e `package-lock.json`
* **Evidência:** O relatório do `npm audit` detectou **20 vulnerabilidades** (3 críticas, 4 altas, 12 moderadas, 1 baixa):
  1. `tar <=7.5.20` (**Crítica**): Path traversal e sobrescrita arbitrária de arquivos via `@capacitor/assets`.
  2. `tinypool <=2.1.1` (**Crítica**): Gadget de prototype pollution levando a RCE via `vitest`.
  3. `body-parser` (**Alta**): Negação de serviço (DoS) via trailing bytes após requisições compactadas.
  4. `sharp <=0.35.5-rc.1` (**Alta**): Vulnerabilidades herdadas em `libvips` e `libheif` via `@capacitor/assets`.
* **Impacto:** Embora restritas às dependências de build e teste (não inclusas no bundle de produção do cliente), há risco de exploração em pipelines de CI/CD (GitHub Actions) e estações de desenvolvedores.
* **Recomendação de Correção:**
  - Atualizar `vitest` para versão `>=4.1.11` ou `v5.x` assim que viável.
  - Atualizar ou substituir `@capacitor/assets` e forçar resolução do `tar` via campo `overrides` no `package.json`:
    ```json
    "overrides": {
      "@grpc/grpc-js": "^1.14.0",
      "tar": "^7.5.21"
    }
    ```

---

#### [SEC-03] Identificadores do projeto de produção do Firebase hardcoded como fallback
* **Severidade:** **Média**
* **Arquivo:** [`src/lib/firebase.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/lib/firebase.ts#L49-L56)
* **Evidência:**
  ```ts
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBOi3SkoF6Et81bLEzttdwdZXXP8AlPL-E',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mono-habits.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'mono-habits',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mono-habits.firebasestorage.app',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '423856759350',
    appId: env.VITE_FIREBASE_APP_ID || '1:423856759350:web:476fde2f03cfbbcb906e97'
  };
  ```
* **Impacto:** Conforme especificado na [`SECURITY.md`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/SECURITY.md#L47), chaves de cliente do Firebase não são segredos estritos de backend. Contudo, em código versionado publicamente, qualquer clone ou fork sem `.env` conecta-se silenciosamente ao banco de dados do projeto de produção `mono-habits`.
* **Recomendação de Correção:**
  Eliminar os fallbacks em código; se as variáveis `VITE_FIREBASE_*` não estiverem definidas, manter `isFirebaseConfigured = false` para operar em modo 100% local-offline sem tentar conectar ao projeto de produção.

---

#### [SEC-04] Ausência do cabeçalho Cross-Origin-Opener-Policy (COOP)
* **Severidade:** **Baixa**
* **Arquivo:** [`vercel.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vercel.json#L13-L44) e [`firebase.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firebase.json#L24-L37)
* **Evidência:** Os cabeçalhos de segurança implementam `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS` e `Permissions-Policy`, mas não especificam `Cross-Origin-Opener-Policy`.
* **Impacto:** Janelas abertas por popups externos (como o fluxo de autenticação do Google) podem manter referências bidirecionais (`window.opener`), expondo a página a técnicas de cross-origin tracking.
* **Recomendação de Correção:**
  Incluir nos blocos de cabeçalhos:
  ```json
  { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" }
  ```

---

### 2.2 Regras do Firebase (Firestore Rules & firebase.json)

#### [FSR-01] Validação superficial de elementos em listas (`frequency`, `weeklyTargets`, `completedHabitIds`, `habitIds`)
* **Severidade:** **Média**
* **Arquivo:** [`firestore.rules`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L136-L137), [`L150`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L150), [`L159-L160`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L159-L160), [`L170-L171`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L170-L171)
* **Evidência:**
  ```rules
  data.frequency is list && data.frequency.size() <= 7
  (!('weeklyTargets' in data) || (data.weeklyTargets is list && data.weeklyTargets.size() <= 20))
  data.completedHabitIds is list && data.completedHabitIds.size() <= 200
  ```
  O Firestore verifica se o campo é uma lista e seu tamanho, mas não valida os tipos internos. Em `frequency`, um cliente malicioso pode enviar `["invalido", -999, {}]`; em `weeklyTargets`, elementos arbitrários podem ser injetados.
* **Impacto:** Corrupção de dados da própria conta do usuário autenticado (auto-DoS no parser do cliente ao carregar a coleção).
* **Recomendação de Correção:**
  Limitar o payload permitindo listas estruturadas ou sanitizar estritamente no recebimento com funções auxiliares de esquema.

---

#### [FSR-02] Permissão de modificação de `createdAt` em operações de `update`
* **Severidade:** **Baixa**
* **Arquivo:** [`firestore.rules`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L138-L139) e [`L220`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L220)
* **Evidência:**
  ```rules
  match /habits/{habitId} {
    allow read, delete: if isOwner(userId);
    allow create, update: if isOwner(userId) && isValidHabit(habitId, request.resource.data);
  }
  ```
  Na função `isValidHabit`, exige-se apenas `data.createdAt is number && data.createdAt >= 0`. Não há verificação de que `request.resource.data.createdAt == resource.data.createdAt`.
* **Impacto:** Um usuário pode alterar a data original de criação de hábitos antigos, distorcendo métricas de ofensiva histórica.
* **Recomendação de Correção:**
  Separar a autorização de escrita:
  ```rules
  allow create: if isOwner(userId) && isValidHabit(habitId, request.resource.data);
  allow update: if isOwner(userId) && isValidHabit(habitId, request.resource.data) &&
                request.resource.data.createdAt == resource.data.createdAt;
  ```

---

#### [FSR-03] Execução de regex complexo sobre string de até 130.000 caracteres no Firestore
* **Severidade:** **Baixa**
* **Arquivo:** [`firestore.rules`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firestore.rules#L83-L84)
* **Evidência:**
  ```rules
  cover.dataUrl.size() <= 130000 &&
  cover.dataUrl.matches('^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$')
  ```
* **Impacto:** Executar `matches()` com regex linear em strings base64 de até 130 kB consome quota excessiva de computação de regras do Firestore e pode causar latência em operações de escrita de capas.
* **Recomendação de Correção:**
  Validar a extensão/cabeçalho nos primeiros 40 caracteres (`cover.dataUrl[0:40].matches('^data:image/(jpeg|webp|png);base64,')`), confiando o restante à validação estrita já executada pelo cliente em [`src/lib/imageResize.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/lib/imageResize.ts#L66-L100).

---

### 2.3 Acessibilidade (WCAG 2.2 AA)

#### [A11Y-01] Campos de entrada do modal de hábito desprovidos de associação com `<label>` (WCAG 3.3.2)
* **Severidade:** **Alta**
* **Arquivo:** [`src/components/HabitModal.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/HabitModal.tsx#L275-L300)
* **Evidência:**
  ```tsx
  {/* Nome */}
  <div>
    <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
      Nome do Hábito *
    </label>
    <input
      type={discreet ? 'password' : 'text'}
      ...
    />
  </div>
  {/* Categoria */}
  <div>
    <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
      Categoria
    </label>
    <input
      type="text"
      ...
    />
  </div>
  ```
* **Impacto:** O leitor de tela (TalkBack / NVDA / VoiceOver) anuncia apenas "Texto de edição" sem identificar se o campo é o nome ou a categoria do hábito.
* **Recomendação de Correção:**
  Vincular explicitamente os elementos via `htmlFor` e `id`:
  ```tsx
  <label htmlFor="habit-title" className="...">Nome do Hábito *</label>
  <input id="habit-title" ... />

  <label htmlFor="habit-category" className="...">Categoria</label>
  <input id="habit-category" ... />
  ```

---

#### [A11Y-02] Botões de ação iconográficos operando apenas com `title` sem `aria-label` (WCAG 4.1.2)
* **Severidade:** **Alta**
* **Arquivo:** [`src/components/ManageHabits.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/ManageHabits.tsx#L236-L270) e [`src/components/HabitItem.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/HabitItem.tsx#L230-L255)
* **Evidência:**
  ```tsx
  <button
    type="button"
    onClick={() => toggleHideTitle(habit)}
    className="..."
    title={habit.hideTitle ? 'Mostrar nome do hábito' : 'Ocultar nome do hábito'}
  >
    {habit.hideTitle ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
  ```
* **Impacto:** O atributo `title` não é anunciado confiavelmente pela maioria dos leitores de tela em elementos `<button>`, resultando em leituras vazias como "botão" sem nome acessível.
* **Recomendação de Correção:**
  Adicionar `aria-label` correspondente em todos os botões de ação:
  ```tsx
  aria-label={habit.hideTitle ? 'Mostrar nome do hábito' : 'Ocultar nome do hábito'}
  ```

---

#### [A11Y-03] Contraste inferior ao limiar mínimo de 4.5:1 em textos secundários (WCAG 1.4.3)
* **Severidade:** **Média**
* **Arquivo:** [`src/components/DailyFocus.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/DailyFocus.tsx#L225), [`src/components/HabitItem.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/HabitItem.tsx#L216), [`src/components/WeeklyStrip.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/WeeklyStrip.tsx#L125)
* **Evidência:** No tema claro (`#FAFAFA`), elementos com classe `text-zinc-400` (`#a1a1aa`) apresentam contraste de apenas **2.49:1**. Elementos com `text-zinc-500` (`#71717a`) atingem **4.48:1** (abaixo de 4.5:1). Em [`WeeklyStrip.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/WeeklyStrip.tsx#L125), `opacity-60` reduz o contraste para menos de 2.0:1.
* **Impacto:** Dificuldade acentuada de leitura para usuários com baixa visão ou operando em ambientes externos sob luz solar.
* **Recomendação de Correção:**
  Ajustar a paleta monocromática secundária para no mínimo `text-zinc-600` (`#52525b`, contraste 5.8:1) no tema claro e `text-zinc-300` (`#d4d4d8`, contraste 9.5:1) no tema escuro em textos informativos de tamanho inferior a 18px.

---

#### [A11Y-04] Rótulo acessível da célula do grafo simplificado excessivamente (WCAG 1.1.1)
* **Severidade:** **Média**
* **Arquivo:** [`src/components/ConsistencyView.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/ConsistencyView.tsx#L206-L207)
* **Evidência:**
  ```tsx
  title={`${formatFriendlyDate(day.key)}: ${day.completedCount}/${day.scheduledCount} (${Math.round(day.ratio * 100)}%)`}
  aria-label={day.key}
  ```
* **Impacto:** O leitor de tela anuncia apenas "2026-10-24, botão", suprimindo os dados de conclusão, que ficam confinados ao `title`.
* **Recomendação de Correção:**
  Atribuir o texto formatado completo ao `aria-label`:
  ```tsx
  aria-label={`${formatFriendlyDate(day.key)}: ${day.completedCount} de ${day.scheduledCount} concluídos, ${Math.round(day.ratio * 100)}%`}
  ```

---

#### [A11Y-05] Indicadores de seleção e temporizador sem estados ARIA dinâmicos (WCAG 4.1.2)
* **Severidade:** **Média**
* **Arquivo:** [`src/components/WeeklyStrip.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/WeeklyStrip.tsx#L116-L130), [`src/components/BottomNav.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/BottomNav.tsx#L17-L28), [`src/components/PomoView.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/PomoView.tsx#L115-L125)
* **Evidência:**
  - Em [`WeeklyStrip.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/WeeklyStrip.tsx#L116), os botões dos 7 dias não possuem `aria-pressed={isSelected}` ou `aria-current={item.isToday ? 'date' : undefined}`.
  - Em [`BottomNav.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/BottomNav.tsx#L20), os botões de aba não expõem `aria-current="page"` nem `role="tab"` com `aria-selected`.
  - Em [`PomoView.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/PomoView.tsx#L119), o contador de tempo visual não possui `role="timer"`.
* **Impacto:** O usuário de tecnologia assistiva não recebe feedback sobre qual dia ou tela está ativa.
* **Recomendação de Correção:**
  Implementar `aria-pressed={isSelected}` nos dias e `aria-current="page"` na aba ativa da navegação inferior.

---

### 2.4 Usabilidade e UX (Web Design Guidelines)

#### [UX-01] Falta de reconciliação e fila offline para operações de hábitos e logs (Risco de Perda de Dados)
* **Severidade:** **Crítica**
* **Arquivo:** [`src/context/HabitsContext.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/context/HabitsContext.tsx#L413-L460) e [`L886-L897`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/context/HabitsContext.tsx#L886-L897)
* **Evidência:**
  ```tsx
  // No toggleHabitCompletion:
  if (user && db && isFirebaseConfigured) {
    try {
      await setDoc(logRef, { ... });
    } catch (err) {
      console.error('Falha ao salvar log no Firestore:', err);
    }
  }
  // No listener onSnapshot (ao reconectar):
  const unsubLogs = onSnapshot(logsCol, (snapshot) => {
    ...
    applyRemoteLogs(remoteLogs); // sobrescreve localmente sem mesclar
  });
  ```
* **Impacto:** Se o usuário marcar check-ins ou criar/editar hábitos enquanto offline, as chamadas falham no Firestore. Ao recuperar o sinal, o Firestore envia o snapshot do servidor (que ainda não tem as alterações locais), e o app sobrescreve o `localStorage` imediatamente com o estado remoto antigo, apagando o progresso do usuário.
* **Recomendação de Correção:**
  Criar uma fila de pendências locais (análoga à [`completionQueue.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/lib/completionQueue.ts) do SW) para registrar alterações locais ocorridas em modo offline e descarregá-las no Firestore antes de processar novos snapshots remotos.

---

#### [UX-02] Alvos de toque reduzidos para interação com o polegar (Thumb Zone)
* **Severidade:** **Média**
* **Arquivo:** [`src/components/WeeklyStrip.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/WeeklyStrip.tsx#L90-L105) e [`src/components/ManageHabits.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/ManageHabits.tsx#L236-L270)
* **Evidência:**
  - Botões de navegação da semana anterior/seguinte utilizam `p-1.5` com ícone de 14px, resultando em dimensões totais de apenas **26 × 26 px**.
  - Botões de ação em [`ManageHabits.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/ManageHabits.tsx#L239) medem 32 × 32 px com espaçamento de 4px, colocando o ícone de lixeira colado ao de arquivamento.
* **Impacto:** Alto índice de toques acidentais em dispositivos touchscreen com uma mão.
* **Recomendação de Correção:**
  Expandir a área de clique com pseudo-elementos invisíveis (`before:absolute before:-inset-2`) ou elevar o contêiner para `min-h-[44px] min-w-[44px]`.

---

#### [UX-03] Duplicação de botões de configuração no cabeçalho
* **Severidade:** **Baixa**
* **Arquivo:** [`src/components/Header.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/Header.tsx#L70-L93)
* **Evidência:**
  A barra superior renderiza o botão do Avatar com status de sincronização (linha 70) e, imediatamente ao lado, um segundo botão com o ícone de engrenagem (linha 85), ambos disparando `onOpenSettings`.
* **Impacto:** Ocupação redundante de espaço horizontal em telas mobile (< 380px).
* **Recomendação de Correção:**
  Ocultar o botão avulso de engrenagem quando o usuário estiver autenticado (pois o avatar já abre as configurações), ou integrá-los visualmente.

---

### 2.5 Performance e Core Web Vitals

#### [PERF-01] Bundle monolítico do Firebase SDK (508 kB uncompressed) carregado na inicialização
* **Severidade:** **Alta**
* **Arquivo:** [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L67-L70), [`src/lib/firebase.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/lib/firebase.ts#L1-31), [`src/App.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/App.tsx#L2)
* **Evidência:**
  O build de produção gera:
  ```
  dist/assets/firebase-CFi6pwfj.js   508.50 kB │ gzip: 117.72 kB
  dist/assets/index-CApxRFpL.js      308.36 kB │ gzip:  98.00 kB
  (!) Some chunks are larger than 500 kB after minification.
  ```
  O arquivo `dist/index.html` injeta `<link rel="modulepreload" href="/assets/firebase-*.js">`.
* **Impacto:** Mesmo um usuário que nunca faz login e usa o aplicativo 100% offline precisa baixar, descompactar e avaliar 508 kB de JavaScript do Firebase Auth e Firestore no primeiro carregamento, degradando o TBT e o LCP.
* **Recomendação de Correção:**
  Implementar carregamento dinâmico (`import('./firebase')`) ativado apenas quando existir sessão persistida no IndexedDB ou quando o usuário abrir a tela de login.

---

#### [PERF-02] Fontes externas Google Fonts não inclusas no precache do Service Worker
* **Severidade:** **Média**
* **Arquivo:** [`index.html`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/index.html#L20-L23)
* **Evidência:**
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  ```
* **Impacto:** O Service Worker precacheia apenas os arquivos estáticos locais. Em situações onde o usuário instala o PWA e entra em modo avião, as fontes externas podem falhar ao carregar caso não estejam no cache HTTP do navegador, gerando layout shift (CLS) ou exibição com fontes de sistema desajustadas.
* **Recomendação de Correção:**
  Auto-hospedar as fontes `Inter` e `JetBrains Mono` via pacotes `@fontsource` locais ou arquivos `.woff2` em `public/fonts/`, permitindo que o Workbox as precacheie de forma totalmente offline.

---

#### [PERF-03] Entradas duplicadas e referência a asset inexistente no precache do Service Worker
* **Severidade:** **Baixa**
* **Arquivo:** [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L25) e [`L53-L55`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L53-L55)
* **Evidência:**
  `includeAssets` inclui `favicon.svg` (arquivo inexistente em `public/`) e `apple-touch-icon.png`, `icon.svg`. Como o `globPatterns` já captura `**/*.{png,svg,webmanifest}`, o arquivo gerado `dist/sw.js` adiciona `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` e `icon.svg` **duas vezes** na lista do Workbox.
* **Impacto:** Desperdício de entradas no cache e ruído no manifesto de precache do Service Worker.
* **Recomendação de Correção:**
  Remover `favicon.svg` e esvaziar `includeAssets`, confiando no `globPatterns` do `injectManifest`.

---

### 2.6 PWA e Mobile

#### [PWA-01] Registro descontrolado de Service Worker dentro do app nativo Android (Capacitor)
* **Severidade:** **Alta**
* **Arquivo:** [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L19-L25) vs [`src/main.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/main.tsx#L12-L18)
* **Evidência:**
  Em [`src/main.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/main.tsx#L12):
  ```ts
  // Não roda no app nativo: o SW no esquema https://localhost do Capacitor conflita com o cache dos assets empacotados
  if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
    navigator.serviceWorker.register('/sw.js');
  }
  ```
  Porém, o `VitePWA` padrão gera e injeta automaticamente `dist/registerSW.js` no `index.html`:
  ```js
  if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/sw.js', { scope: '/' })})}
  ```
* **Impacto:** O Service Worker é ativado incondicionalmente no WebView do Capacitor Android, contornando a proteção criada pelos desenvolvedores e arriscando problemas de interceptação de assets locais no dispositivo.
* **Recomendação de Correção:**
  Adicionar `injectRegister: null` na configuração do `VitePWA` em [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L19).

---

#### [PWA-02] Discrepância de idioma no manifesto PWA (`lang: "en"` vs `pt-BR`)
* **Severidade:** **Média**
* **Arquivo:** [`dist/manifest.webmanifest`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/dist/manifest.webmanifest#L1) vs [`index.html`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/index.html#L2)
* **Evidência:** O arquivo `dist/manifest.webmanifest` gerado pelo Vite contém `"lang":"en"`, enquanto o `index.html` declara `<html lang="pt-BR">` e todos os textos da aplicação são em português.
* **Impacto:** Alerta de inconsistência de metadados em auditorias de qualidade web e telas de instalação de PWA em navegadores móveis.
* **Recomendação de Correção:**
  Declarar `lang: 'pt-BR'` explicitamente dentro do bloco `manifest` em [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L27).

---

#### [PWA-03] Ausência de screenshots e ícone maskable dedicado com Safe Area
* **Severidade:** **Baixa**
* **Arquivo:** [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L34-L51)
* **Evidência:** O manifesto usa apenas o `icon.svg` com `purpose: "any maskable"`. Não há imagens PNG dedicadas com safe-zone de 20% nem o array `screenshots` para habilitar o banner de instalação rico no Chrome Mobile.
* **Impacto:** O app recebe a barra de instalação simplificada (mini-infobar) em vez da folha de instalação com pré-visualização no Android.
* **Recomendação de Correção:**
  Adicionar imagens de captura de tela em `public/screenshots/` e declarar ícones maskable PNG dedicados.

---

### 2.7 Qualidade de Código e Testes

#### [CODE-01] Ausência de testes de integração para concorrência offline e reconciliação de estado
* **Severidade:** **Baixa**
* **Arquivo:** [`tests/`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/tests)
* **Evidência:** Embora existam 306 testes unitários para a lógica pura (cálculos de períodos, ofensivas, criptografia de PIN, datas, etc.), não há testes de integração cobrindo o fluxo de descarte vs. mesclagem de estado durante interrupções de rede no `HabitsContext`.
* **Impacto:** O problema reportado em `[UX-01]` não foi detectado pelos testes automatizados existentes.
* **Recomendação de Correção:**
  Criar um teste de integração simulando mutações locais seguidas pelo disparo simulado de um `onSnapshot` do Firestore com estado desatualizado.

---

## 3. Resultado dos Testes Automatizados e Auditorias CLI

### 3.1 Execução de Testes Unitários (`npm test`)
* **Comando:** `vitest run`
* **Status:** **APROVADO (100%)**
* **Tempo de Execução:** 2.93s
* **Detalhes:**
  - Arquivos de Teste: **23 aprovados** de 23
  - Total de Testes: **306 aprovados** de 306
  - Destaques: `lock.test.ts` (20 testes cobrindo derivação PBKDF2 em tempo constante e lockout exponencial), `graces.test.ts` (22 testes), `weekly.test.ts` (36 testes), `avoid.test.ts` (27 testes).

### 3.2 Execução de Testes de Regras do Firestore (`npm run test:rules`)
* **Comando:** `firebase emulators:exec --only firestore --project demo-mono-habits 'vitest run --dir tests/rules'`
* **Status:** **APROVADO (100%)**
* **Tempo de Execução:** 4.53s
* **Detalhes:**
  - Arquivos de Teste: **1 aprovado** (`firestore.rules.test.ts`)
  - Total de Testes: **8 aprovados** de 8
  - Cobertura validada: isolamento por usuário (`isOwner`), bloqueio de coleções desconhecidas, validação de limites de caracteres em capas (120k chars), negação de campos extras via `hasOnly()`.

### 3.3 Verificação de Tipos TypeScript (`npm run lint`)
* **Comando:** `tsc --noEmit`
* **Status:** **APROVADO (0 erros)**

### 3.4 Auditoria de Dependências (`npm audit`)
* **Status:** **20 vulnerabilidades identificadas** (todas em devDependencies / ferramentas de compilação)
* **Distribuição:** 3 Críticas, 4 Altas, 12 Moderadas, 1 Baixa.

---

## 4. Plano de Ação Priorizado

### 🚀 Fase 1: Quick Wins (Correção Imediata — ~1 a 2 horas)
Mudanças pontuais, sem risco de quebra de contrato ou alteração de modelo de dados:

1. **Ajuste do CSP para Atualizações:** Adicionar `https://api.github.com` à diretiva `connect-src` em [`vercel.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vercel.json#L41) e [`firebase.json`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/firebase.json#L34).
2. **Desativação do Auto-Register do VitePWA:** Adicionar `injectRegister: null` em [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L19) para impedir que o SW rode no Android WebView.
3. **Correção de Acessibilidade em Formulários:** Adicionar `htmlFor` e `id` nos campos de título e categoria em [`HabitModal.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/HabitModal.tsx#L275-L300).
4. **Adição de `aria-label` nos Botões de Ação:** Adicionar rótulos aos botões de ocultar, editar, arquivar e excluir em [`ManageHabits.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/ManageHabits.tsx#L236) e [`HabitItem.tsx`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/src/components/HabitItem.tsx#L230).
5. **Limpeza do Precache:** Remover a referência ao `favicon.svg` fantasma e ajustar `manifest.lang` para `'pt-BR'` em [`vite.config.ts`](file:///home/guilherme/orca/workspaces/mono-habits/checkup-seguranca-ux/vite.config.ts#L25).

---

### ⚡ Fase 2: Médio Prazo (Próximo Ciclo — ~1 a 2 dias)
Melhorias de robustez, usabilidade e conformidade:

1. **Revisão de Contrastes Monocromáticos (WCAG 2.2 AA):** Ajustar classes `text-zinc-500` e `text-zinc-400` para `text-zinc-600` (claro) e `text-zinc-300` (escuro) em todos os textos secundários.
2. **Área de Toque Mobile:** Aumentar alvos de clique em botões de chevron e listas para no mínimo 44 × 44 px.
3. **Reforço nas Regras do Firestore:** Bloquear alteração de `createdAt` em updates e validar integridade básica dos arrays de frequência.
4. **Overrides de Dependências no npm:** Atualizar `package.json` para neutralizar advisories do `tar` e `tinypool`.

---

### 🏗️ Fase 3: Trabalho Estrutural (Evolução Arquitetural — ~1 a 2 semanas)
Evoluções que fortalecem a promessa de resiliência e performance do produto:

1. **Fila de Mutação e Reconciliação Offline no Firestore:**
   - Implementar uma fila de mutações offline persistida em IndexedDB no cliente para todas as ações (`saveHabit`, `toggleHabitCompletion`, `markSlip`, `applyGrace`).
   - Ao restabelecer a conexão, descarregar a fila pendente antes de processar snapshots remotos, garantindo que o progresso feito sem internet nunca seja perdido.
2. **Carregamento Dinâmico (Code Splitting) do Firebase:**
   - Transformar a importação estática do Firebase em import dinâmico assíncrono.
   - Reduzir o bundle inicial da página de **816 kB** para **~308 kB**, acelerando substancialmente o First Contentful Paint em conexões lentas.
3. **Auto-Hospedagem das Fontes:**
   - Adicionar os arquivos de fonte WOFF2 de `Inter` e `JetBrains Mono` ao pacote da aplicação, eliminando a dependência em tempo de execução de servidores do Google e tornando a estética tipográfica 100% offline.

---
*Relatório consolidado e verificado contra a base de código do repositório MONO // HABITS.*

---

## 5. Revisão Independente dos Achados (Claude Code)

Os achados críticos e altos foram verificados novamente contra o código. Resultado:

### 5.1 Confirmados
- **[PWA-01]** Confirmado: `dist/index.html` injeta `<script id="vite-plugin-pwa:register-sw" src="/registerSW.js">` e `vite.config.ts` não define `injectRegister`, contornando a guarda `!Capacitor.isNativePlatform()` de `src/main.tsx`.
- **[A11Y-01]** Confirmado: em `HabitModal.tsx` apenas `habit-description` usa `htmlFor`; "Nome do Hábito" e "Categoria" não têm associação.
- **[PERF-03] / [PWA-02]** Confirmados: `includeAssets` referencia `favicon.svg` inexistente em `public/`; manifesto gerado com `lang: "en"`.
- **[SEC-03]** Confirmado, mas de impacto baixo (chaves de cliente do Firebase são públicas por design; a proteção real são as regras).

### 5.2 Falso positivo — [SEC-01] descartado
A checagem de atualização (`UpdateNotice.tsx`, linhas 31, 47 e 69) só executa quando `Capacitor.isNativePlatform()` é verdadeiro. No APK os headers de `vercel.json`/`firebase.json` não se aplicam e o `index.html` não declara CSP via `<meta>`. Na web a chamada a `api.github.com` nunca ocorre. **Nenhuma alteração de CSP é necessária.**

### 5.3 Reclassificado — [UX-01] de Crítica para **Alta**, com cenário corrigido
O cenário "snapshot antigo sobrescreve dados ao reconectar com o app aberto" **não ocorre**: com o app aberto, o Firestore mantém as escritas pendentes e aplica latency compensation nos snapshots. O risco real é outro:
1. `src/lib/firebase.ts` usa `getFirestore(app)`, ou seja, cache **apenas em memória**.
2. Check-ins/edições feitos offline ficam pendentes só na memória; se o app for fechado ou recarregado antes de reconectar, essas escritas se perdem.
3. Na próxima abertura, a sincronização inicial (`HabitsContext.tsx`, ramo `else` de `evaluateInitialCloudSync`, ~linhas 394-399) substitui o `localStorage` pelo estado remoto, apagando o que só existia localmente.

**Correção recomendada (mais simples que a fila de mutações proposta):** inicializar o Firestore com cache persistente em IndexedDB:
```ts
db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
```
Com isso as escritas pendentes sobrevivem a reinícios e são enviadas ao reconectar.

### 5.4 Prioridade revisada
1. [PWA-01] `injectRegister: null` no `VitePWA`.
2. [UX-01] Cache persistente do Firestore (`persistentLocalCache`) + teste cobrindo o cenário.
3. [A11Y-01] / [A11Y-02] `htmlFor`/`id` nos campos e `aria-label` nos botões iconográficos; [A11Y-04] `aria-label` completo nas células do grafo.
4. [PERF-03] / [PWA-02] Remover `favicon.svg` de `includeAssets` e definir `lang: 'pt-BR'` no manifesto.
5. [FSR-02] Impedir alteração de `createdAt` em `update` nas regras (com teste em `tests/rules`).
6. [SEC-01] **Não aplicar.**
