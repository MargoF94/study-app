import { router } from './router.svelte';
import { store } from './store.svelte';
import { nowIso } from './util';

/** Opens one question in the study screen, with the exam's other questions before and after it. */
export async function openQuestion(examId: string, questionId: string, label = 'From links') {
  const ids = store.questionsOf(examId).map((q) => q.id);
  const index = ids.indexOf(questionId);
  if (index < 0) return;
  const now = nowIso();
  const old = store.sessions.get(examId);
  await store.saveSession({ id: examId, createdAt: old?.createdAt ?? now, updatedAt: now, ids, index, label });
  router.go(`/exam/${examId}/study`);
}
