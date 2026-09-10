'use client';

import { useEffect, useRef, useState } from 'react';

// Mirrored in flowyApp/src/hooks/useChatReveal.ts. Presentation only: never
// write this prefix into history or use it as the next request's context.
const FRAME_MS = 40;
const FINISH_MS = 1000;

export function nextRevealEnd(text: string, cursor: number, size: number): number {
  let end = Math.min(text.length, cursor + size);
  // Prefer whole words, with a bounded look-ahead for long URLs/CJK text.
  while (end < text.length && end < cursor + size + 32 && !/\s/u.test(text[end]!)) end++;
  if (end < text.length && /\s/u.test(text[end]!)) end++;
  // A source identifier must appear atomically, never as half a citation.
  const open = text.lastIndexOf('[[', end - 1);
  if (open >= 0 && text.indexOf(']]', open) >= end - 1) {
    const close = text.indexOf(']]', open);
    end = close < 0 ? open : close + 2;
  } else if (open >= 0 && text.indexOf(']]', open) < 0) end = open;
  // Do not split a UTF-16 surrogate pair, even in a long unbroken token.
  if (end > 0 && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end--;
  return Math.max(cursor, end);
}

type Options = { id: string; content: string; active: boolean; enabled: boolean; cancelled?: boolean };

export function useChatReveal({ id, content, active, enabled, cancelled = false }: Options) {
  const [visible, setVisible] = useState({ id, content });
  const state = useRef({ id, shown: content, target: content, active, eligible: active,
    deadline: 0, skipped: false, timer: null as ReturnType<typeof setTimeout> | null });

  useEffect(() => {
    const current = state.current;
    if (current.id !== id) {
      if (current.timer !== null) clearTimeout(current.timer);
      state.current = { id, shown: content, target: content, active, eligible: active, deadline: 0, skipped: false, timer: null };
      setVisible({ id, content });
    }
    const run = state.current;
    run.target = content;
    run.active = active;
    run.eligible ||= active;
    const showAll = () => {
      if (run.timer !== null) clearTimeout(run.timer);
      run.timer = null;
      run.shown = content;
      setVisible(previous => previous.id === id && previous.content === content ? previous : { id, content });
    };
    if (!enabled || cancelled || run.skipped || !run.eligible || !content.startsWith(run.shown)) {
      showAll();
      return;
    }
    if (active) run.deadline = 0;
    else if (!run.deadline) run.deadline = Date.now() + FINISH_MS;
    const tick = () => {
      if (state.current !== run) return;
      run.timer = null;
      const remaining = run.target.length - run.shown.length;
      const timeLeft = run.active ? FINISH_MS : run.deadline - Date.now();
      const size = Math.max(10, Math.ceil(remaining * FRAME_MS / Math.max(FRAME_MS, timeLeft)));
      const end = timeLeft <= FRAME_MS ? run.target.length : nextRevealEnd(run.target, run.shown.length, size);
      // Wait for another network chunk instead of polling an unfinished citation.
      if (end === run.shown.length && run.active) return;
      run.shown = run.target.slice(0, end);
      setVisible({ id, content: run.shown });
      if (run.shown.length < run.target.length) run.timer = setTimeout(tick, FRAME_MS);
    };
    if (run.shown !== content && run.timer === null) run.timer = setTimeout(tick, FRAME_MS);
  }, [id, content, active, enabled, cancelled]);

  useEffect(() => () => {
    if (state.current.timer !== null) clearTimeout(state.current.timer);
    state.current.timer = null;
  }, []);

  const finish = () => {
    const run = state.current;
    if (run.timer !== null) clearTimeout(run.timer);
    run.timer = null;
    run.skipped = true;
    run.shown = content;
    setVisible({ id, content });
  };
  const shown = visible.id !== id || !enabled || cancelled ? content : visible.content;
  return { content: shown, revealing: shown !== content, finish };
}
