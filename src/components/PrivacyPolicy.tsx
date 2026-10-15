import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getStoredTheme } from '@/lib/storage';

export const PRIVACY_UPDATED_AT = '15 de outubro de 2026';
export const PRIVACY_CONTACT_URL = 'https://github.com/raguiohead/mono-habits/issues';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-2">{children}</div>
  </section>
);

/** Texto da política (usado no modal de configurações e na página pública /privacidade) */
export const PrivacyContent: React.FC = () => (
  <div className="space-y-5">
    <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
      Última atualização: {PRIVACY_UPDATED_AT}
    </p>

    <Section title="1. Resumo">
      <p>
        O MONO // HABITS é um rastreador de hábitos que funciona primeiro no seu dispositivo. Não
        há anúncios, não vendemos nem compartilhamos seus dados e não usamos ferramentas de
        análise ou rastreamento de comportamento.
      </p>
    </Section>

    <Section title="2. Quais dados tratamos">
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <strong>Conteúdo que você cria:</strong> nomes, categorias, ícones e frequência dos
          hábitos, check-ins diários e sessões do Pomo. Nomes de hábitos podem revelar informações
          sensíveis (por exemplo, de saúde); evite incluir dados que você não queira armazenar.
        </li>
        <li>
          <strong>Preferências:</strong> tema, acessibilidade, notificações e durações do Pomo.
        </li>
        <li>
          <strong>Conta (somente se a nuvem estiver ativa):</strong> um identificador anônimo
          criado automaticamente e, se você entrar com o Google, seu nome, e-mail e foto de
          perfil, que usamos apenas para identificar sua conta na tela de configurações.
        </li>
      </ul>
    </Section>

    <Section title="3. Onde os dados ficam">
      <p>
        <strong>No seu dispositivo:</strong> tudo é salvo no armazenamento local do navegador
        (localStorage). Sem a nuvem ativa, nada sai do seu aparelho.
      </p>
      <p>
        <strong>Na nuvem:</strong> quando o recurso está disponível, seus hábitos, check-ins e
        sessões do Pomo são sincronizados com o Google Firebase (Authentication e Cloud
        Firestore), operado pelo Google. As regras de segurança permitem que apenas a sua conta
        leia e altere esses dados.
      </p>
      <p>
        <strong>Fontes:</strong> as fontes Inter e JetBrains Mono são carregadas do Google Fonts,
        o que expõe seu endereço IP ao Google ao abrir o app.
      </p>
    </Section>

    <Section title="4. Para que usamos">
      <p>
        Exclusivamente para operar o app: exibir seus hábitos e estatísticas, sincronizar entre
        dispositivos e enviar os lembretes que você ativar. Base legal: execução do serviço que
        você solicitou e seu consentimento (LGPD, art. 7º, I e V).
      </p>
    </Section>

    <Section title="5. Notificações">
      <p>
        Os lembretes são gerados no próprio dispositivo, com a permissão do navegador, e
        funcionam enquanto o app estiver aberto ou instalado e ativo em segundo plano. Eles
        mostram apenas a quantidade de hábitos pendentes, nunca seus nomes. Você pode desativá-los
        a qualquer momento em Configurações ou nas permissões do navegador.
      </p>
    </Section>

    <Section title="6. Compartilhamento">
      <p>
        Não vendemos, alugamos nem compartilhamos seus dados com terceiros, exceto com o Google
        (Firebase e Google Fonts), que atua como operador para fornecer a infraestrutura.
      </p>
    </Section>

    <Section title="7. Retenção e exclusão">
      <p>
        Mantemos seus dados enquanto você usar o app. Em Configurações &gt; Dados e privacidade
        você pode exportar tudo em JSON, apagar os dados deste dispositivo e excluir sua conta,
        o que remove definitivamente os dados da nuvem e o seu acesso.
      </p>
      <p>
        Ao sair de uma conta Google, os dados locais dessa conta são removidos do aparelho; eles
        continuam na nuvem até você excluir a conta.
      </p>
    </Section>

    <Section title="8. Seus direitos (LGPD)">
      <p>
        Você pode confirmar a existência de tratamento, acessar, corrigir, exportar, anonimizar ou
        eliminar seus dados e revogar o consentimento. A maior parte disso é feita diretamente no
        app; para qualquer outro pedido, entre em contato pelo canal abaixo.
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
    </Section>

    <Section title="11. Alterações e contato">
      <p>
        Esta política pode ser atualizada; a data no topo indica a versão vigente. Dúvidas ou
        pedidos sobre seus dados:{' '}
        <a
          href={PRIVACY_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-zinc-950 dark:text-zinc-50"
        >
          abra uma solicitação no repositório do projeto
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
