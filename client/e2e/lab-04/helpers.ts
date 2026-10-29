import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, viewports } from "../lab-03/helpers";

const screenshotsRoot = fileURLToPath(new URL("../../../artifacts/lab-04/screenshots/", import.meta.url));

export async function captureLab4(page: Page, screen: string, name: string, viewport?: { width: number; height: number }) {
  if (viewport) await page.setViewportSize(viewport);
  await expect(page.locator("main")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const target = path.join(screenshotsRoot, screen, `${name}.png`);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
}

export async function captureLab4AllViewports(page: Page, screen: string, route: string, prefix: string) {
  for (const viewport of viewports) {
    await page.goto(route);
    await captureLab4(page, screen, `${prefix}-${viewport.width}x${viewport.height}`, viewport);
  }
}
