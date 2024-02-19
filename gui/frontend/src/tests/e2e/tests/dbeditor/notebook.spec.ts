/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import fs from "fs/promises";
import { basename, join } from "path";
import { Key, error, until, WebDriver, WebElement } from "selenium-webdriver";
import { DBConnection } from "../../lib/dbConnection.js";
import { DBNotebooks } from "../../lib/dbNotebooks.js";
import { IDBConnection, Misc, explicitWait } from "../../lib/misc.js";
import { ShellSession } from "../../lib/shellSession.js";
import * as locator from "../../lib/locators.js";
import { CommandExecutor } from "../../lib/cmdExecutor.js";
import * as interfaces from "../../lib/interfaces.js";
import * as constants from "../../lib/constants.js";
import * as waitUntil from "../../lib/until.js";
import { platform } from "os";

let driver: WebDriver;
const filename = basename(__filename);
const url = Misc.getUrl(basename(filename));

describe("Notebook", () => {

    const commandExecutor = new CommandExecutor();
    let testFailed = false;
    let cleanEditor = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `connNotebooks`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: "dbuser2",
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: "dbuser2",
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        driver = await Misc.loadDriver();
        try {
            await driver.wait(async () => {
                try {
                    console.log(`${filename} : ${url}`);
                    await Misc.waitForHomePage(driver, url);

                    return true;
                } catch (e) {
                    await driver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            await driver.executeScript("arguments[0].click()", await driver.findElement(locator.sqlEditorPage.icon));
            const db = await DBNotebooks.createDBconnection(driver, globalConn);
            await driver.executeScript("arguments[0].click();", db);
            await Misc.setPassword(driver, globalConn);
            await Misc.setConfirmDialog(driver, globalConn, "no");
            await driver.wait(until.elementLocated(locator.notebook.toolbar.exists),
                explicitWait * 2, "Notebook was not loaded");
        } catch (e) {
            await Misc.storeScreenShot(driver, "beforeAll_Notebook");
            throw e;
        }
        await driver.wait(until.elementLocated(locator.notebook.toolbar.exists), explicitWait * 2,
            "Notebook was not loaded");

    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            await Misc.storeScreenShot(driver);
        }
        if (cleanEditor) {
            await commandExecutor.clean(driver);
            cleanEditor = false;
        }
    });

    afterAll(async () => {
        await Misc.writeFELogs(basename(__filename), driver.manage().logs());
        await driver.close();
        await driver.quit();
    });

    testFailed = false;

    it("Multi-cursor", async () => {
        try {
            await commandExecutor.write(driver, "hello 1", true);
            await DBNotebooks.setNewLineOnEditor(driver);
            await commandExecutor.write(driver, "hello 2");
            await DBNotebooks.setNewLineOnEditor(driver);
            await commandExecutor.write(driver, "hello 3");

            await driver.actions().keyDown(Key.ALT).perform();

            const clickLine = async (line: number): Promise<void> => {
                await driver.wait(async () => {
                    try {
                        const lines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                        lines.shift();
                        const spans = await lines[line].findElements(locator.htmlTag.span);
                        await spans[spans.length - 1].click();

                        return true;
                    } catch (e) {
                        // continue
                    }
                }, explicitWait, `Line ${line} is still stale`);
            };

            await clickLine(0);
            await clickLine(1);

            await driver.actions().keyUp(Key.ALT).perform();

            const ctx = await driver.findElement(locator.notebook.codeEditor.editor.linesContent);
            expect((await ctx.findElements(locator.notebook.codeEditor.editor.currentLine)).length).toBe(3);

            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys("testing");

            const context = await driver.findElement(locator.notebook.codeEditor.editor.exists);
            const lines = await context.findElements(locator.notebook.codeEditor.editor.line);
            try {
                // is stale ?
                await lines[lines.length - 1].click();
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }

            expect(await Misc.getPromptTextLine(driver, "last-2")).toContain("testing");
            expect(await Misc.getPromptTextLine(driver, "last-1")).toContain("testing");
            expect(await Misc.getPromptTextLine(driver, "last")).toContain("testing");
        } catch (e) {
            testFailed = true;
            await driver.actions().sendKeys(Key.ESCAPE).perform();
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Context Menu - Execute", async () => {
        try {
            await commandExecutor.executeWithContextMenu(driver, "select * from actor limit 1", "Execute Block");
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt(driver)).toBe(false);
            await commandExecutor.clean(driver);
            await commandExecutor.executeWithContextMenu(driver,
                "select * from address limit 1", "Execute Block and Advance", false);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) record retrieved/);
            expect(await DBConnection.hasNewPrompt(driver)).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Switch between search tabs", async () => {
        try {
            await commandExecutor
                .execute(driver, "select * from sakila.actor limit 1; select * from sakila.address limit 1;", true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const resultTabs = (commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[]);
            expect(resultTabs[0].tabName).toBe("Result #1");
            expect(resultTabs[1].tabName).toBe("Result #2");
            expect(resultTabs[0].content).toMatch(/actor_id.*first_name.*last_name.*last_update/);
            expect(resultTabs[1].content)
                .toMatch(/address.*address2.*district.*city_id.*postal_code.*phone.*last_update/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify default schema", async () => {
        try {
            const defaultSchema = await driver.findElement(
                locator.notebook.explorerHost.schemas.default,
            );
            expect(await defaultSchema.getText()).toBe(String(globalConn.schema));
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Execute selection or full block and create new block", async () => {
        try {
            await commandExecutor.executeWithButton(driver, "SELECT * FROM sakila.actor;", constants.execFullBlockSql);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+) record/);
            await driver.wait(waitUntil.editorHasNewPrompt(driver),
                constants.wait5seconds, "Editor should have a new prompt");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Execute statement at the caret position", async () => {
        try {
            const query1 = "select * from sakila.actor limit 1;";
            const query2 = "select * from sakila.address limit 2;";
            await commandExecutor.write(driver, query1, true);
            await DBNotebooks.setNewLineOnEditor(driver);
            await commandExecutor.write(driver, query2, true);
            await commandExecutor.findAndExecute(driver, query1);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/actor_id/);

            await commandExecutor.findAndExecute(driver, query2, commandExecutor.getResultId());
            expect(await (commandExecutor.getResultContent() as WebElement).getAttribute("innerHTML"))
                .toMatch(/address_id/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Connection toolbar buttons - Autocommit DB Changes", async () => {
        try {
            const autoCommitBtn = await DBNotebooks.getToolbarButton(driver, constants.autoCommit);
            const style = await autoCommitBtn!.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn!.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await DBNotebooks.getToolbarButton(driver, constants.commit);
            const rollBackBtn = await DBNotebooks.getToolbarButton(driver, constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn!),
                constants.wait2seconds, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn!),
                constants.wait2seconds, "Commit button should be enabled");

            await commandExecutor
                .execute(driver, `INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await rollBackBtn!.click();

            await commandExecutor.execute(driver, `SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await commandExecutor
                .execute(driver, `INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await commitBtn!.click();

            await commandExecutor.execute(driver, `SELECT * FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);

            await autoCommitBtn!.click();

            await driver.wait(
                async () => {
                    const commitBtn = await DBNotebooks.getToolbarButton(driver, constants.commit);
                    const rollBackBtn = await DBNotebooks.getToolbarButton(driver, constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait5seconds,
                "Commit/Rollback DB changes button is still enabled ",
            );

            await commandExecutor.execute(driver, `DELETE FROM sakila.actor WHERE first_name="${random}";`);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connection toolbar buttons - Find and Replace", async () => {
        try {
            const contentHost = await driver.findElement(locator.notebook.exists);
            await commandExecutor.write(driver, `import from xpto xpto xpto`);
            const findBtn = await DBNotebooks.getToolbarButton(driver, "Find");
            await findBtn!.click();
            const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                constants.wait5seconds, "Find widget does not exist");
            await driver.wait(until.elementIsVisible(finder),
                constants.wait5seconds, "Find widget was not visible");

            await finder.findElement(locator.notebook.codeEditor.textArea).sendKeys("xpto");
            await DBNotebooks.widgetFindInSelection(driver, false);
            expect(await (await finder.findElement(locator.findWidget.matchesCount)).getText()).toMatch(/1 of (\d+)/);
            await driver.wait(
                until.elementsLocated(locator.findWidget.findMatch),
                2000,
                "No words found",
            );
            await DBNotebooks.widgetExpandFinderReplace(driver, true);
            const replacer = await finder.findElement(locator.findWidget.replacePart);
            await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("tester");
            await (await DBNotebooks.widgetGetReplacerButton(driver, "Replace (Enter)"))!.click();
            expect(await (await contentHost.findElement(locator.notebook.codeEditor.textArea)).getAttribute("value"))
                .toContain("import from tester xpto xpto");

            await replacer.findElement(locator.notebook.codeEditor.textArea).clear();
            await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing");
            await (await DBNotebooks.widgetGetReplacerButton(driver, "Replace All"))!.click();
            expect(await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"))
                .toContain("import from tester testing testing");
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await DBNotebooks.widgetCloseFinder(driver);
            cleanEditor = true;
        }
    });

    it("Expand Collapse schema objects", async () => {
        try {

            await DBConnection.expandCollapseMenus(driver, "open editors", false, 0);
            await DBConnection.expandCollapseMenus(driver, "scripts", false, 0);
            const sakila = await DBConnection.getSchemaObject(driver, "Schema", "sakila");
            expect(
                await (
                    await sakila!.findElement(locator.notebook.explorerHost.schemas.treeToggle)
                ).getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.toggleSchemaObject(driver, "Tables", "Tables");
            const tables = await DBConnection.getSchemaObject(driver, "Tables", "Tables");

            await driver.wait(async () => {
                try {
                    const treeToggle = await tables!.findElement(locator.notebook.explorerHost.schemas.treeToggle);

                    return ((await treeToggle.getAttribute("class")).includes("expanded"));
                } catch (e) {
                    if (!(e instanceof error.NoSuchElementError)) {
                        throw e;
                    }
                }
            }, explicitWait * 2, "Tables tree was not expanded");

            expect(await DBConnection.getSchemaObject(driver, "obj", "actor")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "address")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "category")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "city")).toBeDefined();
            expect(await DBConnection.getSchemaObject(driver, "obj", "country")).toBeDefined();
            await DBConnection.toggleSchemaObject(driver, "Tables", "Tables");

            let attr = await (
                await DBConnection.getSchemaObject(driver, "Tables", "Tables")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await DBConnection.toggleSchemaObject(driver, "Views", "Views");
            expect(
                await (
                    await DBConnection.getSchemaObject(driver, "Views", "Views")
                )!.getAttribute("class"),
            ).toContain("expanded");

            expect(await DBConnection.getSchemaObject(driver, "obj", "test_view")).toBeDefined();
            await DBConnection.toggleSchemaObject(driver, "Views", "Views");
            attr = await (
                await DBConnection.getSchemaObject(driver, "Views", "Views")
            )!.getAttribute("class");

            expect(attr.split(" ").includes("expanded") === false).toBe(true);
            await DBConnection.toggleSchemaObject(driver, "Schema", "sakila");
            attr = await (
                await DBConnection.getSchemaObject(driver, "Schema", "sakila")
            )!.getAttribute("class");
            expect(attr.split(" ").includes("expanded") === false).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Expand_Collapse menus", async () => {
        try {

            await DBConnection.expandCollapseMenus(driver, "open editors", true, 0);
            expect(
                await driver
                    .findElement(locator.notebook.explorerHost.openEditors.exists)
                    .findElement(locator.notebook.explorerHost.openEditors.container)
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus(driver, "open editors", false, 0);
            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.openEditors.exists)
                            .findElement(locator.notebook.explorerHost.openEditors.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Open Editors' is still expanded",
            );

            await DBConnection.expandCollapseMenus(driver, "open editors", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.openEditors.exists)
                            .findElement(locator.notebook.explorerHost.openEditors.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Open Editors' is still collapsed",
            );

            expect(
                await driver
                    .findElement(locator.notebook.explorerHost.schemas.exists)
                    .findElement(locator.notebook.explorerHost.schemas.container)
                    .getAttribute("class"),
            ).toContain("expanded");

            await DBConnection.expandCollapseMenus(driver, "schemas", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.schemas.exists)
                            .findElement(locator.notebook.explorerHost.schemas.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Schemas' is still expanded",
            );

            await DBConnection.expandCollapseMenus(driver, "schemas", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.schemas.exists)
                            .findElement(locator.notebook.explorerHost.schemas.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Schemas' is still collapsed",
            );

            await DBConnection.expandCollapseMenus(driver, "admin", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.administration.exists)
                            .findElement(locator.notebook.explorerHost.administration.scrollBar)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Administration' is still expanded",
            );

            await DBConnection.expandCollapseMenus(driver, "admin", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.administration.exists)
                            .findElement(locator.notebook.explorerHost.administration.scrollBar)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Administration' is still collapsed",
            );

            await DBConnection.expandCollapseMenus(driver, "scripts", false, 0);

            await driver.wait(
                async () => {
                    return !(
                        await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Scripts' is still expanded",
            );

            await DBConnection.expandCollapseMenus(driver, "scripts", true, 0);

            await driver.wait(
                async () => {
                    return (
                        await driver
                            .findElement(locator.notebook.explorerHost.scripts.exists)
                            .findElement(locator.notebook.explorerHost.scripts.container)
                            .getAttribute("class")
                    ).includes("expanded");
                },
                2000,
                "'Scripts' is still collapsed",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Execute code on different prompt languages", async () => {
        try {
            const query = "select * from sakila.actor limit 1";
            const languageSwitch = "\\javascript ";
            const jsCmd = "Math.random()";
            await commandExecutor.execute(driver, query);
            const block1 = commandExecutor.getResultId();
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            await commandExecutor.languageSwitch(driver, languageSwitch);
            await commandExecutor.execute(driver, jsCmd, undefined, block1);
            const block2 = commandExecutor.getResultId();
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
            await commandExecutor.findAndExecute(driver, query, block1);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            await commandExecutor.findAndExecute(driver, jsCmd, block2);
            expect(commandExecutor.getResultMessage()).toMatch(/(\d+).(\d+)/);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            cleanEditor = true;
        }
    });

    it("Multi-line comments", async () => {
        try {
            await commandExecutor.languageSwitch(driver, "\\sql ", true);
            await commandExecutor.execute(driver, "select version();");
            expect(commandExecutor.getResultMessage()).toMatch(/1 record retrieved/);
            const txt = await (commandExecutor.getResultContent() as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell).getText();
            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];
            await commandExecutor.execute(driver, `/*!${serverVer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            await commandExecutor.execute(driver, `/*!${higherServer} select * from sakila.actor;*/`, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK, 0 records retrieved/);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Pie Graph based on DB table", async () => {
        try {
            await commandExecutor.languageSwitch(driver, "\\ts ", true);
            await commandExecutor.execute(driver,
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {series:[{type: "bar", yLabel: "Actors", data: res as IJsonGraphData}]};
                Graph.render(options);`);

            expect(commandExecutor.getResultMessage()).toMatch(/graph/);
            const pieChart = commandExecutor.getResultContent();
            const chartColumns = await (pieChart as WebElement)
                .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).toBeGreaterThan(0);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Using a DELIMITER", async () => {
        try {
            await commandExecutor.languageSwitch(driver, "\\sql");
            const query =
                `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$


                    select 1 $$
                `;

            await commandExecutor.executeWithButton(driver, query, constants.execFullBlockSql, true);
            expect(commandExecutor.getResultMessage()).toMatch(/OK/);
            const content = commandExecutor.getResultContent() as unknown as interfaces.ICommandTabResult[];
            expect(content.length).toBe(2);
            for (const result of content) {
                expect(result.tabName).toMatch(/Result/);
            }
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Add a new console", async () => {
        try {

            await driver.executeScript(
                "arguments[0].click()",
                await driver.findElement(locator.notebook.explorerHost.openEditors.addConsole),
            );

            const input = await driver.wait(until.elementLocated(locator.notebook.explorerHost.openEditors.textBox),
                explicitWait, "Editor host input was not found");
            await input.sendKeys(Key.BACK_SPACE);
            await input.sendKeys("myNewConsole");
            await input.sendKeys(Key.ENTER);
            expect(await DBConnection.getOpenEditor(driver, "myNewConsole")).toBeDefined();
            const documentSelector = await driver.findElement(locator.notebook.toolbar.editorSelector.exists);
            const currentValue = await documentSelector
                .findElement(locator.notebook.toolbar.editorSelector.currentValue);
            expect(await currentValue.getText()).toBe("myNewConsole");
            const currentIcon = documentSelector.findElement(locator.notebook.toolbar.editorSelector.currentIcon);
            expect(await currentIcon.getAttribute("style")).toContain("notebook");
            await driver
                .findElement(locator.notebook.exists)
                .findElement(locator.notebook.codeEditor.textArea)
                .sendKeys("select actor from actor");

            await DBConnection.selectCurrentEditor(driver, "DB Notebook", "notebook");
            await DBConnection.selectCurrentEditor(driver, "myNewConsole", "notebook");
            const console = await DBConnection.getOpenEditor(driver, "myNewConsole");
            await console!.findElement(locator.notebook.explorerHost.openEditors.close).click();
            expect(await DBConnection.getOpenEditor(driver, "myNewConsole")).toBeUndefined();
            expect(
                await documentSelector.findElement(locator.notebook.toolbar.editorSelector.currentValue).getText(),
            ).toContain("DB Notebook");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Save the notebook", async () => {
        const outDir = process.env.USERPROFILE ?? process.env.HOME;
        let notebook = "";
        try {
            await commandExecutor.clean(driver);
            await commandExecutor.execute(driver, "SELECT VERSION();");
            expect(commandExecutor.getResultMessage()).toMatch(/1 record retrieved/);
            await (await DBNotebooks.getToolbarButton(driver, constants.saveNotebook))!.click();
            await driver.wait(async () => {
                const files = await fs.readdir(String(outDir));
                for (const file of files) {
                    if (file.includes(".mysql-notebook")) {
                        notebook = join(String(outDir), file);
                        try {
                            const file = await fs.readFile(notebook);
                            JSON.parse(file.toString());

                            return true;
                        } catch (e) {
                            // continue
                        }
                    }
                }
            }, constants.wait10seconds, `No file with extension '.mysql-notebook' was found at ${outDir}`);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await fs.unlink(notebook).catch(() => {
                // continue
            });
        }
    });

    it("Valid and invalid json", async () => {
        try {
            await commandExecutor.languageSwitch(driver, "\\ts ");
            await commandExecutor.execute(driver, `print('{"a": "b"}')`);
            await driver.wait(async () => {
                return ShellSession.isJSON(driver);
            }, explicitWait, "Result is not a valid json");

            await commandExecutor.execute(driver, `print('{ a: b }')`);
            expect(commandExecutor.getResultMessage()).toBe("{ a: b }");
            await driver.wait(async () => {
                return !(await ShellSession.isJSON(driver));
            }, explicitWait, "Result should not be a valid json");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Copy to clipboard button", async () => {
        // this test requires the headless OFF
        const headlessOffDriver = await Misc.loadDriver(false);
        try {
            await headlessOffDriver.wait(async () => {
                try {
                    await Misc.waitForHomePage(headlessOffDriver, url);

                    return true;
                } catch (e) {
                    await headlessOffDriver.navigate().refresh();
                }
            }, explicitWait * 4, "Home Page was not loaded");

            const anotherConnection = globalConn;
            anotherConnection.caption = `${globalConn.caption}-headlessOn`;
            await headlessOffDriver.executeScript("arguments[0].click()",
                await headlessOffDriver.findElement(locator.sqlEditorPage.icon));
            const db = await DBNotebooks.createDBconnection(headlessOffDriver, anotherConnection);
            await headlessOffDriver.executeScript("arguments[0].click();", db);
            try {
                await Misc.setPassword(headlessOffDriver, anotherConnection);
                await Misc.setConfirmDialog(headlessOffDriver, anotherConnection, "no");
            } catch (e) {
                if ((e as Error).message.match(/No Password dialog was found/) === null) {
                    throw e;
                }
            }
            await headlessOffDriver.wait(until.elementLocated(locator.notebook.toolbar.exists),
                explicitWait * 2, "Notebook was not loaded");

            const otherCommandExecutor = new CommandExecutor();
            await otherCommandExecutor.refreshCommandResult(headlessOffDriver, otherCommandExecutor.getResultId());
            await otherCommandExecutor.copyResultToClipboard(headlessOffDriver);
            await otherCommandExecutor.clean(headlessOffDriver);
            const textArea = await headlessOffDriver.findElement(locator.notebook.codeEditor.textArea);
            if (platform() === "darwin") {
                await textArea.sendKeys(Key.chord(Key.COMMAND, "v"));
            } else {
                await textArea.sendKeys(Key.chord(Key.CONTROL, "v"));
            }
            expect(await DBNotebooks.existsOnNotebook(headlessOffDriver, "Welcome")).toBe(true);
        } catch (e) {
            testFailed = true;
            throw e;
        } finally {
            await headlessOffDriver.close();
            await headlessOffDriver.quit();
        }
    });

    it("Schema autocomplete context menu", async () => {
        try {
            await commandExecutor.languageSwitch(driver, "\\sql ", true);
            await commandExecutor.write(driver, "select sak", true);
            await commandExecutor.openSuggestionMenu(driver);
            let els = await DBNotebooks.getAutoCompleteMenuItems(driver);
            expect(els.toString()).toMatch(/sakila/);
            const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write(driver, "ila.", true);
            await commandExecutor.openSuggestionMenu(driver);
            els = await DBNotebooks.getAutoCompleteMenuItems(driver);
            expect(els.toString()).toMatch(/(actor|address|category)/);
            await textArea.sendKeys(Key.ESCAPE);
            await commandExecutor.write(driver, "actor.", true);
            await commandExecutor.openSuggestionMenu(driver);
            els = await DBNotebooks.getAutoCompleteMenuItems(driver);
            expect(els.toString()).toMatch(/(actor_id|first_name|last_name)/);
            await textArea.sendKeys(Key.ESCAPE);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Verify all mysql data types", async () => {
        await commandExecutor.clean(driver);
        await commandExecutor.execute(driver, "SELECT * from sakila.all_in_table_1;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        const varChar = await commandExecutor.getCellFromResultGrid(driver, 0, 1);
        const decimal = await commandExecutor.getCellFromResultGrid(driver, 0, 2);
        const dateTime = await commandExecutor.getCellFromResultGrid(driver, 0, 3);
        const blob = await commandExecutor.getCellFromResultGrid(driver, 0, 4);
        const binary = await commandExecutor.getCellFromResultGrid(driver, 0, 5);
        const longBlob = await commandExecutor.getCellFromResultGrid(driver, 0, 6);
        const medBlob = await commandExecutor.getCellFromResultGrid(driver, 0, 7);
        const tinyBlob = await commandExecutor.getCellFromResultGrid(driver, 0, 8);
        const varBinary = await commandExecutor.getCellFromResultGrid(driver, 0, 9);
        expect(await varChar!.getText()).toMatch(/([a-z]|[A-Z])/);
        expect(await decimal!.getText()).toMatch(/[0-9]/);
        expect(await dateTime!.getText()).toMatch(/(\d+)\/(\d+)\/(\d+)/);
        expect(await commandExecutor.getCellIconType(blob!)).toBe(constants.blob);
        expect(await binary!.getText()).toMatch(/0x.*/);
        expect(await commandExecutor.getCellIconType(longBlob!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(medBlob!)).toBe(constants.blob);
        expect(await tinyBlob?.getText()).toMatch(/0x.*/);
        expect(await varBinary!.getText()).toMatch(/0x.*/);

        await commandExecutor.execute(driver, "SELECT * from sakila.all_in_table_2;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);
        const date = await commandExecutor.getCellFromResultGrid(driver, 0, 0);
        const time = await commandExecutor.getCellFromResultGrid(driver, 0, 2);
        const timeStamp = await commandExecutor.getCellFromResultGrid(driver, 0, 3);
        const year = await commandExecutor.getCellFromResultGrid(driver, 0, 4);
        const geometry = await commandExecutor.getCellFromResultGrid(driver, 0, 5);
        const geometryCollection = await commandExecutor.getCellFromResultGrid(driver, 0, 6);
        const lineString = await commandExecutor.getCellFromResultGrid(driver, 0, 7);
        const multiLineString = await commandExecutor.getCellFromResultGrid(driver, 0, 8);
        const multiPoint = await commandExecutor.getCellFromResultGrid(driver, 0, 9);
        const multiPolygon = await commandExecutor.getCellFromResultGrid(driver, 0, 10);
        const point = await commandExecutor.getCellFromResultGrid(driver, 0, 11);
        const polygon = await commandExecutor.getCellFromResultGrid(driver, 0, 12);

        expect(await date!.getText()).toMatch(/(\d+)\/(\d+)\/(\d+)/);
        expect(await time!.getText()).toMatch(/(\d+):(\d+):(\d+)/);
        expect(await timeStamp!.getText()).toMatch(/(\d+)\/(\d+)\/(\d+)/);
        expect(await year!.getText()).toMatch(/(\d+)/);
        expect(await commandExecutor.getCellIconType(geometry!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(geometryCollection!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(lineString!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(multiLineString!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(multiPoint!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(multiPolygon!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(point!)).toBe(constants.blob);
        expect(await commandExecutor.getCellIconType(polygon!)).toBe(constants.blob);

        await commandExecutor.execute(driver, "SELECT * from sakila.all_in_table_3;");
        expect(commandExecutor.getResultMessage()).toMatch(/OK/);

        const json = await commandExecutor.getCellFromResultGrid(driver, 0, 1);
        const char = await commandExecutor.getCellFromResultGrid(driver, 0, 2);
        const longText = await commandExecutor.getCellFromResultGrid(driver, 0, 4);
        const medText = await commandExecutor.getCellFromResultGrid(driver, 0, 5);
        const tinyText = await commandExecutor.getCellFromResultGrid(driver, 0, 6);
        const bit = await commandExecutor.getCellFromResultGrid(driver, 0, 7);
        const boolField = await commandExecutor.getCellFromResultGrid(driver, 0, 8);
        const enumField = await commandExecutor.getCellFromResultGrid(driver, 0, 9);
        const setField = await commandExecutor.getCellFromResultGrid(driver, 0, 10);

        expect(await json?.getText()).toMatch(/.*{.*}/);
        expect(await char!.getText()).toMatch(/([a-z]|[A-Z])/);
        expect(await longText!.getText()).toMatch(/([a-z]|[A-Z])/);
        expect(await medText!.getText()).toMatch(/([a-z]|[A-Z])/);
        expect(await tinyText!.getText()).toMatch(/([a-z]|[A-Z])/);
        expect(await bit!.getText()).toMatch(/(\d+)/);
        expect(await boolField?.getText()).toMatch(/(\d+)/);
        expect(await enumField!.getText()).toMatch(/(\d+)/);
        expect(await setField!.getText()).toMatch(/(\d+)/);
    });
});
