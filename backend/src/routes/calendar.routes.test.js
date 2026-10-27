import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTimeline } from './calendar.routes.js';
import { validateCalendarPayload } from '../utils/calendarValidation.js';
import { plans } from '../database/repositories/store.js';

test('calendar drafts do not claim fertilizer agent doses or fixed application dates', () => {
  const { events } = generateTimeline({ crop: 'Cotton', sowingDate: '2026-06-15' });
  assert.equal(events.some((event) => event.type === 'fertilizer'), false);
  const reviewTask = events.find((event) => event.title === 'Confirm fertilizer plan before application');
  assert.ok(reviewTask);
  assert.match(reviewTask.notes, /Soil Health Card/);
  assert.match(reviewTask.notes, /has not calculated a fertilizer dose or schedule/);
  assert.equal(events.some((event) => /FYM @|fungicide tonight|skip if >25 mm/i.test(event.notes)), false);
});

test('calendar marks water and harvest entries as check-ins and estimates', () => {
  const { events, harvestWindow } = generateTimeline({ crop: 'Cotton', sowingDate: '2026-06-15' });
  const irrigation = events.find((event) => event.type === 'irrigation');
  const harvest = events.find((event) => event.type === 'harvest' && event.title.startsWith('Estimated'));
  assert.match(irrigation.title, /Check soil moisture/);
  assert.match(irrigation.notes, /not a fixed irrigation instruction/);
  assert.ok(harvest);
  assert.match(harvest.notes, /not a prediction for this specific field/);
  assert.match(harvestWindow, /→/);
});

test('calendar accepts optional saved-farm context and rejects malformed farm IDs', () => {
  const crops = ['Cotton'];
  const valid = validateCalendarPayload({ crop: 'Cotton', sowingDate: '2026-06-15', farmId: 'farm-123' }, crops);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.data.farmId, 'farm-123');
  const invalid = validateCalendarPayload({ crop: 'Cotton', sowingDate: '2026-06-15', farmId: { id: 'farm-123' } }, crops);
  assert.ok(invalid.errors.some(error => error.includes('farmId')));
});

test('calendar event updates persist completion and reschedule dates in timeline order', async () => {
  globalThis.__DB_MODE__ = 'in-memory';
  const userId = `calendar-update-${Date.now()}`;
  const plan = await plans.create({
    userId,
    crop: 'Cotton',
    events: [
      { date: '2026-10-24', title: 'Check the field', done: false },
      { date: '2026-10-25', title: 'Scout for pests', done: false },
    ],
  });

  const moved = await plans.updateEvent(userId, plan.id, 0, { date: '2026-10-26' });
  assert.deepEqual(moved.events.map(event => event.date), ['2026-10-25', '2026-10-26']);
  const completed = await plans.updateEvent(userId, plan.id, 1, { done: true });
  assert.equal(completed.events[1].done, true);
  assert.equal(await plans.updateEvent('another-farmer', plan.id, 0, { done: true }), null);
});
