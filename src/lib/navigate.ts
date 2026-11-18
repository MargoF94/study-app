import { router } from './router.svelte';
import { store } from './store.svelte';

/** Opens one question in the study screen, with the exam's other questions before and after it. */
export async function openQuestion(examId: string, questionId: string, label = 'From links') {
  const ids = store.questionsOf(examId).map((q) => q.id);
  const index = ids.indexOf(questionId);
  if (index < 0) return;
  await store.startSession(examId, { ids, index, label });
  router.go(`/exam/${examId}/study`);
}
