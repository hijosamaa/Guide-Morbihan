import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Project critical configuration files exist', () => {
  assert.ok(fs.existsSync(path.resolve('next.config.ts')));
  assert.ok(fs.existsSync(path.resolve('drizzle.config.ts')));
  assert.ok(fs.existsSync(path.resolve('Dockerfile')));
  assert.ok(fs.existsSync(path.resolve('docker-compose.yml')));
  assert.ok(fs.existsSync(path.resolve('.env.example')));
  assert.ok(fs.existsSync(path.resolve('public/.gitkeep')));
});
