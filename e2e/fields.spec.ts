import {
  chooseSelectOption,
  createCollection,
  expect,
  getFields,
  openCollection,
  test,
} from "./fixtures";

test("field CRUD works from the collection Fields panel", async ({ launchApp }) => {
  const { page } = await launchApp();
  const collection = await createCollection(page, "E2E Field CRUD");

  await page.reload();
  await openCollection(page, "E2E Field CRUD");
  await page.getByTestId("collection-fields-tab").click();

  await page.getByTestId("new-field-button").click();
  await page.getByTestId("field-name-input").fill("Title");
  await page.getByTestId("save-fields-button").click();
  await expect(page.locator('[data-testid="field-draft-row"][data-field-name="Title"]')).toBeVisible();

  await page.getByTestId("new-field-button").click();
  await page.getByTestId("field-name-input").fill("Score");
  await chooseSelectOption(page, page.getByTestId("field-type-select"), "Number");
  await page.getByTestId("save-fields-button").click();
  await expect(page.locator('[data-testid="field-draft-row"][data-field-name="Score"]')).toBeVisible();

  await page
    .locator('[data-testid="field-draft-row"][data-field-name="Score"]')
    .click();
  await page.getByTestId("field-name-input").fill("Points");
  await page.getByTestId("save-fields-button").click();
  await expect(page.locator('[data-testid="field-draft-row"][data-field-name="Points"]')).toBeVisible();

  await page
    .locator('[data-testid="field-draft-row"][data-field-name="Title"]')
    .click();
  await page.getByTestId("delete-field-button").click();
  await page.getByTestId("save-fields-button").click();

  const fields = await getFields(page, collection.id);
  expect(fields.map((field) => `${field.name}:${field.type}`)).toEqual([
    "Points:number",
  ]);

  await page.getByTestId("collection-data-tab").click();
  await expect(
    page.locator('[data-testid="grid-header-cell"][data-field-name="Points"]'),
  ).toBeVisible();
});
