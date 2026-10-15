# Diretrizes de Desenvolvimento e Governança Técnica

Este documento define os padrões arquiteturais, padrões de código e convenções operacionais para o desenvolvimento contínuo do **MONO // HABITS**.

---

## 1. Padrões de Design & UI/UX

1. **Monocromatismo Estrito:**
   - Proibido o uso de classes de cores como `text-blue-500`, `bg-red-500`, etc.
   - Qualquer estado ou feedback deve ser representado através da escala `Zinc` (`zinc-50` até `zinc-950`), `black`, `white`, opacidade e bordas.
2. **Ergonomia Mobile-First (Thumb Zone):**
   - Todos os elementos interativos devem possuir área mínima de toque de **44x44px**.
   - Ações frequentes devem ficar concentradas na parte inferior da tela através da `BottomNav`.
   - Modais devem se comportar como *bottom sheets* em telas `< 640px`.
3. **Motion Design & Performance:**
   - Transições rápidas e ágeis (150ms–250ms) usando curvas de aceleração naturais (`cubic-bezier(0.16, 1, 0.3, 1)`).
   - Uso de skeleton screens dimensionadas para evitar Cumulative Layout Shift (CLS).

---

## 2. Camada de Persistência (Local-First + Nuvem)

1. **Paridade Obrigatória:**
   - Toda alteração de estado (salvar hábito, alternar conclusão, arquivar, excluir) deve gravar primeiro no `localStorage` de forma síncrona/otimista.
   - A sincronização com o Firestore é assíncrona e tolerante a falhas (não bloqueia a interface caso o usuário esteja offline ou sem Firebase configurado).
2. **Migração Transparente:**
   - Ao detectar um novo login Google onde a nuvem não possui hábitos registrados, o sistema migra automaticamente o banco local para a nuvem.

---

## 3. Qualidade & Testes

1. Antes de qualquer commit ou abertura de PR, execute:
   ```bash
   npm test
   npm run build
   ```
2. Mantenha cobertura de testes unitários para qualquer cálculo envolvendo datas, sequências (*streaks*) ou agregações estatísticas em `src/lib/`.

## 4. Acessibilidade & Privacidade

1. Modais usam `ModalShell` (role `dialog`, Esc, foco preso). Não desative o zoom no `viewport`.
2. Preferências ficam em `SettingsContext` (`src/lib/settings.ts`); novas chaves de dados do usuário devem entrar em `exportLocalData` e `clearLocalUserData` (`src/lib/storage.ts`).
3. Ao alterar quais dados são coletados, atualize `PrivacyPolicy.tsx` e `PRIVACY_UPDATED_AT`.

## Somente planos gratuitos

O projeto deve rodar inteiramente em planos gratuitos (Firebase **Spark** + Vercel **Hobby**). Não adicionar nada que exija plano pago, por exemplo:

- **Cloud Functions** (exige o plano Blaze) e, por consequência, push agendado via servidor;
- Cloud Storage, Cloud Run ou qualquer serviço Google Cloud faturável;
- recursos Vercel restritos a planos Pro/Enterprise.

Dentro do plano gratuito: Firebase Auth, Firestore (respeitando as cotas diárias) e Vercel Web Analytics. Lembretes funcionam localmente, com o app aberto.
