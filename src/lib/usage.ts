/**
 * Estatísticas de uso anônimas (Firebase Analytics), só com consentimento do usuário.
 * Lista fechada de eventos e parâmetros: nunca texto livre, títulos de hábitos, notas ou dados de conta.
 */
type ParamSpec = readonly string[] | 'number';

const EVENTS = {
  screen_view: { tab: ['today', 'stats', 'pomo', 'manage'] },
  habit_created: { kind: ['build', 'avoid'] },
  pomo_completed: {},
  share_card: { type: ['grid', 'wrapped'] },
  discreet_toggle: { enabled: ['true', 'false'] }
} as const satisfies Record<string, Record<string, ParamSpec>>;

export type UsageEventName = keyof typeof EVENTS;

export const USAGE_EVENT_NAMES = Object.keys(EVENTS) as UsageEventName[];

export interface UsageEvent {
  name: UsageEventName;
  params: Record<string, string>;
}

/**
 * Valida um evento: nome fora da lista vira null; parâmetros fora da lista, ou com valor que não
 * esteja entre os permitidos, são descartados (o evento segue só com o que é seguro).
 */
export function sanitizeUsageEvent(name: string, params: Record<string, unknown> = {}): UsageEvent | null {
  if (!Object.prototype.hasOwnProperty.call(EVENTS, name)) return null;
  const spec = EVENTS[name as UsageEventName] as Record<string, ParamSpec>;
  const clean: Record<string, string> = {};
  for (const [key, allowed] of Object.entries(spec)) {
    const raw = params[key];
    const value = typeof raw === 'boolean' ? String(raw) : raw;
    if (typeof value === 'string' && Array.isArray(allowed) && (allowed as readonly string[]).includes(value)) {
      clean[key] = value;
    }
  }
  return { name: name as UsageEventName, params: clean };
}

/** "Não rastrear" do navegador é respeitado mesmo com a opção ligada */
export function isDoNotTrack(nav: { doNotTrack?: string | null } | undefined): boolean {
  return nav?.doNotTrack === '1' || nav?.doNotTrack === 'yes';
}
