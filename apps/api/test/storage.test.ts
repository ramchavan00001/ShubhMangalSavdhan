import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { after, describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import type { AppConfig } from '../src/config';
import { GcsDriver, LocalDriver, StorageService } from '../src/photos/storage.service';

async function text(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString();
}

const config = (storage: Partial<AppConfig['storage']>) =>
  ({ storage: { driver: 'local', uploadDir: '', bucket: '', prefix: 'uploads/', ...storage } }) as AppConfig;

describe('photo storage (local disk)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sms-storage-'));
  after(() => rm(dir, { recursive: true, force: true }));
  const storage = new StorageService(config({ uploadDir: dir }));

  it('saves, reads back and removes a file under a random key', async () => {
    const key = await storage.save(Buffer.from('hello'), 'jpg');
    assert.match(key, /^[0-9a-f-]{36}\.jpg$/);
    assert.equal(await text(await storage.read(key)), 'hello');
    await storage.remove(key);
    await assert.rejects(storage.read(key), NotFoundException);
  });

  it('rejects keys that could escape the folder', async () => {
    await assert.rejects(storage.read('../etc/passwd'), /Bad storage key/);
    await assert.rejects(storage.remove('a/b.jpg'), /Bad storage key/);
  });

  it('removing a missing file is not an error', async () => {
    await storage.remove('00000000-0000-0000-0000-000000000000.png');
  });

  it('local driver returns null for a missing file', async () => {
    assert.equal(await new LocalDriver(dir).get('nope.jpg'), null);
  });
});

describe('photo storage (Cloud Storage bucket)', () => {
  // Minimal in-memory stand-in for @google-cloud/storage.
  const objects = new Map<string, { data: Buffer; contentType?: string }>();
  const calls: { bucket?: string; saveOpts?: Record<string, unknown> } = {};
  const fakeStorage = {
    bucket(name: string) {
      calls.bucket = name;
      return {
        file: (path: string) => ({
          async save(data: Buffer, opts: Record<string, unknown>) {
            calls.saveOpts = opts;
            objects.set(path, { data, contentType: opts.contentType as string });
          },
          async exists() {
            return [objects.has(path)];
          },
          createReadStream: () => Readable.from([objects.get(path)!.data]),
          async delete() {
            objects.delete(path);
          },
        }),
      };
    },
  };
  const driver = new GcsDriver('my-bucket', 'uploads/', fakeStorage as never);
  const storage = new StorageService(config({ driver: 'gcs', bucket: 'my-bucket' }), driver);

  it('stores objects in the bucket under the prefix with the right content type, never overwriting', async () => {
    const key = await storage.save(Buffer.from('png-bytes'), 'png');
    assert.equal(calls.bucket, 'my-bucket');
    assert.deepEqual([...objects.keys()], [`uploads/${key}`]);
    assert.equal(objects.get(`uploads/${key}`)!.contentType, 'image/png');
    assert.deepEqual(calls.saveOpts!.preconditionOpts, { ifGenerationMatch: 0 });
    assert.equal(await text(await storage.read(key)), 'png-bytes');
  });

  it('missing objects are a 404 and removal deletes the object', async () => {
    const key = await storage.save(Buffer.from('x'), 'webp');
    await storage.remove(key);
    assert.equal(objects.has(`uploads/${key}`), false);
    await assert.rejects(storage.read(key), NotFoundException);
  });
});
