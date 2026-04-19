import { Injectable } from "@nestjs/common";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

@Injectable()
export class CoursePackStorageService {
  async storeDocument(input: {
    learnerId: string;
    coursePackId: string;
    checksumSha256: string;
    originalFilename: string;
    buffer: Buffer;
  }) {
    const relativeDirectory = path.join(
      input.learnerId,
      input.coursePackId,
    );
    const safeFilename = sanitizeFilename(input.originalFilename);
    const relativePath = path.join(
      relativeDirectory,
      `${input.checksumSha256}-${safeFilename}`,
    );
    const absolutePath = path.join(this.getStorageRoot(), relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageKey: relativePath.replaceAll("\\", "/"),
      absolutePath,
    };
  }

  async removeDocument(storageKey: string) {
    const absolutePath = path.join(this.getStorageRoot(), storageKey);
    await rm(absolutePath, { force: true });
  }

  async readDocument(storageKey: string) {
    const absolutePath = path.join(this.getStorageRoot(), storageKey);
    return readFile(absolutePath);
  }

  private getStorageRoot() {
    return path.resolve(
      process.env.COURSE_PACK_STORAGE_DIR ??
        path.join(process.cwd(), "..", "..", ".local", "course-packs"),
    );
  }
}

function sanitizeFilename(value: string) {
  const normalized = value.trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]+/g, "-");

  return safe.length > 0 ? safe : "document.pdf";
}
