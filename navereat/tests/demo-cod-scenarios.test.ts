import { afterEach, describe, expect, it } from 'vitest';
import { demoApi } from '../src/api/demoApi';
import { clearScenarios, writeScenarios } from '../src/api/scenarios';
import { codState } from '../src/logic/paymentOptions';

const context = { total: 300, groups: 1, restaurantCod: null, backend: null };

afterEach(() => {
  clearScenarios();
});

describe('demo platform status drives the COD selector', () => {
  it('offers COD by default', async () => {
    const status = await demoApi.getPlatformStatus();
    expect(status.isCodEnabled).toBe(true);
    expect(codState(status, context)).toEqual({ ok: true, note: 'Pay Cash or UPI at Doorstep' });
  });

  it('hides COD when the platform switch is off', async () => {
    writeScenarios({ cod: 'off' });
    const status = await demoApi.getPlatformStatus();
    expect(status.isCodEnabled).toBe(false);
    expect(codState(status, context)).toEqual({ ok: false, note: 'Unavailable' });
  });

  it('blocks the customer from COD', async () => {
    writeScenarios({ cod: 'blocked' });
    const status = await demoApi.getPlatformStatus();
    expect(codState(status, context)).toEqual({ ok: false, note: 'Please use UPI for this order' });
  });

  it('reports the COD cap from the active zone policy', async () => {
    writeScenarios({ cod: 'overcap' });
    const status = await demoApi.getPlatformStatus();
    expect(codState(status, context).note).toBe('Available for orders up to ₹1');
  });
});
