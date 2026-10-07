import { expect, type Page } from "@playwright/test";

/** Exercise the deliberately opened production menu, including repeat reads and Settings. */
export async function selectMemoryView(page: Page, label: "Fragment" | "Constellation" | "Archive" | "Settings") {
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Memories", exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: label, exact: true }).click();
  await expect(menu).not.toBeVisible();
}
