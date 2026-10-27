import test from 'node:test';
import assert from 'node:assert/strict';
import { clearWeatherCache, getCachedWeather } from './weatherCache.js';

test('reuses a recent forecast response for the same key', async () => {
  clearWeatherCache();
  let loads = 0;
  const load = async () => ({ temperature: ++loads });

  assert.deepEqual(await getCachedWeather('farm-a', load), { temperature: 1 });
  assert.deepEqual(await getCachedWeather('farm-a', load), { temperature: 1 });
  assert.equal(loads, 1);
});

test('coalesces concurrent requests for the same location', async () => {
  clearWeatherCache();
  let loads = 0;
  let finish;
  const load = () => {
    loads += 1;
    return new Promise(resolve => { finish = resolve; });
  };

  const first = getCachedWeather('farm-b', load);
  const second = getCachedWeather('farm-b', load);
  await Promise.resolve();
  finish({ temperature: 21 });
  assert.deepEqual(await Promise.all([first, second]), [{ temperature: 21 }, { temperature: 21 }]);
  assert.equal(loads, 1);
});

test('does not cache failed requests', async () => {
  clearWeatherCache();
  await assert.rejects(getCachedWeather('farm-c', async () => { throw new Error('offline'); }));
  assert.deepEqual(await getCachedWeather('farm-c', async () => ({ temperature: 18 })), { temperature: 18 });
});
