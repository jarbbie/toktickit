import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const uploadDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");

export function attachmentPath(storageKey: string) {
  return path.join(uploadDirectory, storageKey);
}

export async function saveAttachment(storageKey: string, contents: Buffer) {
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(attachmentPath(storageKey), contents, { flag: "wx" });
}

export async function discardAttachment(storageKey: string) {
  await unlink(attachmentPath(storageKey)).catch(() => undefined);
}
