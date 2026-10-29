# Relatório de Auditoria de Segurança — MONO // HABITS (Trivy 2026-10)

Data da Auditoria: 28 de outubro de 2026  
Escopo: Repositório remoto `raguiohead/mono-habits`, branches remotas, histórico git completo (clone espelho), filesystem local do worktree e APK da release v1.3.0.  
Ferramenta: **Trivy v0.76.1** (Aqua Security)  
Modo de Execução: Somente leitura (auditoria estrita sem alterações no código-fonte ou branches de produção).

---

## 1. Informações de Ambiente e Base de Dados do Trivy

A instalação foi realizada localmente em `~/.local/bin/trivy` a partir do binário oficial da release GitHub `v0.76.1` para Linux x86_64, com validação de integridade criptográfica SHA256 contra o arquivo `trivy_0.76.1_checksums.txt`.

* **Trivy CLI Version:** `0.76.1`
* **Vulnerability DB:**
  * Schema Version: `2`
  * UpdatedAt: `2026-10-29 01:22:22 UTC`
  * NextUpdate: `2026-10-30 01:22:22 UTC`
  * DownloadedAt: `2026-10-29 02:30:57 UTC`
* **Check Bundle (Misconfiguration / Policies):**
  * Digest: `sha256:b591e9190cff4aa4e385b1a25bccfd9ecf178d3c77fd194e1410b7ce7e1df058`
  * DownloadedAt: `2026-10-29 02:31:02 UTC`
* **Diretório de Artefatos Brutos (JSON):**
  * `/home/guilherme/.claude/projects/-mnt-HD-13-projects-mono-habits/trivy-raw/` (armazenado fora do repositório, não versionado).

---

## 2. Resumo da Varredura por Branch

Todas as 12 branches ativas no repositório remoto foram mapeadas via `git ls-remote --heads origin` e submetidas aos scanners `vuln,secret,misconfig,license`:

| Branch Remota | CRITICAL | HIGH | MEDIUM | LOW | Secrets | Misconfigs | Licenças Restritivas (LGPL) | Total Vulns |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `main` | 0 | 0 | 4 | 1 | 0 | 0 | 14 | **5** |
| `development` | 0 | 0 | 1 | 1 | 0 | 0 | 14 | **2** |
| `chore/dependabot-ignore-major` | 3 | 13 | 12 | 4 | 0 | 0 | 0 | **32** |
| `claude/mobile-bugs-pomo-feature-g3j9fb` | 3 | 13 | 12 | 4 | 0 | 0 | 0 | **32** |
| `dependabot/npm_and_yarn/npm-minor-patch-e62173cb1e` | 0 | 0 | 1 | 1 | 0 | 0 | 14 | **2** |
| `feat/android` | 3 | 12 | 10 | 5 | 0 | 0 | 0 | **30** |
| `feat/seguranca` | 3 | 13 | 12 | 4 | 0 | 0 | 0 | **32** |
| `raguiohead/checkup-seguranca-ux` | 3 | 13 | 12 | 4 | 0 | 0 | 0 | **32** |
| `raguiohead/ciclo2-a11y-perf` | 0 | 0 | 4 | 1 | 0 | 0 | 14 | **5** |
| `raguiohead/deps-overrides-uuid-postcss` | 0 | 0 | 1 | 1 | 0 | 0 | 14 | **2** |
| `raguiohead/dev-pipeline` | 0 | 0 | 4 | 1 | 0 | 0 | 14 | **5** |
| `raguiohead/docs-firebase-only` | 0 | 0 | 4 | 1 | 0 | 0 | 14 | **5** |

### Observações sobre a Matriz:
1. **Redução Notável de Vulnerabilidades:** As branches antigas acumulavam 30 a 32 vulnerabilidades devidas a versões desatualizadas de pacotes utilitários de build (`tar`, `tinypool`, `sharp`, `body-parser`, `vitest`).
2. **Branch `development` vs `main`:**
   * A branch `main` possui 5 vulnerabilidades (4 MEDIUM, 1 LOW).
   * A branch `development` possui apenas 2 vulnerabilidades (1 MEDIUM, 1 LOW), demonstrando que o PR `raguiohead/deps-overrides-uuid-postcss` já eliminou com sucesso as vulnerabilidades de `uuid` e `postcss-selector-parser` em `development`.
3. **Licenças Restritivas:** Os 14 alertas de licença nas branches modernas correspondem a pacotes de suporte pré-compilados do `@img/sharp-*` (`LGPL-3.0-or-later`). Como o `sharp` está declarado em `devDependencies` e é usado estritamente no script de geração de assets do Capacitor, nenhuma biblioteca LGPL é distribuída no bundle JavaScript de produção ou no APK Android final.

---

## 3. Achados Deduplicados de Vulnerabilidades

Identificou-se um total de **32 achados únicos** (CVEs/GHSAs) através de todas as branches:

| Severidade | Identificador | Pacote | Versão Instalada | Versão Corrigida | Tipo de Dependência | Qtd Branches | Status de Mitigação |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **CRITICAL** | `CVE-2026-59873` | `tar` | `6.2.1` | `7.5.19` | Dev / Build | 5 | Corrigido nas branches ativas via override `^7.5.22` |
| **CRITICAL** | `CVE-2026-104848` | `tinypool` | `1.1.1` | `2.1.1` | Dev / Build | 5 | Corrigido com atualização do Vitest para `4.1.12` |
| **CRITICAL** | `CVE-2026-104849` | `tinypool` | `1.1.1` | `2.1.2` | Dev / Build | 5 | Corrigido com atualização do Vitest para `4.1.12` |
| **HIGH** | `CVE-2026-101916` | `@grpc/grpc-js` | `1.9.16` | `1.13.6, 1.14.5` | **Runtime** | 1 | Corrigido via override `^1.14.0` em `main` e `development` |
| **HIGH** | `CVE-2026-111181` | `body-parser` | `1.20.8, 2.3.0` | `2.4.0, 1.20.9` | Dev / Build | 4 | Corrigido via override `^2.4.0` |
| **HIGH** | `GHSA-f88m-g3jw-g9cj` | `sharp` | `0.32.6` | `0.35.0` | Dev / Build | 5 | Corrigido via override `^0.35.5` |
| **HIGH** | `GHSA-rgj7-g3m4-5g8c` | `sharp` | `0.32.6` | `0.35.4` | Dev / Build | 5 | Corrigido via override `^0.35.5` |
| **HIGH** | `GHSA-wq5f-xc86-pv6w` | `sharp` | `0.32.6` | `0.35.5` | Dev / Build | 5 | Corrigido via override `^0.35.5` |
| **HIGH** | `CVE-2026-23745` | `tar` | `6.2.1` | `7.5.3` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-23950` | `tar` | `6.2.1` | `7.5.4` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-24842` | `tar` | `6.2.1` | `7.5.7` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-26960` | `tar` | `6.2.1` | `7.5.8` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-29786` | `tar` | `6.2.1` | `7.5.10` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-31802` | `tar` | `6.2.1` | `7.5.11` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-59874` | `tar` | `6.2.1` | `7.5.18` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **HIGH** | `CVE-2026-73566` | `tar` | `6.2.1` | `7.5.21` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **MEDIUM** | `CVE-2026-54285` | `@opentelemetry/core` | `1.30.1` | `2.8.0` | Dev / Build | 11 | **Ativo** (transitivo de `firebase-tools`) |
| **MEDIUM** | `CVE-2026-41907` | `uuid` | `7.0.3, 9.0.1` | `11.1.1` | Dev / Build | 9 | Corrigido em `development`, pendente em `main` |
| **MEDIUM** | `CVE-2026-104844` | `postcss-selector-parser`| `6.1.4` | `7.1.6, 6.1.5` | Dev / Build | 9 | Corrigido em `development`, pendente em `main` |
| **MEDIUM** | `CVE-2026-112949` | `@vitest/mocker` | `3.2.7` | `4.1.12, 5.0.3` | Dev / Build | 5 | Corrigido com atualização do Vitest |
| **MEDIUM** | `CVE-2026-84373` | `@vitest/mocker` | `3.2.7` | `4.1.11` | Dev / Build | 5 | Corrigido com atualização do Vitest |
| **MEDIUM** | `CVE-2026-84373` | `vitest` | `3.2.7` | `4.1.11` | Dev / Build | 5 | Corrigido com atualização do Vitest |
| **MEDIUM** | `CVE-2026-110180` | `fast-uri` | `3.1.8` | `2.4.8, 3.1.9` | Dev / Build | 5 | Corrigido nas branches modernas |
| **MEDIUM** | `CVE-2026-110306` | `fast-uri` | `3.1.8` | `2.4.8, 3.1.9` | Dev / Build | 5 | Corrigido nas branches modernas |
| **MEDIUM** | `CVE-2026-53655` | `tar` | `6.2.1` | `7.5.16` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **MEDIUM** | `CVE-2026-59871` | `tar` | `6.2.1` | `7.5.18` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **MEDIUM** | `CVE-2026-59875` | `tar` | `6.2.1` | `7.5.17` | Dev / Build | 5 | Corrigido via override `^7.5.22` |
| **LOW** | `CVE-2026-101915` | `@grpc/grpc-js` | `1.9.16` | `1.13.6, 1.14.5` | **Runtime** | 1 | Corrigido via override `^1.14.0` |
| **LOW** | `CVE-2026-93753` | `deepmerge` | `4.3.1` | *Sem correção* | Dev / Build | 12 | **Ativo** (transitivo de `vite-plugin-pwa`) |
| **LOW** | `CVE-2026-110095` | `fast-uri` | `3.1.8` | `2.4.8, 3.1.9` | Dev / Build | 5 | Corrigido nas branches modernas |
| **LOW** | `CVE-2026-110725` | `fast-uri` | `3.1.8` | `2.4.8, 3.1.9` | Dev / Build | 5 | Corrigido nas branches modernas |
| **LOW** | `CVE-2026-115897` | `serialize-javascript`| `7.1.2` | `7.1.3` | Dev / Build | 5 | Corrigido nas branches modernas |

---

## 4. Auditoria de Segredos no Histórico Git

Para cobrir a totalidade do histórico (já que o Trivy analisa apenas snapshots de branches), foi executado um clone espelho (`git clone --mirror`) cobrindo todos os **143 commits** e 7 tags de release existentes.

### Resultados da Varredura Profunda:
* **Chaves Privadas / Certificados:** NENHUM certificado ou chave privada (`BEGIN PRIVATE KEY`, `BEGIN RSA`) foi commitado em qualquer ponto da história.
* **Service Accounts:** NENHUM arquivo JSON de conta de serviço Google Cloud / Firebase foi encontrado.
* **Credenciais de Cloud / Tokens Pessoais:** NENHUM Personal Access Token do GitHub (`ghp_`), chave AWS (`AKIA...`) ou segredo de nuvem vazou.

### Ocorrências Mapeadas e Mascaradas:
De acordo com os protocolos de segurança, valores identificados são relatados apenas com arquivo, commit, tipo e os 4 primeiros caracteres:

1. **`android/app/google-services.json`**
   * Commit: `3782a620` | Tipo: Google API Key (Firebase Web Client) | Prefixo: `AIza...` (39 caracteres).
   * *Diagnóstico:* Trata-se do identificador de cliente público do projeto Firebase para Android (`current_key`). Por design da arquitetura Firebase, chaves de API cliente não conferem privilégios administrativos e dependem de regras de segurança (Firestore Rules) e App Check. Não é uma credencial secreta.
2. **`src/lib/firebaseConfig.ts` e `src/lib/firebase.ts`**
   * Commits: `1af21d8a`, `6c523122` | Tipo: Google API Key (Fallback Web Client) | Prefixo: `AIza...` (39 caracteres).
   * *Diagnóstico:* Fallback público para ambiente web caso a variável `VITE_FIREBASE_API_KEY` não seja informada.
3. **`CHECKUP.md`**
   * Commit: `e25f9503` | Tipo: Google API Key (Documentação) | Prefixo: `AIza...` (39 caracteres).
4. **`tests/securitySync.test.ts`**
   * Commit: `6ab0dc7a` | Tipo: Dummy API Key para testes unitários | Prefixo: `fake...` (12 caracteres).
5. **`android/app/mono-debug.keystore`**
   * Adicionado no commit `3782a620`, **removido com sucesso** no commit `1ddad794` (`feat/seguranca`).
   * *Diagnóstico:* Era a chave pública padrão do SDK de debug do Android. Foi eliminada para que a assinatura de release utilize segredos seguros em CI (`ANDROID_KEYSTORE_BASE64`).
6. **Variáveis de CI em `.github/workflows/build-android-apk.yml`**
   * Commit: `1ddad794` | Tipo: Expansão de segredos de keystore | Prefixo: `$AND...`.
   * *Diagnóstico:* Strings de expansão de ambiente do runner do GitHub Actions; os segredos reais residem no GitHub Secrets.

---

## 5. Auditoria de Configurações e Misconfigurations

A varredura estática e a revisão detalhada cobriram os arquivos de infraestrutura e orquestração do projeto:

### 5.1 Regras de Segurança do Firestore (`firestore.rules`)
* **Controle de Acesso Baseado no Proprietário:**
  * Uso consistente de `isAuthenticated() && request.auth.uid == userId`.
  * Caminho de documentos isolado por UID: `/artifacts/mono-habit-tracker/users/{userId}`.
* **Validação Rígida de Schema:**
  * Validação atômica de chaves via `hasOnly(...)` e `hasAll(...)` em todas as subcoleções (`habits`, `logs`, `graces`, `slips`, `pomoSessions`).
  * Tipagem estrita em cada campo (`is string`, `is number`, `is bool`, `is list`, `is map`).
  * Limites de payload, comprimento de strings e regex (ex: `date.matches('^\\d{4}-\\d{2}-\\d{2}$')`, restrição de dataUrl base64 <= 130.000 chars para capas).
* **Imutabilidade e Postura Padrão:**
  * Proibição de alteração do campo `createdAt` durante updates de hábitos.
  * Cláusula final `match /{document=**} { allow read, write: if false; }` bloqueando qualquer documento não previsto explicitamente.
  * Suíte automatizada com emulador local presente em `tests/rules/firestore.rules.test.ts`.

### 5.2 Workflows do GitHub Actions (`.github/workflows/*.yml`)
* **Fixação por Hash Completo (SHA Pinning):**
  * Todas as actions de terceiros (`actions/checkout`, `actions/setup-node`, `actions/setup-java`, `gradle/actions/setup-gradle`, `actions/upload-artifact`, `FirebaseExtended/action-hosting-deploy`) estão fixadas com SHA de commit de 40 caracteres, prevenindo ataques de Supply Chain em tags mutáveis.
* **Princípio do Menor Privilégio:**
  * Declaração de `permissions: contents: read` no escopo global de todos os workflows.
  * Elevação para `permissions: contents: write` restrita exclusivamente aos jobs necessários de publicação de release (`release` e `prerelease` em `build-android-apk.yml`).
* **Manipulação de Segredos em Memória:**
  * No build do Android, a keystore é decodificada em `$RUNNER_TEMP`, com permissão `chmod 600`, e o arquivo é sumariamente destruído (`rm -f`) após a compilação do APK.

### 5.3 Configuração Android (`android/`)
* **`AndroidManifest.xml`:**
  * `android:allowBackup="false"` devidamente configurado, impedindo extração de dados locais via ADB backup.
  * `FileProvider` configurado como `exported="false"` e restrito a caminhos em cache.
  * Permissões declaradas mínimas e estritamente necessárias (`INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`).
* **`android/app/build.gradle` (Oportunidade de Hardening):**
  * O build type `release` está com `minifyEnabled false`.
  * *Recomendação:* Para builds públicos de produção, avaliar a ativação do R8/ProGuard (`minifyEnabled true`) para remoção de código não utilizado e ofuscação contra engenharia reversa.

---

## 6. Auditoria de Artefato de Release (APK v1.3.0)

O artefato oficial `mono-habits.apk` da Release mais recente `v1.3.0` (tamanho: 5.500.724 bytes) foi baixado diretamente do GitHub Releases e submetido aos scanners do Trivy:

* **Scanner `trivy fs` (conteúdo descompactado):**
  * Vulnerabilidades: **0**
  * Segredos: **0**
  * Misconfigurações: **0**
  * Licenças Críticas: **0**
* **Scanner `trivy rootfs`:**
  * Resultado: **0 achados** (nenhum pacote vulnerável ou credencial incorporada ao binário compilado).

---

## 7. Status e Recomendações de Branches Remotas

Das 12 branches remotas inspecionadas, 8 já estão totalmente incorporadas (ancestrais diretas) em `origin/development` e `origin/main`, tornando-se candidatas à remoção para higiene e organização do repositório:

| Branch Remota | Status em Relação à `development` | Status em Relação à `main` | Recomendação |
| :--- | :--- | :--- | :--- |
| `chore/dependabot-ignore-major` | Totalmente Mergeada (+0 / -42) | Totalmente Mergeada (+0 / -41) | **Recomenda-se exclusão** |
| `claude/mobile-bugs-pomo-feature-g3j9fb` | Totalmente Mergeada (+0 / -36) | Totalmente Mergeada (+0 / -35) | **Recomenda-se exclusão** |
| `feat/android` | Totalmente Mergeada (+0 / -46) | Totalmente Mergeada (+0 / -45) | **Recomenda-se exclusão** |
| `feat/seguranca` | Totalmente Mergeada (+0 / -44) | Totalmente Mergeada (+0 / -43) | **Recomenda-se exclusão** |
| `raguiohead/checkup-seguranca-ux` | Totalmente Mergeada (+0 / -28) | Totalmente Mergeada (+0 / -27) | **Recomenda-se exclusão** |
| `raguiohead/ciclo2-a11y-perf` | Totalmente Mergeada (+0 / -13) | Totalmente Mergeada (+0 / -12) | **Recomenda-se exclusão** |
| `raguiohead/dev-pipeline` | Totalmente Mergeada (+0 / -8) | Totalmente Mergeada (+0 / -7) | **Recomenda-se exclusão** |
| `raguiohead/docs-firebase-only` | Totalmente Mergeada (+0 / -3) | Totalmente Mergeada (+0 / -2) | **Recomenda-se exclusão** |
| `raguiohead/deps-overrides-uuid-postcss` | Totalmente Mergeada em `dev` | Pendente em `main` (+1 / -1) | Manter até o próximo release |
| `dependabot/npm_and_yarn/npm-minor-patch-e62173cb1e` | Não mergeada (+1 commit de dependência) | Não mergeada | Revisar e mergear PR ativo |
| `development` | Branch de integração ativa | Branch base | **Manter** |
| `main` | Branch de produção | Branch de produção | **Manter** |

> *Atenção:* Conforme as diretrizes desta auditoria, nenhuma branch foi alterada ou excluída. Esta listagem é estritamente consultiva.

---

## 8. Plano de Ação e Recomendações Priorizadas

1. **Prioridade 1 (Imediata — Propagação para Produção):**
   * Realizar o merge da branch `development` na branch `main`. A branch `development` já contém os overrides que corrigem as vulnerabilidades MEDIUM de `uuid` (`11.1.1`) e `postcss-selector-parser` (`7.1.6`), reduzindo os achados de `main` de 5 para apenas 2.
2. **Prioridade 2 (Curto Prazo — Dependência de Build):**
   * Monitorar ou aplicar override para `@opentelemetry/core` (`^2.8.0`). Atualmente a versão `1.30.1` é puxada transitivamente por `firebase-tools@15.34.0`. Como se trata de ferramenta de linha de comando para emuladores e deploy em ambiente de desenvolvimento/CI, não há vetor de ataque exposto aos usuários finais.
3. **Prioridade 3 (Higiene de Repositório):**
   * Executar a limpeza das 8 branches remotas já mergeadas (`git push origin --delete <branch>`), reduzindo a superfície de branches obsoletas no repositório.
4. **Prioridade 4 (Melhoria Contínua em Android):**
   * Avaliar a habilitação de `minifyEnabled true` no `buildTypes.release` do Gradle (`android/app/build.gradle`) com regras adequadas do ProGuard para Capacitor, reforçando a proteção do binário Android contra engenharia reversa.
