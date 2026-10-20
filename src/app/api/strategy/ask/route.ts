/**
 * The strategy assistant's one endpoint. Takes a fixed question key (the page
 * offers buttons, never a text box), rebuilds today's checklist from the
 * cached features, and answers with Claude when configured, else the rules.
 */
import { NextResponse } from 'next/server';
import { loadStrategy } from '@/lib/strategy/load';
import { answer, isQuestion } from '@/lib/strategy/assistant';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const q = typeof body?.q === 'string' ? body.q : '';
  if (!isQuestion(q)) return NextResponse.json({ error: 'unknown question' }, { status: 400 });
  const state = await loadStrategy();
  const a = await answer(q, state);
  return NextResponse.json({ ...a, at: state.at });
}
