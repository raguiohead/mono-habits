import { clearTasksToken } from './googleTasksAuth';

export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  completed?: string; // ISO 8601 string
  deleted?: boolean;
  hidden?: boolean;
  updated: string; // ISO 8601 string
}

const BASE_URL = 'https://tasks.googleapis.com/tasks/v1';

async function tasksFetch(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearTasksToken();
    throw new Error('Sessão do Google Tasks expirada. Reconecte sua conta.');
  }

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Erro na API do Google Tasks (${response.status}): ${errorText}`);
  }

  return response;
}

/**
 * Lista todas as listas de tarefas do usuário.
 */
export async function listTaskLists(accessToken: string): Promise<GoogleTaskList[]> {
  const resp = await tasksFetch(accessToken, '/users/@me/lists');
  const data = (await resp.json()) as { items?: GoogleTaskList[] };
  return data.items || [];
}

/**
 * Lista as tarefas de uma lista do Google Tasks, incluindo deletadas e concluídas.
 */
export async function listTasks(
  accessToken: string,
  listId: string,
  opts?: {
    updatedMin?: string;
    showDeleted?: boolean;
    showHidden?: boolean;
  }
): Promise<GoogleTaskItem[]> {
  const params = new URLSearchParams();
  params.set('showDeleted', String(opts?.showDeleted ?? true));
  params.set('showHidden', String(opts?.showHidden ?? true));
  if (opts?.updatedMin) {
    params.set('updatedMin', opts.updatedMin);
  }

  const allItems: GoogleTaskItem[] = [];
  let pageToken: string | undefined = undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);
    const resp = await tasksFetch(accessToken, `/lists/${encodeURIComponent(listId)}/tasks?${params.toString()}`);
    const data = (await resp.json()) as { items?: GoogleTaskItem[]; nextPageToken?: string };
    if (data.items) {
      allItems.push(...data.items);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

/**
 * Cria uma nova tarefa na lista do Google Tasks.
 */
export async function insertTask(
  accessToken: string,
  listId: string,
  task: {
    title: string;
    notes?: string;
    status?: 'needsAction' | 'completed';
    completed?: string;
  }
): Promise<GoogleTaskItem> {
  const resp = await tasksFetch(accessToken, `/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });
  return (await resp.json()) as GoogleTaskItem;
}

/**
 * Atualiza campos parciais de uma tarefa no Google Tasks.
 */
export async function patchTask(
  accessToken: string,
  listId: string,
  taskId: string,
  task: {
    title?: string;
    notes?: string | null;
    status?: 'needsAction' | 'completed';
    completed?: string | null;
  }
): Promise<GoogleTaskItem> {
  const resp = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(task)
    }
  );
  return (await resp.json()) as GoogleTaskItem;
}

/**
 * Remove permanentemente ou marca como excluída uma tarefa no Google Tasks.
 */
export async function deleteTask(
  accessToken: string,
  listId: string,
  taskId: string
): Promise<void> {
  const resp = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'DELETE'
    }
  );

  // 404 significa que já foi excluída, o que é aceitável
  if (resp.status !== 204 && resp.status !== 404 && !resp.ok) {
    throw new Error(`Falha ao excluir tarefa no Google Tasks: ${resp.status}`);
  }
}
