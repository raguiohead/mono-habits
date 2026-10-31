import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getStoredTheme } from '@/lib/storage';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_CONTROLLER_LOCATION,
  PRIVACY_CONTROLLER_NAME,
  PRIVACY_POLICY_VERSION,
  PRIVACY_UPDATED_AT
} from '@/lib/privacy';

export {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_CONTROLLER_LOCATION,
  PRIVACY_CONTROLLER_NAME,
  PRIVACY_POLICY_VERSION,
  PRIVACY_UPDATED_AT
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-2">{children}</div>
  </section>
);

/** Texto da política (usado no modal de configurações e na página pública /privacidade) */
export const PrivacyContent: React.FC = () => (
  <div className="space-y-5">
    <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
      Última atualização: {PRIVACY_UPDATED_AT}
    </p>

    <Section title="1. Resumo e Controlador">
      <p>
        O MONO // HABITS é um rastreador de hábitos que funciona primeiro no seu dispositivo. Não
        há anúncios e não vendemos nem compartilhamos seus dados comerciais. Estatísticas anônimas de uso e
        avisos do app por push existem, mas são opcionais e começam desligados: só funcionam se você ligar
        em Configurações.
      </p>
      <p>
        <strong>Controlador dos dados (LGPD, art. 9º, III):</strong> {PRIVACY_CONTROLLER_NAME} ({PRIVACY_CONTROLLER_LOCATION}) — contato:{' '}
        <a
          href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          className="underline text-zinc-950 dark:text-zinc-50"
        >
          {PRIVACY_CONTACT_EMAIL}
        </a>
        .
      </p>
    </Section>

    <Section title="2. Quais dados tratamos">
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>Conteúdo que você cria:</strong> nomes, descrições opcionais, imagens de capa (padrões geométricos ou uma foto que você escolher no aparelho, reduzida e guardada dentro do próprio hábito; ela fica no seu aparelho e, se você entrar com a conta Google, na sua conta, sem serviço de armazenamento de arquivos separado), categorias, ícones e frequência dos
          hábitos, metas diárias com o Pomo, check-ins diários, dias de graça usados, escorregões registrados em hábitos a evitar e sessões do Pomo (com o hábito
          vinculado, quando houver). Nomes de hábitos podem revelar informações
          sensíveis (por exemplo, de saúde); evite incluir dados que você não queira armazenar.
        </li>
        <li>
          <strong>Preferências:</strong> tema, acessibilidade, notificações e durações do Pomo.
        </li>
        <li>
          <strong>Bloqueio do app (opcional):</strong> se você ativar, guardamos neste aparelho apenas o hash
          do seu PIN (PBKDF2 com sal), o tempo de bloqueio e, se usar biometria, o identificador da credencial
          WebAuthn. O PIN em si e dados biométricos nunca são guardados nem enviados; nada disso vai para a
          nuvem nem para a exportação.
        </li>
        <li>
          <strong>Conta Google (opcional, somente se você conectar):</strong> o app não cria conta nem identificador anônimo automaticamente. Se você optar por entrar com o Google, tratamos o identificador único da sua conta (UID), seu nome, e-mail e foto de
          perfil para identificar sua conta nas configurações e sincronizar seus hábitos na nuvem.
        </li>
        <li>
          <strong>Verificação de atualização no Android:</strong> somente no aplicativo instalado no Android (APK), o app consulta a API pública de lançamentos do GitHub ao abrir e ao voltar ao primeiro plano (no máximo uma vez a cada 6 horas, ou quando você toca em &ldquo;Verificar atualizações&rdquo;). Essa consulta envia apenas seu endereço IP e o cabeçalho técnico do aplicativo (User-Agent) ao GitHub, sem qualquer dado de hábitos ou de conta.
        </li>
        <li>
          <strong>Estatísticas de uso anônimas (opcional, desligadas por padrão):</strong> se você ligar em Configurações, o app usa o Google Analytics para Firebase (apenas no navegador, não no app Android) para contar usos como a aba aberta, hábitos criados (só o tipo), sessões do Pomo concluídas, imagens compartilhadas e uso do modo discreto. Nunca enviamos nomes de hábitos, descrições, notas, e-mail ou dados da conta. A Google pode tratar identificadores técnicos do aplicativo, dados do dispositivo e localização aproximada derivada do IP. Respeitamos o "Não rastrear" do navegador, e desligar a opção interrompe a coleta.
        </li>
        <li>
          <strong>Avisos do app por push (opcional, desligados por padrão):</strong> se você ligar em Configurações e permitir as notificações no navegador ou no aparelho, registramos este aparelho no Firebase Cloud Messaging (Google), que gera um identificador (token) para entregar mensagens ocasionais, como novas versões e funções. Não guardamos esse token em nossos servidores nem o associamos à sua conta. Desligar a opção cancela o registro.
        </li>
      </ul>
    </Section>

    <Section title="3. Onde os dados ficam">
      <p>
        <strong>No seu dispositivo:</strong> tudo é salvo no armazenamento local do navegador ou WebView
        (localStorage e IndexedDB). Sem uma Conta Google conectada, seus hábitos e registros não saem do seu aparelho.
      </p>
      <p>
        <strong>Na nuvem (opcional):</strong> quando você entra com sua Conta Google, seus hábitos, check-ins,
        dias de graça, escorregões e sessões do Pomo são sincronizados com o Google Firebase (Authentication e Cloud
        Firestore), operado pela Google LLC. As regras de segurança restringem a leitura e a escrita exclusivamente à sua conta e validam o formato e o tamanho dos documentos.
      </p>
      <p>
        <strong>Fontes (na web):</strong> as fontes Inter e JetBrains Mono são carregadas do Google Fonts,
        o que expõe seu endereço IP e User-Agent ao Google ao abrir o app.
      </p>
    </Section>

    <Section title="4. Para que usamos">
      <p>
        Exclusivamente para operar o app: exibir seus hábitos e estatísticas, sincronizar entre
        dispositivos quando você conecta sua Conta Google, avisar sobre novas versões no Android e disparar os lembretes que você ativar. Se você ligar, também para entender o uso do app de forma agregada e anônima e enviar avisos ocasionais por push. Base legal: execução do serviço que
        você solicitou e seu consentimento (LGPD, art. 7º, I e V).
      </p>
    </Section>

    <Section title="5. Notificações agendadas localmente">
      <p>
        Os lembretes diários e o aviso de fim do Pomo são gerados e agendados localmente no próprio dispositivo, sem servidor de push: na web, pelo navegador e Service Worker enquanto o app estiver aberto ou instalado; no Android, pelo agendador de notificações locais do sistema para os próximos 7 dias (funcionando mesmo com o app fechado). Eles
        mostram apenas a quantidade de hábitos pendentes (e a taxa da semana no domingo, se ativada), nunca os nomes dos hábitos. Você pode desativá-los
        a qualquer momento em Configurações ou nas permissões do sistema/navegador.
      </p>
    </Section>

    <Section title="6. Compartilhamento e transferência internacional">
      <p>
        Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins publicitários. Contamos apenas com operadores de infraestrutura estritamente necessários:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>Google LLC (Firebase e Google Fonts):</strong> autenticação Google, banco de dados em nuvem (quando você conecta sua conta), entrega de fontes e, somente se você ligar, estatísticas de uso (Google Analytics para Firebase) e avisos por push (Firebase Cloud Messaging).
        </li>
        <li>
          <strong>GitHub, Inc.:</strong> hospedagem e consulta de novas versões do APK no Android (recebe apenas IP e User-Agent a cada verificação).
        </li>
      </ul>
      <p>
        <strong>Transferência internacional (LGPD, art. 33):</strong> os servidores da Google LLC e da GitHub, Inc. podem estar localizados fora do Brasil, principalmente nos Estados Unidos, operando sob padrões internacionais de segurança e proteção de dados.
      </p>
    </Section>

    <Section title="7. Retenção e exclusão">
      <p>
        Mantemos seus dados enquanto você usar o app. Em Configurações &gt; Dados e privacidade
        você pode exportar tudo em JSON, apagar os dados deste dispositivo e excluir sua conta,
        o que remove definitivamente os dados da nuvem e o seu acesso.
      </p>
      <p>
        Ao sair de uma Conta Google ou ao apagar os dados deste dispositivo, a sessão local (IndexedDB) e os dados salvos no aparelho (localStorage) são encerrados e removidos; os dados já sincronizados continuam na nuvem até você excluir a conta.
      </p>
    </Section>

    <Section title="8. Seus direitos (LGPD)">
      <p>
        Você pode confirmar a existência de tratamento, acessar, corrigir, exportar, anonimizar ou
        eliminar seus dados, obter informações sobre o compartilhamento e revogar o consentimento (LGPD, art. 18). A maior parte disso é feita diretamente no
        app; para qualquer outro pedido, entre em contato com o controlador pelo e-mail abaixo.
      </p>
    </Section>

    <Section title="9. Crianças">
      <p>O app não é direcionado a menores de 13 anos e não coleta intencionalmente dados deles.</p>
    </Section>

    <Section title="10. Segurança">
      <p>
        A comunicação usa HTTPS e o acesso à nuvem é restrito por autenticação e regras do
        Firestore. Nenhum sistema é totalmente imune a falhas; por isso, recomendamos exportar
        seus dados periodicamente.
      </p>
      <p>
        <strong>Sobre o bloqueio por PIN ou biometria:</strong> é uma trava de interface, não uma
        criptografia. Ele impede que outra pessoa use o app aberto neste aparelho, mas os dados que ficam
        no armazenamento local (localStorage) <strong>não são criptografados</strong>: quem tiver
        acesso técnico ao navegador ou ao aparelho desbloqueado pode lê-los. O PIN não pode ser recuperado; se você
        esquecer e usar a opção &ldquo;Esqueci o PIN&rdquo; para apagar os dados deste dispositivo, o app encerra sua sessão conectada, limpa o armazenamento local (incluindo o PIN e o banco IndexedDB) e recarrega. Se seus hábitos estavam sincronizados na nuvem, será necessário fazer login novamente com a sua Conta Google para restaurá-los.
      </p>
    </Section>

    <Section title="11. Alterações e contato">
      <p>
        Esta política pode ser atualizada; a data no topo indica a versão vigente. Dúvidas ou
        pedidos sobre seus dados podem ser enviados ao controlador ({PRIVACY_CONTROLLER_NAME}) em:{' '}
        <a
          href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          className="underline text-zinc-950 dark:text-zinc-50"
        >
          {PRIVACY_CONTACT_EMAIL}
        </a>
        .
      </p>
    </Section>
  </div>
);

/** Página pública em /privacidade */
export const PrivacyPolicy: React.FC = () => {
  // Fora dos providers do app: aplica o tema salvo manualmente
  useEffect(() => {
    document.documentElement.classList.toggle('dark', getStoredTheme());
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA] font-sans">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <a
          href="/"
          className="inline-flex items-center gap-2 min-h-[44px] text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao app
        </a>
        <h1 className="text-xl font-semibold tracking-tight">Política de Privacidade</h1>
        <PrivacyContent />
      </main>
    </div>
  );
};
