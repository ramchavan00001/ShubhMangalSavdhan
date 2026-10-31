import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { APP_CONFIG, AppConfig } from '../config';

export type ImageExt = 'jpg' | 'png' | 'webp';

const MIME: Record<ImageExt, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Optional override of the driver (tests). */
export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** Where the bytes actually live. Keys are always `<uuid>.<ext>`. */
export interface StorageDriver {
  put(key: string, buffer: Buffer, mime: string): Promise<void>;
  /** Resolves to a stream, or null when the file is missing. */
  get(key: string): Promise<Readable | null>;
  delete(key: string): Promise<void>;
}

/** Local disk, for development (`STORAGE_DRIVER=local`). */
export class LocalDriver implements StorageDriver {
  constructor(private readonly dir: string) {}

  async put(key: string, buffer: Buffer) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, key), buffer);
  }

  async get(key: string) {
    const path = join(this.dir, key);
    try {
      await stat(path);
    } catch {
      return null;
    }
    return createReadStream(path);
  }

  async delete(key: string) {
    await rm(join(this.dir, key), { force: true });
  }
}

/**
 * Google Cloud Storage / Firebase Storage bucket (`STORAGE_DRIVER=gcs`).
 * The API authenticates with its Cloud Run service account; the bucket stays private
 * (Firebase rules deny all client access) and every photo goes through the API's privacy checks.
 */
export class GcsDriver implements StorageDriver {
  private readonly bucket;

  constructor(bucketName: string, private readonly prefix: string, storage = new Storage()) {
    this.bucket = storage.bucket(bucketName);
  }

  private file(key: string) {
    return this.bucket.file(this.prefix + key);
  }

  async put(key: string, buffer: Buffer, mime: string) {
    // ifGenerationMatch: 0 → never overwrite an existing object.
    await this.file(key).save(buffer, {
      resumable: false,
      contentType: mime,
      metadata: { cacheControl: 'private, max-age=0' },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  }

  async get(key: string) {
    const file = this.file(key);
    const [exists] = await file.exists();
    return exists ? file.createReadStream() : null;
  }

  async delete(key: string) {
    await this.file(key).delete({ ignoreNotFound: true });
  }
}

/**
 * Photo and selfie storage. The rest of the app only sees opaque keys; which driver is used
 * comes from `STORAGE_DRIVER` (local disk in development, a Cloud Storage bucket in production).
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger('Storage');
  private readonly driver: StorageDriver;

  constructor(@Inject(APP_CONFIG) config: AppConfig, @Optional() @Inject(STORAGE_DRIVER) driver?: StorageDriver) {
    const s = config.storage;
    this.driver = driver ?? (s.driver === 'gcs' ? new GcsDriver(s.bucket, s.prefix, new Storage(s.apiEndpoint ? { apiEndpoint: s.apiEndpoint } : {})) : new LocalDriver(s.uploadDir));
  }

  private check(key: string) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(key)) throw new Error('Bad storage key');
    return key;
  }

  async save(buffer: Buffer, ext: ImageExt): Promise<string> {
    const key = `${randomUUID()}.${ext}`;
    await this.driver.put(key, buffer, MIME[ext]);
    return key;
  }

  /** A stream of the file. Throws 404 when the file is missing. */
  async read(key: string): Promise<Readable> {
    const stream = await this.driver.get(this.check(key));
    if (!stream) {
      this.log.warn(`Missing file ${key}`);
      throw new NotFoundException();
    }
    return stream;
  }

  async remove(key: string) {
    await this.driver.delete(this.check(key));
  }
}

/** Detects the real image type from the file's first bytes (never trust the upload's name or header). */
export function sniffImage(buf: Buffer): { ext: ImageExt; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}
