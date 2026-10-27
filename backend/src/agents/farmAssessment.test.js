import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarmAgentPlan } from './farmAssessment.js';

const completeFarm = {
  id: 'farm-1',
  name: 'Demo Farm',
  location: 'Nashik, Maharashtra',
  area: 2,
  areaUnit: 'acres',
  soilType: 'Alluvial',
  season: 'Kharif',
  soilPH: 6.5,
  soilEC: 0.5,
  soilOC: 0.7,
  soilN: 100,
  soilP: 40,
  soilK: 80,
  soilS: 15,
  soilZn: 1.2,
  soilB: 0.5,
  soilFe: 5,
  soilCu: 1,
  soilMn: 3,
  soilSources: { soilN: 'soil_report_reviewed', soilPH: 'farmer_entered' },
  soilTestDate: '2026-05-01',
};

test('builds crop and fertilizer inputs from a saved farm and farmer-reviewed conditions', () => {
  const plan = buildFarmAgentPlan(completeFarm, {
    agents: ['crop', 'fertilizer'],
    environment: {
      temperature: 28,
      humidity: 65,
      rainfall: 900,
      inputSources: {
        temperature: 'current_weather_service',
        humidity: 'current_weather_service',
        rainfall: 'farmer_entered',
      },
    },
  });

  assert.deepEqual(plan.needsInput, {});
  assert.deepEqual(plan.inputs.crop, {
    N: 100, P: 40, K: 80, ph: 6.5, temperature: 28, humidity: 65, rainfall: 900,
  });
  assert.equal(plan.inputs.fertilizer.Soil_Type, 'Alluvial');
  assert.equal(plan.inputs.fertilizer.Season, 'Kharif');
  assert.equal(plan.inputSources.N, 'soil_report_reviewed');
  assert.equal(plan.inputSources.temperature, 'current_weather_service');
  assert.equal(plan.inputSources.N_kg_per_ha, 'farmer-reviewed soil report');
  assert.equal(plan.inputSources.Soil_Type, 'farm_profile');
  assert.equal(plan.farmContext.areaUnit, 'acres');
});

test('does not invent missing soil or climate readings or unsupported soil categories', () => {
  const partialFarm = { ...completeFarm, soilType: 'Loamy', soilMn: null };
  const plan = buildFarmAgentPlan(partialFarm, { agents: ['crop', 'fertilizer'] });

  assert.equal(plan.inputs.crop, undefined);
  assert.equal(plan.inputs.fertilizer, undefined);
  assert.ok(plan.needsInput.crop.missingInputs.includes('temperature'));
  assert.ok(plan.needsInput.crop.missingInputs.includes('rainfall'));
  assert.ok(plan.needsInput.fertilizer.missingInputs.includes('Mn_ppm'));
  assert.ok(plan.needsInput.fertilizer.missingInputs.includes('Soil_Type'));
});

test('does not substitute sample market prices for a farm assessment', () => {
  const plan = buildFarmAgentPlan(completeFarm, { agents: ['market'] });
  assert.equal(plan.inputs.market, undefined);
  assert.ok(plan.needsInput.market.message.includes('No sample prices are substituted'));
});
