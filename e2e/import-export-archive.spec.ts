import fs from "fs/promises";
import {
  chooseSelectOption,
  createCollection,
  createField,
  createItem,
  expect,
  getFields,
  getItems,
  openCollection,
  test,
} from "./fixtures";

test("collection import/export and full archive restore use real IPC and isolated files", async ({
  launchApp,
}, testInfo) => {
  const csvPath = testInfo.outputPath("tasks.csv");
  const jsonPath = testInfo.outputPath("tasks.json");
  const archivePath = testInfo.outputPath("archive.json");
  const app = await launchApp({
    dialogResults: {
      save: [csvPath, jsonPath, archivePath],
      open: [csvPath, jsonPath, archivePath],
    },
  });
  const { page } = app;

  const source = await createCollection(page, "Export Source");
  await createField(page, {
    collectionId: source.id,
    name: "Title",
    type: "text",
    options: null,
    orderIndex: 0,
  });
  await createField(page, {
    collectionId: source.id,
    name: "Status",
    type: "select",
    options: JSON.stringify({ choices: ["Open", "Done"] }),
    orderIndex: 1,
  });
  await createItem(page, {
    collectionId: source.id,
    data: { Title: "Round trip one", Status: "Open" },
  });
  await createItem(page, {
    collectionId: source.id,
    data: { Title: "Round trip two", Status: "Done" },
  });

  await page.reload();
  await openCollection(page, "Export Source");
  await page.getByTestId("collection-settings-button").click();
  await page.getByRole("button", { name: "Export Data" }).click();
  await page.getByTestId("collection-export-button").click();
  await expect.poll(async () => fileExists(csvPath)).toBe(true);

  await chooseSelectOption(
    page,
    page.getByTestId("collection-export-format-select"),
    "JSON",
  );
  await page.getByTestId("collection-export-include-schema-switch").click();
  await page.getByTestId("collection-export-button").click();
  await expect.poll(async () => fileExists(jsonPath)).toBe(true);

  const csvTarget = await createCollection(page, "CSV Import Target");
  await page.reload();
  await openCollection(page, "CSV Import Target");
  await page.getByTestId("collection-settings-button").click();
  await page.getByRole("button", { name: "Import Data" }).click();
  await page.getByTestId("collection-import-select-file-button").click();
  await expect(page.getByText("Import Preview", { exact: true })).toBeVisible();
  await page.getByTestId("collection-import-confirm-button").click();
  await page.getByTestId("collection-data-tab").click();
  await expect(page.getByText("Round trip one", { exact: true })).toBeVisible();

  const csvFields = await getFields(page, csvTarget.id);
  expect(csvFields.map((field) => field.name)).toEqual(["Title", "Status"]);
  expect((await getItems(page, csvTarget.id)).total).toBe(2);

  const jsonTarget = await createCollection(page, "JSON Import Target");
  await page.reload();
  await openCollection(page, "JSON Import Target");
  await page.getByTestId("collection-settings-button").click();
  await page.getByRole("button", { name: "Import Data" }).click();
  await chooseSelectOption(
    page,
    page.getByTestId("collection-import-format-select"),
    "JSON",
  );
  await page.getByTestId("collection-import-select-file-button").click();
  await expect(page.getByText("From schema", { exact: true }).first()).toBeVisible();
  await page.getByTestId("collection-import-confirm-button").click();

  const jsonFields = await getFields(page, jsonTarget.id);
  expect(jsonFields.find((field) => field.name === "Status")?.type).toBe(
    "select",
  );
  expect((await getItems(page, jsonTarget.id)).total).toBe(2);

  await page.getByTestId("sidebar-settings").click();
  await page.getByTestId("full-archive-export-button").click();
  await expect.poll(async () => fileExists(archivePath)).toBe(true);

  await openCollection(page, "CSV Import Target");
  await page.getByTestId("collection-settings-button").click();
  await page.getByRole("button", { name: "Danger Zone" }).click();
  await page.getByTestId("delete-collection-button").click();
  await page.getByRole("button", { name: "Delete Collection" }).click();
  await expect(page.getByText("CSV Import Target", { exact: true })).toHaveCount(0);

  await page.getByTestId("sidebar-settings").click();
  await page.getByTestId("full-archive-restore-select-button").click();
  await expect(
    page.getByRole("heading", { name: "Restore Full Archive", exact: true }),
  ).toBeVisible();
  await page.getByTestId("full-archive-restore-confirm-button").click();
  await expect(
    page.getByRole("heading", { name: "Archive Restore Report", exact: true }),
  ).toBeVisible();
  await page.getByTestId("archive-report-close-button").click();

  await expect(
    page.locator("aside").getByText("CSV Import Target", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByText("JSON Import Target", { exact: true }),
  ).toBeVisible();
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
