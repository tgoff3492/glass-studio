import assert from 'node:assert/strict';
import { test } from 'node:test';

import { photoFileName, resolvePhotoRef, toPhotoRef } from './photoRef.ts';

const docs = 'file:///var/mobile/Containers/Data/Application/NEW-ID/Documents/';

test('full addresses become names', () => {
  assert.equal(toPhotoRef('file:///var/mobile/Containers/Data/Application/OLD-ID/Documents/photos/a.jpg'), 'photos/a.jpg');
  assert.equal(toPhotoRef('photos/a.jpg'), 'photos/a.jpg');
  assert.equal(toPhotoRef('data:image/jpeg;base64,AA'), 'data:image/jpeg;base64,AA');
});

test('names and old full addresses both resolve to the current folder', () => {
  assert.equal(resolvePhotoRef('photos/a.jpg', docs), `${docs}photos/a.jpg`);
  assert.equal(resolvePhotoRef('file:///old/Documents/photos/a.jpg', docs.slice(0, -1)), `${docs}photos/a.jpg`);
  assert.equal(resolvePhotoRef('data:image/png;base64,AA', docs), 'data:image/png;base64,AA');
});

test('file names are only given for our own photos', () => {
  assert.equal(photoFileName('photos/a.jpg'), 'a.jpg');
  assert.equal(photoFileName('data:image/png;base64,AA'), null);
});
