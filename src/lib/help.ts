export type HelpCategory = 'habitos' | 'pomo' | 'conta';

export const HELP_CATEGORIES: { id: HelpCategory; label: string }[] = [
  { id: 'habitos', label: 'Hábitos' },
  { id: 'pomo', label: 'Pomo' },
  { id: 'conta', label: 'Conta' }
];

export interface FaqItem {
  id: string;
  category: HelpCategory;
  question: string;
  answer: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export const FAQ: FaqItem[] = [
  {
    id: 'ofensiva',
    category: 'habitos',
    question: 'Como funciona a ofensiva?',
    answer:
      'É a quantidade de dias seguidos em que você concluiu o hábito. Dias em que o hábito não está na agenda não quebram nem somam, e o dia de hoje ainda pendente não quebra a sequência. A "melhor" guarda o seu recorde, mesmo depois de a ofensiva cair.'
  },
  {
    id: 'dia-de-graca',
    category: 'habitos',
    question: 'O que é o dia de graça?',
    answer:
      'Perdoa um dia sem quebrar a ofensiva. Ele não conta como concluído: só impede que a sequência volte a zero. Cada hábito tem um limite por mês, que você muda em Configurações > Ofensiva (0, 1 ou 2).'
  },
  {
    id: 'meta-semanal',
    category: 'habitos',
    question: 'Como criar um hábito "3x por semana"?',
    answer:
      'Ao criar ou editar o hábito, escolha "Meta semanal" em vez de dias fixos. A semana vai de segunda a domingo e a ofensiva passa a contar semanas cumpridas. Mudar a meta vale a partir da próxima semana.'
  },
  {
    id: 'evitar',
    category: 'habitos',
    question: 'Como funcionam os hábitos a evitar?',
    answer:
      'A lógica é invertida: o dia começa como "feito" e você só registra quando escorrega, com o botão "Escorreguei". A ofensiva conta os dias limpos. Se escorregar, amanhã recomeça.'
  },
  {
    id: 'periodos',
    category: 'habitos',
    question: 'Posso organizar os hábitos por manhã, tarde e noite?',
    answer:
      'Sim. No cadastro do hábito escolha o período. Quando algum hábito tem período, o Foco agrupa por manhã, tarde e noite e destaca o período atual.'
  },
  {
    id: 'discreto',
    category: 'habitos',
    question: 'Como esconder o nome de um hábito?',
    answer:
      'Toque no ícone de olho no cartão do hábito, ou ative "Modo Discreto" ao editá-lo. O nome fica oculto na tela e nas notificações, e só o ícone e a categoria aparecem. Para ocultar todos de uma vez, use o botão de olho no topo ou ligue o Modo discreto em Configurações (ele também pode ser automático por horário, como das 22:00 às 07:00).'
  },
  {
    id: 'destaque',
    category: 'habitos',
    question: 'Para que serve "Destacar (fixar no topo)"?',
    answer:
      'Até 2 hábitos podem ficar fixados no topo do Foco, com um alfinete. Em Configurações > Aparência você escolhe entre os layouts Lista, Bento (grade, com os destacados em largura total) e Capas (galeria).'
  },
  {
    id: 'marcos',
    category: 'habitos',
    question: 'O que são os números 7, 30, 100 e 365?',
    answer:
      'São marcos da sua melhor ofensiva. O maior que você já atingiu aparece no cartão do hábito, e a aba Hábitos mostra todos, preenchidos quando atingidos. Ao alcançar um novo, você recebe um aviso discreto.'
  },
  {
    id: 'pomo-como',
    category: 'pomo',
    question: 'Como funciona o Pomo?',
    answer:
      'É um temporizador de foco com pausas curtas e longas, em ciclos. Você ajusta os tempos, e cada sessão concluída fica registrada no histórico e nas suas estatísticas.'
  },
  {
    id: 'pomo-meta',
    category: 'pomo',
    question: 'O que é a meta do Pomo em um hábito?',
    answer:
      'O hábito só pode ser marcado depois que você cumprir o tempo ou o número de sessões definidos, feitos no Pomo vinculado a ele. Enquanto isso, o cartão mostra o progresso e o checkbox fica bloqueado.'
  },
  {
    id: 'conta-precisa',
    category: 'conta',
    question: 'Preciso de conta para usar?',
    answer:
      'Não. Tudo funciona no seu aparelho, sem conta. Conectar o Google é opcional e serve para fazer backup e sincronizar entre dispositivos.'
  },
  {
    id: 'lembrete',
    category: 'conta',
    question: 'Como funcionam os lembretes?',
    answer:
      'O lembrete diário é local, sem servidor, e não mostra nomes de hábitos. No app Android, os lembretes e o fim do Pomo são agendados no sistema e funcionam mesmo com o app fechado; na web, disparam enquanto o app está aberto ou instalado. Ative em Configurações > Notificações.'
  },
  {
    id: 'estatisticas',
    category: 'conta',
    question: 'O app coleta estatísticas ou envia avisos por push?',
    answer:
      'Só se você ligar, em Configurações: "Estatísticas de uso anônimas" (contagens como a aba aberta, sem nomes de hábitos, notas ou dados da conta) e "Novidades do app (push)". Os dois começam desligados e podem ser desligados quando quiser.'
  },
  {
    id: 'dados',
    category: 'conta',
    question: 'Como exporto ou apago meus dados?',
    answer:
      'Em Configurações > Dados e privacidade você exporta tudo em um arquivo, apaga os dados deste aparelho ou exclui a conta e os dados da nuvem.'
  },
  {
    id: 'bloqueio',
    category: 'conta',
    question: 'Posso proteger o app com PIN ou biometria?',
    answer:
      'Sim, em Configurações > Dados e privacidade. O bloqueio é local ao aparelho: se esquecer o PIN, apagar os dados deste aparelho remove o bloqueio.'
  },
  {
    id: 'atualizar-android',
    category: 'conta',
    question: 'Como atualizo o app no Android?',
    answer:
      'Quando sair uma nova versão, o app mostra um aviso ao abrir (ou toque em "Verificar atualizações" nas Configurações). Toque em "Baixar" para baixar o arquivo APK pelo navegador, abra o arquivo concluído e toque em "Instalar" (na primeira vez, permita instalar apps de fontes desconhecidas para o navegador). Seus hábitos e dados ficam preservados no aparelho e na conta.'
  },
  {
    id: 'android-app-nao-instalado',
    category: 'conta',
    question: 'Apareceu "App não instalado" ao atualizar para a 1.2.0. E agora?',
    answer:
      'A versão 1.2.0 passou a usar uma nova assinatura, mais segura, então quem tinha a 1.1.0 ou anterior precisa desinstalar o app uma única vez antes de instalar a nova. Antes de desinstalar, entre com a Conta Google nas Configurações para que seus hábitos fiquem salvos na nuvem: o que só existe no aparelho é apagado junto com o app. Depois de instalar a 1.2.0, entre com a mesma conta e tudo volta. As próximas atualizações instalam por cima normalmente.'
  }
];

export const GLOSSARY: GlossaryItem[] = [
  { term: 'Ofensiva', definition: 'Dias (ou semanas, nas metas semanais) seguidos de um hábito cumprido.' },
  { term: 'Melhor ofensiva', definition: 'O seu recorde de ofensiva para um hábito, mesmo que a atual tenha caído.' },
  { term: 'Dia de graça', definition: 'Perdoa um dia sem quebrar a ofensiva, com limite mensal por hábito.' },
  { term: 'Meta semanal', definition: 'Hábito de "X vezes por semana" (segunda a domingo), em vez de dias fixos.' },
  { term: 'Hábito a evitar', definition: 'Lógica invertida: o dia é "feito" até você registrar um escorregão.' },
  { term: 'Escorregão', definition: 'O registro de que você fez o que queria evitar naquele dia.' },
  { term: 'Marco', definition: 'Nível da melhor ofensiva: 7, 30, 100 e 365.' },
  { term: 'Modo Discreto', definition: 'Oculta o nome (e a descrição) dos hábitos: de um hábito, ou de todos, de forma manual ou automática por horário.' },
  { term: 'Destaque', definition: 'Hábito fixado no topo do Foco (até 2).' },
  { term: 'Meta do Pomo', definition: 'Tempo ou sessões de foco exigidos antes de poder marcar o hábito.' },
  { term: 'Local-first', definition: 'Seus dados ficam primeiro no aparelho; a nuvem é opcional.' }
];

/** Minúsculas e sem acentos, para a busca tolerar "ofensiva" / "Ofênsiva" etc. */
export const normalizeText = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Filtra por categoria (null = todas) e por texto (todas as palavras precisam aparecer) */
export function filterFaq(items: FaqItem[], query: string, category: HelpCategory | null): FaqItem[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  return items.filter((it) => {
    if (category && it.category !== category) return false;
    if (words.length === 0) return true;
    const hay = normalizeText(`${it.question} ${it.answer}`);
    return words.every((w) => hay.includes(w));
  });
}

export function filterGlossary(items: GlossaryItem[], query: string): GlossaryItem[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((it) => {
    const hay = normalizeText(`${it.term} ${it.definition}`);
    return words.every((w) => hay.includes(w));
  });
}
