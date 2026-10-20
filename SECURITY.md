# Política de Segurança — MONO // HABITS

A segurança e a privacidade dos dados dos usuários do **MONO // HABITS** são tratadas com prioridade. Este documento descreve as versões suportadas, o escopo de segurança do projeto e como relatar vulnerabilidades de forma responsável.

## Versões suportadas

Apenas a versão mais recente publicada na branch `main` (aplicação web em `https://mono-habits.web.app` e APK Android mais recente em [GitHub Releases](https://github.com/raguiohead/mono-habits/releases)) recebe correções de segurança:

| Versão | Suportada |
| :--- | :--- |
| Última versão (`main` / Release atual) | Sim |
| Versões anteriores | Não |

## Como relatar uma vulnerabilidade

**Por favor, não abra uma Issue pública nem um Pull Request público para relatar falhas de segurança.**

Utilize um dos canais privados abaixo:

1. **GitHub Private Vulnerability Reporting (recomendado):**
   Abra um relato privado diretamente na aba de segurança do repositório:
   [https://github.com/raguiohead/mono-habits/security/advisories/new](https://github.com/raguiohead/mono-habits/security/advisories/new)
2. **E-mail direto ao mantenedor:**
   Envie os detalhes para **[devguilherme@hotmail.com](mailto:devguilherme@hotmail.com)** com o assunto `[SECURITY] MONO // HABITS`.

Para facilitar a análise, inclua no relato:
- Descrição clara da vulnerabilidade e do impacto potencial;
- Passo a passo para reprodução (PoC, requisições, regras afetadas ou trechos de código);
- Ambiente afetado (Web/PWA, Android APK, Firebase Auth/Firestore ou CI/CD).

## Prazo de resposta

- **Confirmação de recebimento:** em até **72 horas** (3 dias úteis).
- **Avaliação técnica e plano de correção:** em até **7 dias corridos** após a confirmação.
- **Publicação da correção:** conforme a severidade (falhas críticas e altas têm prioridade imediata, geralmente corrigidas em até **14 dias**).

## Escopo

### Dentro do escopo
- Aplicação web/PWA (`src/`, Service Worker e configurações de cabeçalhos/CSP);
- Aplicativo Android empacotado via Capacitor (`android/`);
- Regras de segurança do Cloud Firestore (`firestore.rules`) e fluxos de autenticação/exclusão de dados;
- Fluxos de integração e entrega contínua (`.github/workflows/`).

### Fora do escopo
- **Leitura local de `localStorage` em dispositivo desbloqueado:** conforme documentado na Política de Privacidade e no próprio aplicativo, o bloqueio por PIN/biometria é uma trava de interface e não criptografa os dados em repouso no `localStorage`;
- Chaves públicas de configuração cliente do Firebase (`apiKey` / `appId`), desde que devidamente protegidas por restrições de domínio/aplicativo e pelas regras do Firestore;
- Ataques de negação de serviço volumétricos contra a infraestrutura gerenciada do Google/Firebase ou GitHub, engenharia social e phishing.
