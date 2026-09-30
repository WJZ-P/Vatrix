import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SITES, siteFor } from '../src/sites.js';

test('the host picks the site; local test pages fall back to the path', () => {
  assert.equal(siteFor('https://www.bilibili.com/video/BV1xx411c7mD/'), SITES.bilibili);
  assert.equal(siteFor('https://www.youtube.com/watch?v=abc'), SITES.youtube);
  assert.equal(siteFor('https://m.youtube.com/'), SITES.youtube);
  // A /watch path on Bilibili is still Bilibili.
  assert.equal(siteFor('https://www.bilibili.com/watch'), SITES.bilibili);
  assert.equal(siteFor('http://127.0.0.1:8767/watch?v=fixture'), SITES.youtube);
  assert.equal(siteFor('http://127.0.0.1:8767/video/vatrix-local-fixture/'), SITES.bilibili);
});

test('every site describes the same set of hooks', () => {
  const keys = (site) => Object.keys(site).sort();
  assert.deepEqual(keys(SITES.youtube), keys(SITES.bilibili));
  for (const site of Object.values(SITES)) {
    for (const name of ['video', 'area', 'anchor', 'relevant']) assert.equal(typeof site[name], 'string', `${site.id}.${name}`);
    for (const name of ['place', 'placed', 'fit', 'suspended']) assert.equal(typeof site[name], 'function', `${site.id}.${name}`);
  }
  // Only the main YouTube player counts, never a hover preview.
  assert.match(SITES.youtube.video, /^#movie_player /);
});
