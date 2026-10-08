import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, Telemetry } from '../dist/index.js';

function recorder() {
  const calls = [];
  return {
    calls,
    init: (config, standard) => calls.push(['init', standard]),
    capture: (event, props) => calls.push(['capture', event, props]),
    identify: (id, props) => calls.push(['identify', id, props]),
    reset: () => calls.push(['reset']),
    captureException: (error, props) => calls.push(['exception', error, props]),
  };
}

const config = { product: 'scraps', env: 'prod', apiKey: 'phc_test', host: 'https://eu.i.posthog.com', appVersion: '1.15.0' };

test('no api key is a hard no-op', () => {
  const p = recorder();
  const t = new Telemetry({ ...config, apiKey: '' }, p);
  t.capture('anything');
  t.identify('dave');
  t.logout();
  t.captureException(new Error('x'));
  assert.equal(t.enabled, false);
  assert.deepEqual(p.calls, []);
});

test('standard properties ride on every event and cannot be overridden', () => {
  const p = recorder();
  const t = new Telemetry(config, p);
  t.capture('record_saved', { is_new: true, product: 'impostor', app: 'api' });
  const [, event, props] = p.calls.at(-1);
  assert.equal(event, 'record_saved');
  assert.deepEqual(props, { is_new: true, product: 'scraps', app: 'web', env: 'prod', app_version: '1.15.0' });
});

test('init receives the standard properties for registration', () => {
  const p = recorder();
  new Telemetry({ ...config, app: 'ios', appVersion: undefined }, p);
  assert.deepEqual(p.calls[0], ['init', { product: 'scraps', app: 'ios', env: 'prod' }]);
});

test('identify records the login; logout captures before reset', () => {
  const p = recorder();
  const t = new Telemetry(config, p);
  t.identify('dave');
  t.logout();
  const names = p.calls.slice(1).map((c) => (c[0] === 'capture' ? c[1] : c[0]));
  assert.deepEqual(names, ['identify', EVENTS.userLoggedIn, EVENTS.userLoggedOut, 'reset']);
});

test('pageview carries the url', () => {
  const p = recorder();
  const t = new Telemetry(config, p);
  t.pageview('https://scraps.beazer.software/ingest');
  const [, event, props] = p.calls.at(-1);
  assert.equal(event, '$pageview');
  assert.equal(props.$current_url, 'https://scraps.beazer.software/ingest');
});
