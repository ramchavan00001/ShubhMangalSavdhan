import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_CONFIG, AppConfig } from '../config';

/**
 * Photo storage. Files live on local disk in development; swap the body of these
 * methods for S3 calls in production without touching anything else.
 */
@Injectable()
export class StorageService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private path(key: string) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(key)) throw new Error('Bad storage key');
    return join(this.config.uploadDir, key);
  }

  async save(buffer: Buffer, ext: 'jpg' | 'png' | 'webp'): Promise<string> {
    const key = `${randomUUID()}.${ext}`;
    await mkdir(this.config.uploadDir, { recursive: true });
    await writeFile(this.path(key), buffer);
    return key;
  }

  read(key: string) {
    return createReadStream(this.path(key));
  }

  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }
}

/** Detects the real image type from the file's first bytes (never trust the upload's name or header). */
export function sniffImage(buf: Buffer): { ext: 'jpg' | 'png' | 'webp'; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}
