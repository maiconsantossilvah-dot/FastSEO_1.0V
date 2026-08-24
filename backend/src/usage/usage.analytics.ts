import type { UsageCallInput } from './usage.schema.js';

export interface StoredUsageEvent {
  uid: string;
  userEmail: string;
  userDisplayName: string;
  status: 'aprovado' | 'reprovado' | 'erro';
  durationMs: number;
  category: string;
  calls: UsageCallInput[];
  createdAt: Date;
  day?: string;
}

type TokenTotals = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

const emptyTokens = (): TokenTotals => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  thinkingTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
});

function addCall(target: TokenTotals, call: UsageCallInput) {
  target.requests += 1;
  target.inputTokens += call.inputTokens;
  target.outputTokens += call.outputTokens;
  target.thinkingTokens += call.thinkingTokens;
  target.cachedTokens += call.cachedTokens;
  target.totalTokens += call.totalTokens;
}

const average = (total: number, divisor: number) => divisor ? Math.round(total / divisor) : 0;
const rate = (part: number, total: number) => total ? Number(((part / total) * 100).toFixed(1)) : 0;

export function aggregateUsageEvents(events: StoredUsageEvent[]) {
  const totals = emptyTokens();
  let approved = 0;
  let rejected = 0;
  let errors = 0;
  let durationMs = 0;
  const daily = new Map<string, any>();
  const users = new Map<string, any>();
  const stages = new Map<number, any>();
  const providers = new Map<string, any>();
  const categories = new Map<string, any>();

  for (const event of events) {
    if (event.status === 'aprovado') approved += 1;
    else if (event.status === 'reprovado') rejected += 1;
    else errors += 1;
    durationMs += event.durationMs;

    const dayKey = event.day || event.createdAt.toISOString().slice(0, 10);
    const day = daily.get(dayKey) || { date: dayKey, runs: 0, ...emptyTokens() };
    day.runs += 1;
    daily.set(dayKey, day);

    const user = users.get(event.uid) || {
      uid: event.uid,
      displayName: event.userDisplayName,
      email: event.userEmail,
      runs: 0,
      approved: 0,
      rejected: 0,
      errors: 0,
      ...emptyTokens(),
    };
    user.runs += 1;
    user[event.status === 'aprovado' ? 'approved' : event.status === 'reprovado' ? 'rejected' : 'errors'] += 1;
    users.set(event.uid, user);

    const categoryKey = event.category || 'Sem categoria';
    const category = categories.get(categoryKey) || { category: categoryKey, runs: 0, ...emptyTokens() };
    category.runs += 1;
    categories.set(categoryKey, category);

    for (const call of event.calls) {
      addCall(totals, call);
      addCall(day, call);
      addCall(user, call);
      addCall(category, call);

      const stage = stages.get(call.stage) || { stage: call.stage, label: `A${call.stage}`, ...emptyTokens() };
      addCall(stage, call);
      stages.set(call.stage, stage);

      const providerKey = `${call.provider}:${call.model}`;
      const provider = providers.get(providerKey) || {
        provider: call.provider,
        model: call.model,
        ...emptyTokens(),
      };
      addCall(provider, call);
      providers.set(providerKey, provider);
    }
  }

  const runs = events.length;
  const completed = approved + rejected;
  const enhanceRunAverage = (item: any) => ({
    ...item,
    averageTokensPerRun: average(item.totalTokens, item.runs),
  });

  return {
    summary: {
      runs,
      approved,
      rejected,
      errors,
      approvalRate: rate(approved, completed),
      averageDurationMs: average(durationMs, runs),
      averageTokensPerRun: average(totals.totalTokens, runs),
      averageInputTokensPerRun: average(totals.inputTokens, runs),
      averageOutputTokensPerRun: average(totals.outputTokens, runs),
      ...totals,
    },
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map(enhanceRunAverage),
    users: [...users.values()].sort((a, b) => b.totalTokens - a.totalTokens).map(item => ({
      ...enhanceRunAverage(item),
      approvalRate: rate(item.approved, item.approved + item.rejected),
    })),
    stages: [...stages.values()].sort((a, b) => a.stage - b.stage).map(item => ({
      ...item,
      averageTokensPerRequest: average(item.totalTokens, item.requests),
    })),
    providers: [...providers.values()].sort((a, b) => b.totalTokens - a.totalTokens).map(item => ({
      ...item,
      averageTokensPerRequest: average(item.totalTokens, item.requests),
    })),
    categories: [...categories.values()].sort((a, b) => b.totalTokens - a.totalTokens).map(enhanceRunAverage),
  };
}
