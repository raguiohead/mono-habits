import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { DEFAULT_HABITS } from '../../src/lib/storage';
import { fallbackCover, sanitizeHabitCover } from '../../src/lib/covers';
import { sanitizeHabitDescription } from '../../src/lib/habitDescription';
import { normalizePomoGoal } from '../../src/lib/pomoGoals';
import { applyWeeklyTargetChange } from '../../src/lib/weekly';
import { type Habit, type PomoSession } from '../../src/types/habit';

const PROJECT_ID = 'demo-mono-habits';
const APP_ID = 'mono-habit-tracker';
const OWNER_UID = 'user-owner-1';
const OTHER_UID = 'user-other-2';

// 1x1 PNG transparente válido em base64
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let testEnv: RulesTestEnvironment;

const userDocPath = (uid: string, appId = APP_ID) => `artifacts/${appId}/users/${uid}`;
const subDocPath = (uid: string, col: string, id: string, appId = APP_ID) =>
  `artifacts/${appId}/users/${uid}/${col}/${id}`;

describe('A2 — Regras de Segurança do Firestore (firestore.rules)', () => {
  beforeAll(async () => {
    setLogLevel('error');
    const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules }
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('permite ao dono criar, ler, atualizar (inclusive legado com merge) e excluir hábitos reais com todos os campos opcionais', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    // 1. Hábitos padrão do app (DEFAULT_HABITS)
    for (const h of DEFAULT_HABITS) {
      const ref = doc(db, subDocPath(OWNER_UID, 'habits', h.id));
      await assertSucceeds(setDoc(ref, h));
      await assertSucceeds(getDoc(ref));
    }

    // 2. Hábito completo com descrição, capa padrão, destaque, período, meta Pomo e meta semanal
    const weeklyFields = applyWeeklyTargetChange(undefined, 4, new Date('2026-10-19T12:00:00Z'));
    const richHabit: Habit = {
      id: 'habit-rich',
      title: 'Estudo aprofundado',
      category: 'Intelecto',
      icon: 'book',
      hideTitle: true,
      description: sanitizeHabitDescription('Ler capítulos técnicos com anotações'),
      cover: fallbackCover('habit-rich'),
      featured: true,
      period: 'morning',
      pomoGoal: normalizePomoGoal({ type: 'minutes', target: 45 }),
      ...weeklyFields,
      frequency: [1, 2, 3, 4, 5],
      archived: false,
      createdAt: 1760000000000
    };
    const richRef = doc(db, subDocPath(OWNER_UID, 'habits', richHabit.id));
    await assertSucceeds(setDoc(richRef, richHabit));

    // 3. Hábito com capa de imagem em dataUrl e enquadramento (x, y, zoom) + meta Pomo em sessões
    const imageCover = sanitizeHabitCover({
      type: 'image',
      dataUrl: TINY_PNG_DATA_URL,
      x: 0.4,
      y: 0.6,
      zoom: 1.5
    });
    const imageHabit: Habit = {
      id: 'habit-img',
      title: 'Corrida',
      category: 'Saúde',
      icon: 'activity',
      cover: imageCover,
      period: 'afternoon',
      pomoGoal: normalizePomoGoal({ type: 'sessions', target: 2 }),
      frequency: [0, 2, 4, 6],
      createdAt: 1760000001000
    };
    await assertSucceeds(setDoc(doc(db, subDocPath(OWNER_UID, 'habits', imageHabit.id)), imageHabit));

    // 4. Hábito a evitar (kind = 'avoid')
    const avoidHabit: Habit = {
      id: 'habit-avoid',
      title: 'Redes sociais à noite',
      category: 'Mente',
      icon: 'zap',
      kind: 'avoid',
      period: 'evening',
      frequency: [0, 1, 2, 3, 4, 5, 6],
      archived: false,
      createdAt: 1760000002000
    };
    const avoidRef = doc(db, subDocPath(OWNER_UID, 'habits', avoidHabit.id));
    await assertSucceeds(setDoc(avoidRef, avoidHabit));

    // 5. Documento legado (sem period, hideTitle, archived) atualizado com merge e exclusão
    const legacyRef = doc(db, subDocPath(OWNER_UID, 'habits', 'habit-legacy'));
    await assertSucceeds(
      setDoc(legacyRef, {
        id: 'habit-legacy',
        title: 'Hábito antigo',
        category: 'Geral',
        icon: 'target',
        frequency: [1, 3, 5],
        createdAt: 1700000000000
      })
    );
    await assertSucceeds(setDoc(legacyRef, { archived: true, hideTitle: true }, { merge: true }));
    await assertSucceeds(deleteDoc(legacyRef));
  });

  it('permite ao dono criar, ler, atualizar e excluir logs, graces, slips e pomoSessions reais (e deletar doc raiz do usuário)', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const dateKey = '2026-10-19';

    // Logs (com lista preenchida, lista vazia ao desmarcar e legado sem updatedAt atualizado com merge)
    const logRef = doc(db, subDocPath(OWNER_UID, 'logs', dateKey));
    await assertSucceeds(
      setDoc(logRef, {
        date: dateKey,
        completedHabitIds: ['habit-1', 'habit-2'],
        updatedAt: Date.now()
      })
    );
    await assertSucceeds(setDoc(logRef, { date: dateKey, completedHabitIds: [], updatedAt: Date.now() }));
    await assertSucceeds(getDoc(logRef));

    const legacyLogRef = doc(db, subDocPath(OWNER_UID, 'logs', '2026-10-10'));
    await assertSucceeds(setDoc(legacyLogRef, { date: '2026-10-10', completedHabitIds: ['habit-1'] }));
    await assertSucceeds(setDoc(legacyLogRef, { updatedAt: Date.now() }, { merge: true }));

    // Graces
    const graceRef = doc(db, subDocPath(OWNER_UID, 'graces', dateKey));
    await assertSucceeds(
      setDoc(graceRef, {
        date: dateKey,
        habitIds: ['habit-1'],
        updatedAt: Date.now()
      })
    );
    await assertSucceeds(getDoc(graceRef));
    await assertSucceeds(deleteDoc(graceRef));

    // Slips
    const slipRef = doc(db, subDocPath(OWNER_UID, 'slips', dateKey));
    await assertSucceeds(
      setDoc(slipRef, {
        date: dateKey,
        habitIds: ['habit-avoid'],
        updatedAt: Date.now()
      })
    );
    await assertSucceeds(getDoc(slipRef));
    await assertSucceeds(deleteDoc(slipRef));

    // PomoSessions (com e sem habitId)
    const focusSession: PomoSession = {
      id: 'pomo-1760000000000',
      kind: 'focus',
      startedAt: 1760000000000,
      endedAt: 1760001500000,
      plannedSeconds: 1500,
      actualSeconds: 1500,
      completed: true,
      habitId: 'habit-1'
    };
    const breakSession: PomoSession = {
      id: 'pomo-1760002000000',
      kind: 'short',
      startedAt: 1760002000000,
      endedAt: 1760002180000,
      plannedSeconds: 300,
      actualSeconds: 180,
      completed: false
    };
    const focusRef = doc(db, subDocPath(OWNER_UID, 'pomoSessions', focusSession.id));
    const breakRef = doc(db, subDocPath(OWNER_UID, 'pomoSessions', breakSession.id));
    await assertSucceeds(setDoc(focusRef, focusSession));
    await assertSucceeds(setDoc(breakRef, breakSession));
    await assertSucceeds(getDoc(focusRef));
    await assertSucceeds(deleteDoc(breakRef));

    // Deleção do documento raiz do usuário (usada no batch de deleteAllCloudData)
    await assertSucceeds(deleteDoc(doc(db, userDocPath(OWNER_UID))));
  });

  it('nega leitura, criação, atualização e exclusão por outro uid autenticado ou cliente não autenticado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'habits', 'habit-1')), DEFAULT_HABITS[0]);
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'logs', '2026-10-19')), {
        date: '2026-10-19',
        completedHabitIds: ['habit-1'],
        updatedAt: 1000
      });
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'graces', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: ['habit-1'],
        updatedAt: 1000
      });
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'slips', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: ['habit-1'],
        updatedAt: 1000
      });
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'pomoSessions', 'pomo-1')), {
        id: 'pomo-1',
        kind: 'focus',
        startedAt: 1000,
        endedAt: 2000,
        plannedSeconds: 1500,
        actualSeconds: 1500,
        completed: true
      });
    });

    const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    for (const clientDb of [otherDb, unauthDb]) {
      await assertFails(getDoc(doc(clientDb, subDocPath(OWNER_UID, 'habits', 'habit-1'))));
      await assertFails(setDoc(doc(clientDb, subDocPath(OWNER_UID, 'habits', 'habit-2')), DEFAULT_HABITS[1]));
      await assertFails(updateDoc(doc(clientDb, subDocPath(OWNER_UID, 'habits', 'habit-1')), { title: 'Invasão' }));
      await assertFails(deleteDoc(doc(clientDb, subDocPath(OWNER_UID, 'habits', 'habit-1'))));

      await assertFails(getDoc(doc(clientDb, subDocPath(OWNER_UID, 'logs', '2026-10-19'))));
      await assertFails(getDoc(doc(clientDb, subDocPath(OWNER_UID, 'graces', '2026-10-19'))));
      await assertFails(getDoc(doc(clientDb, subDocPath(OWNER_UID, 'slips', '2026-10-19'))));
      await assertFails(getDoc(doc(clientDb, subDocPath(OWNER_UID, 'pomoSessions', 'pomo-1'))));
      await assertFails(deleteDoc(doc(clientDb, userDocPath(OWNER_UID))));
    }
  });

  it('nega campos extras (hasOnly) em qualquer subcoleção ou mapa aninhado', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        extraField: 'nao-permitido'
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        cover: { type: 'pattern', pattern: 'dots', tone: 'mid', extra: 1 }
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'logs', '2026-10-19')), {
        date: '2026-10-19',
        completedHabitIds: ['habit-1'],
        updatedAt: 1000,
        hacked: true
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'graces', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: ['habit-1'],
        extra: 'x'
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'slips', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: ['habit-1'],
        extra: 'x'
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'pomoSessions', 'pomo-1')), {
        id: 'pomo-1',
        kind: 'focus',
        startedAt: 1000,
        endedAt: 2000,
        plannedSeconds: 1500,
        actualSeconds: 1500,
        completed: true,
        bonus: 999
      })
    );
  });

  it('nega tipos errados e valores fora do domínio esperado', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    // frequency como string em vez de lista
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        frequency: 'invalido'
      })
    );
    // id divergente do habitId do caminho
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-outro-id')), DEFAULT_HABITS[0])
    );
    // period inválido
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        period: 'dawn'
      })
    );
    // completedHabitIds não-lista
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'logs', '2026-10-19')), {
        date: '2026-10-19',
        completedHabitIds: 'habit-1'
      })
    );
    // dateKey malformada
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'logs', '2026-10-9')), {
        date: '2026-10-9',
        completedHabitIds: []
      })
    );
    // pomoSession com endedAt < startedAt
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'pomoSessions', 'pomo-1')), {
        id: 'pomo-1',
        kind: 'focus',
        startedAt: 5000,
        endedAt: 1000,
        plannedSeconds: 1500,
        actualSeconds: 1500,
        completed: true
      })
    );
  });

  it('nega strings e listas acima dos limites de tamanho', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    // title > 120 chars
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        title: 'a'.repeat(121)
      })
    );
    // description > 140 chars
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        description: 'd'.repeat(141)
      })
    );
    // cover.dataUrl > 130000 chars
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        cover: {
          type: 'image',
          dataUrl: `data:image/jpeg;base64,${'A'.repeat(130000)}`
        }
      })
    );
    // frequency > 7 itens
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        frequency: [0, 1, 2, 3, 4, 5, 6, 7]
      })
    );
    // completedHabitIds > 200 itens
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'logs', '2026-10-19')), {
        date: '2026-10-19',
        completedHabitIds: Array.from({ length: 201 }, (_, i) => `h-${i}`)
      })
    );
    // graces e slips habitIds > 200 itens
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'graces', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: Array.from({ length: 201 }, (_, i) => `h-${i}`)
      })
    );
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'slips', '2026-10-19')), {
        date: '2026-10-19',
        habitIds: Array.from({ length: 201 }, (_, i) => `h-${i}`)
      })
    );
    // weeklyTargets > 20 itens
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1')), {
        ...DEFAULT_HABITS[0],
        weeklyTargets: Array.from({ length: 21 }, (_, i) => ({
          from: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
          target: 3
        }))
      })
    );
  });

  it('cobre casos (a)-(e): cover ~120k chars, remoção do último check-in/perdão/recaída, setDoc merge + updateDoc, weeklyTargets e documentos legados', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    // (a) Hábito com cover image de ~120 mil caracteres de dataUrl válido (limite COVER_MAX_BYTES = 90 KB -> ~122.880 chars base64)
    const largeBase64Payload = 'QUJD'.repeat(30000); // 120.000 chars base64 múltiplos de 4
    const largeDataUrl = `data:image/jpeg;base64,${largeBase64Payload}`;
    const largeCover = sanitizeHabitCover({
      type: 'image',
      dataUrl: largeDataUrl,
      x: 0.5,
      y: 0.5,
      zoom: 1.2
    });
    const largeCoverHabit: Habit = {
      ...DEFAULT_HABITS[0],
      id: 'habit-cover-120k',
      cover: largeCover
    };
    await assertSucceeds(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', largeCoverHabit.id)), largeCoverHabit)
    );

    // (b) Fluxo REAL de remover o último check-in, último perdão e última recaída de um dia:
    // - toggleHabitCompletion grava completedHabitIds: [] com setDoc quando o último check-in é desmarcado
    // - persistGraces e persistSlips chamam deleteDoc quando rest.length === 0 (e a regra também aceita habitIds: [] por segurança)
    const dayKey = '2026-10-18';
    const logRef = doc(db, subDocPath(OWNER_UID, 'logs', dayKey));
    await assertSucceeds(setDoc(logRef, { date: dayKey, completedHabitIds: ['1'], updatedAt: 1000 }));
    await assertSucceeds(setDoc(logRef, { date: dayKey, completedHabitIds: [], updatedAt: 2000 }));

    const graceRef = doc(db, subDocPath(OWNER_UID, 'graces', dayKey));
    await assertSucceeds(setDoc(graceRef, { date: dayKey, habitIds: ['1'], updatedAt: 1000 }));
    await assertSucceeds(deleteDoc(graceRef));
    await assertSucceeds(setDoc(graceRef, { date: dayKey, habitIds: [], updatedAt: 2000 }));

    const slipRef = doc(db, subDocPath(OWNER_UID, 'slips', dayKey));
    await assertSucceeds(setDoc(slipRef, { date: dayKey, habitIds: ['1'], updatedAt: 1000 }));
    await assertSucceeds(deleteDoc(slipRef));
    await assertSucceeds(setDoc(slipRef, { date: dayKey, habitIds: [], updatedAt: 2000 }));

    // (c) Updates com setDoc(..., { merge: true }), updateDoc(...) e setDoc completo (como toggleHideTitle/toggleArchiveHabit/saveHabit fazem)
    const updateRef = doc(db, subDocPath(OWNER_UID, 'habits', 'habit-update-flow'));
    await assertSucceeds(setDoc(updateRef, { ...DEFAULT_HABITS[0], id: 'habit-update-flow' }));
    await assertSucceeds(updateDoc(updateRef, { title: 'Título atualizado via updateDoc', hideTitle: true }));
    await assertSucceeds(setDoc(updateRef, { archived: true, featured: true }, { merge: true }));
    await assertFails(updateDoc(updateRef, { campoInvalido: 123 }));
    await assertFails(setDoc(updateRef, { period: 'invalid-period' }, { merge: true }));
    await assertFails(updateDoc(updateRef, { createdAt: 999 }));
    await assertFails(setDoc(updateRef, { createdAt: 999 }, { merge: true }));

    // (d) weeklyTargets: transição de meta semanal -> mudança de meta -> volta para dias fixos (sem weeklyTargets) e lista vazia
    const w1 = applyWeeklyTargetChange(undefined, 3, new Date('2026-10-01T12:00:00Z'));
    const habitWeekly1: Habit = {
      ...DEFAULT_HABITS[0],
      id: 'habit-weekly',
      ...w1
    };
    const weeklyRef = doc(db, subDocPath(OWNER_UID, 'habits', 'habit-weekly'));
    await assertSucceeds(setDoc(weeklyRef, habitWeekly1));

    const w2 = applyWeeklyTargetChange(habitWeekly1, 5, new Date('2026-10-15T12:00:00Z'));
    await assertSucceeds(setDoc(weeklyRef, { ...habitWeekly1, ...w2 }));

    // Volta para modo de dias fixos (applyWeeklyTargetChange(habit, undefined) retorna {}, saveHabit sobrescreve sem weeklyTarget*)
    const wFixed = applyWeeklyTargetChange({ ...habitWeekly1, ...w2 }, undefined, new Date('2026-10-19T12:00:00Z'));
    const { weeklyTarget: _wt, weeklyTargetFrom: _wtf, weeklyTargets: _wts, ...baseHabit } = habitWeekly1;
    await assertSucceeds(setDoc(weeklyRef, { ...baseHabit, ...wFixed }));
    // Também aceita weeklyTargets: [] caso algum documento legado tenha array vazio
    await assertSucceeds(setDoc(weeklyRef, { ...baseHabit, weeklyTargets: [] }));

    // (e) Documentos antigos com formato legado (commit inicial sem period/hideTitle/archived; hábito semanal pré-histórico só com weeklyTarget sem weeklyTargets)
    const legacyV1Ref = doc(db, subDocPath(OWNER_UID, 'habits', 'habit-legacy-v1'));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, subDocPath(OWNER_UID, 'habits', 'habit-legacy-v1')), {
        id: 'habit-legacy-v1',
        title: 'Hábito v1',
        category: 'Saúde',
        icon: 'heart',
        frequency: [1, 2, 3],
        weeklyTarget: 3,
        createdAt: 1700000000000
      });
    });
    // Próxima atualização pelo app (ex.: toggleHideTitle / toggleArchiveHabit) sucede sem rejeição
    await assertSucceeds(updateDoc(legacyV1Ref, { hideTitle: true }));
    await assertSucceeds(updateDoc(legacyV1Ref, { archived: true }));
  });

  it('impede alteração do campo createdAt na atualização de hábitos (FSR-02)', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const habitRef = doc(db, subDocPath(OWNER_UID, 'habits', 'habit-created-at-check'));
    const initialHabit: Habit = {
      ...DEFAULT_HABITS[0],
      id: 'habit-created-at-check',
      createdAt: 1760000000000
    };

    // Criação com createdAt válido sucede
    await assertSucceeds(setDoc(habitRef, initialHabit));

    // Atualização mantendo o createdAt original sucede (via updateDoc e setDoc com merge ou objeto completo)
    await assertSucceeds(updateDoc(habitRef, { title: 'Título atualizado' }));
    await assertSucceeds(setDoc(habitRef, { ...initialHabit, title: 'Outro título' }));
    await assertSucceeds(setDoc(habitRef, { title: 'Merge com mesmo createdAt', createdAt: initialHabit.createdAt }, { merge: true }));

    // Tentativa de alterar createdAt é estritamente rejeitada
    await assertFails(updateDoc(habitRef, { createdAt: 1760000999999 }));
    await assertFails(setDoc(habitRef, { ...initialHabit, createdAt: 1760000999999 }));
    await assertFails(setDoc(habitRef, { createdAt: 1760000999999 }, { merge: true }));
  });

  it('nega coleções desconhecidas, escrita direta no doc do usuário e appId diferente de mono-habit-tracker', async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();

    // Coleção desconhecida dentro do usuário
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'arbitraryCollection', 'doc-1')), {
        qualquer: 'coisa'
      })
    );
    // Escrita direta no documento raiz do usuário
    await assertFails(
      setDoc(doc(db, userDocPath(OWNER_UID)), {
        role: 'admin'
      })
    );
    // Outro appId
    await assertFails(
      setDoc(doc(db, subDocPath(OWNER_UID, 'habits', 'habit-1', 'outro-app-id')), DEFAULT_HABITS[0])
    );
    // Caminho fora de /artifacts/mono-habit-tracker
    await assertFails(setDoc(doc(db, `users/${OWNER_UID}`), { name: 'Teste' }));
  });
});
