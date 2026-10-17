import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('Compose pulls the fork images and keeps the default API target runtime-free', () => {
  const compose = read('docker-compose.yml');
  for (const image of ['api', 'web']) {
    assert.match(compose, new RegExp(`image: ghcr\\.io/mrclassict/opengym-${image}:latest`));
  }
  assert.match(compose, /target: \$\{API_TARGET:-default\}/);
  const stages = [...read('api/Dockerfile').matchAll(/^FROM .+ AS (\w+)$/gm)].map(m => m[1]);
  assert.deepEqual(stages, ['base', 'coach', 'default']);
});

test('the deployed branch publishes latest while main publishes edge in the fork registry', () => {
  const workflow = read('.github/workflows/docker-publish.yml');
  assert.match(workflow, /branches: \[main, pre-rel\]/);
  assert.match(workflow, /tags: \['v\*'\]/);
  assert.match(workflow, /images: ghcr\.io\/\$\{\{ steps\.repo\.outputs\.owner \}\}\/opengym-\$\{\{ matrix\.image \}\}/);
  assert.match(workflow, /type=raw,value=edge,enable=\$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(workflow, /type=raw,value=latest,enable=\$\{\{ github\.ref == 'refs\/heads\/pre-rel' \|\| startsWith\(github\.ref, 'refs\/tags\/'\) \}\}/);
  assert.match(workflow, /target: \$\{\{ matrix\.image == 'api' && 'default' \|\| '' \}\}/);
  for (const arg of ['VERSION', 'VCS_REF', 'BUILD_DATE', 'APP_BUILD']) {
    assert.match(workflow, new RegExp(`^            ${arg}=`, 'm'));
  }
});
