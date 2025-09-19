import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStatsApiStore } from '../stats.api';

// Mock SQL client (factory must not reference outer consts)
vi.mock('@/db/client', () => ({ query: vi.fn() }));

async function getQueryMock() {
  // get the mocked module so returned `query` is a vi.fn
  const mod = await vi.importMock<any>('@/db/client');
  return mod.query as any;
}

describe('stats.api store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Freeze time to a Tuesday so week anchors are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-16T10:00:00Z')); // Tue
  });

  it('parses intensity zones from rpe_rir strings', async () => {
    const store = useStatsApiStore();
    // 1 light (5), 2 moderate ([7,1], 8), 1 hard (9)
  const query = await getQueryMock();
  query.mockResolvedValueOnce([
      { rpe_rir: '5' },
      { rpe_rir: '[7,1]' },
      { rpe_rir: '8' },
      { rpe_rir: '9' },
    ]);
    const zones = await store.getIntensityZones('month');
    expect(zones.light + zones.moderate + zones.hard).toBe(100);
    // Exact distribution: 1/4=25, 2/4=50, 1/4=25
    expect(zones).toEqual({ light: 25, moderate: 50, hard: 25 });
  expect(query.mock.calls.length).toBe(1);
  });

  it('builds volume chart for last full weeks and supports exercise filter', async () => {
    const store = useStatsApiStore();
    // month => 4 weeks, each query returns fixed tonnage
  const query = await getQueryMock();
  query
      .mockResolvedValueOnce([{ tonnage: 100 }])
      .mockResolvedValueOnce([{ tonnage: 200 }])
      .mockResolvedValueOnce([{ tonnage: 300 }])
      .mockResolvedValueOnce([{ tonnage: 400 }]);
    const data = await store.getVolumeChart('month', 'Общий', 'tonnage', 123);
    expect(data.labels.length).toBe(4);
    expect(data.datasets[0].data).toEqual([100,200,300,400]);
    // Ensure filter by exercise applied
  const lastSql = query.mock.calls.at(-1)?.[0] as string;
  const lastParams = query.mock.calls.at(-1)?.[1] as any[];
    expect(lastSql).toContain('AND pde.exercise_id = ?');
    expect(lastParams.at(-1)).toBe(123);
    // Four weekly queries
  expect(query.mock.calls.length).toBe(4);
  });

  it('returns cached value immediately and refreshes in background', async () => {
    const store = useStatsApiStore();
    // First dataset
  const query = await getQueryMock();
  query.mockResolvedValueOnce([
      { exercise_id: 1, exercise_name: 'A', sets_count: 10 },
      { exercise_id: 2, exercise_name: 'B', sets_count: 8 },
    ]);
    const first = await store.getTopExercises('month');
    expect(first.map(x => x.name)).toEqual(['A','B']);
    // Second dataset (will be used after background refresh)
  query.mockResolvedValueOnce([
      { exercise_id: 3, exercise_name: 'C', sets_count: 12 },
    ]);
    const second = await store.getTopExercises('month');
    // Should return cached first value immediately
    expect(second.map(x => x.name)).toEqual(['A','B']);
    // Allow microtasks to flush so background can commit
    await Promise.resolve();
    const third = await store.getTopExercises('month');
    expect(third.map(x => x.name)).toEqual(['C']);
  // 1st call loads data (1 query), 2nd call triggers background refresh (2nd query),
  // 3rd call may trigger another background refresh (3rd query). Allow >= 2.
  expect(query.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('computes muscle details within last full week window', async () => {
    const store = useStatsApiStore();
    // primary and secondary queries
  const query = await getQueryMock();
  query
      .mockResolvedValueOnce([{ exercise_name: 'Bench', sets_count: 3 }])
      .mockResolvedValueOnce([{ exercise_name: 'Push-up', sets_count: 2 }]);
    const res = await store.getMuscleDetails('Грудь', 1);
    expect(res.primary).toBe(3);
    expect(res.secondary).toBe(2);
  // Inspect first query params shape and ordering
  const firstParams = query.mock.calls[0][1] as number[];
  const secondParams = query.mock.calls[1][1] as number[];
  expect(firstParams.length).toBe(3); // start, end, muscle
  expect(secondParams.length).toBe(3);
  expect(typeof firstParams[0]).toBe('number');
  expect(typeof firstParams[1]).toBe('number');
  expect(firstParams[0]).toBeLessThan(firstParams[1]);
  expect(secondParams[0]).toBeLessThan(secondParams[1]);
  });
});
