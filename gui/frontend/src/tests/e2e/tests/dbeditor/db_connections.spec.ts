/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { promises as fsPromises } from "fs";
import { loadDriver, loadPage, driver } from "../../lib/engine";
import { By, until, Key, WebElement } from "selenium-webdriver";
import {
    IDBConnection,
    waitForHomePage,
    selectDatabaseType,
    selectProtocol,
    getDB,
    createDBconnection,
    getSelectedConnectionTab,
    getToolbarButton,
    getResultStatus,
    getSchemaObject,
    toggleSchemaObject,
    setEditorLanguage,
    setDBEditorPassword,
    closeDBconnection,
    setConfirmDialog,
    initConDialog,
    isConnectionOverviewOpened,
    explicitWait,
} from "../../lib/helpers";

describe("Database Connections", () => {

    let testFailed = false;

    const globalConn: IDBConnection = {
        dbType: undefined,
        caption: `conn${new Date().valueOf()}`,
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        protocol: "mysql",
        username: String(process.env.DBUSERNAME),
        port: String(process.env.DBPORT),
        portX: String(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    beforeAll(async () => {
        await loadDriver();
        try {
            await loadPage(String(process.env.SHELL_UI_HOSTNAME));
            await waitForHomePage();
        } catch (e) {
            await driver.navigate().refresh();
            await waitForHomePage();
        }

        await driver.findElement(By.id("gui.sqleditor")).click();
        await initConDialog();
        await createDBconnection(globalConn, true);
    });

    afterEach(async () => {
        if (testFailed) {
            testFailed = false;
            const img = await driver.takeScreenshot();
            const testName: string = expect.getState().currentTestName
                .toLowerCase().replace(/\s/g, "_");
            try {
                await fsPromises.access("src/tests/e2e/screenshots");
            } catch (e) {
                await fsPromises.mkdir("src/tests/e2e/screenshots");
            }
            await fsPromises.writeFile(`src/tests/e2e/screenshots/${testName}_screenshot.png`, img, "base64");
        }

        if (!await isConnectionOverviewOpened()) {
            await closeDBconnection("current");
        }
    });

    afterAll(async () => {
        await driver.quit();
    });


    it("Store and clear Password", async () => {

        try {

            const host = await getDB(globalConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            const contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            const conDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await conDialog.findElement(By.id("clearPassword")).click();
            await conDialog.findElement(By.id("ok")).click();

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(globalConn.caption),
            );

            expect(await driver.wait(until.elementLocated(By.css(".passwordDialog")),
                explicitWait, "Password dialog was not displayed")).toBeDefined();
            await driver.findElement(By.id("cancel")).click();
            const error = await driver.wait(until.elementLocated(By.css(".errorPanel button")),
                explicitWait, "Error panel was not displayed");

            await error.click();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Confirm dialog - Save password", async () => {
        try {

            const localConn: IDBConnection = {
                dbType: undefined,
                caption:  `conn${new Date().valueOf()}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: String(process.env.DBUSERNAME1),
                port: String(process.env.DBPORT),
                portX: String(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBUSERNAME1),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            await createDBconnection(localConn, false, true);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(localConn.caption),
            );

            await setDBEditorPassword(localConn);

            await setConfirmDialog(localConn, "yes");

            expect(await (await getSelectedConnectionTab()).getText())
                .toBe(localConn.caption);

            await closeDBconnection(localConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await getDB(localConn.caption),
            );

            expect(await (await getSelectedConnectionTab()).getText())
                .toBe(localConn.caption);

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Duplicate a database connection", async () => {
        try {

            const host = await getDB(globalConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            const contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("duplicate")),
            );

            const conDialog = await driver.findElement(By.css(".valueEditDialog"));

            await driver.wait(async () => {
                await conDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const dup = `Dup${String(Math.floor(Math.random() * 100))}`;

            await conDialog.findElement(By.id("caption")).sendKeys(dup);

            await conDialog.findElement(By.id("description")).clear();

            await conDialog
                .findElement(By.id("description"))
                .sendKeys("my other connection");

            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

            const conn = await getDB(dup);

            expect(conn).toBeDefined();

            expect(await conn!.findElement(By.css(".tileDescription")).getText())
                .toBe("my other connection");
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a database connection", async () => {
        try {

            const localConn: IDBConnection = {
                dbType: undefined,
                caption: `conn${new Date().valueOf()}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: String(process.env.DBUSERNAME),
                port: String(process.env.DBPORT),
                portX: String(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            await createDBconnection(localConn);

            let host = await getDB(localConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            let contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            let conDialog = await driver.findElement(By.css(".valueEditDialog"));

            await driver.wait(async () => {
                await conDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `Wex${String(Math.floor(Math.random() * 100))}`;

            await conDialog.findElement(By.id("caption")).sendKeys(conName);

            await conDialog.findElement(By.id("description")).clear();

            await conDialog
                .findElement(By.id("description"))
                .sendKeys("Another description");

            await conDialog.findElement(By.id("hostName")).clear();

            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

            await selectProtocol("mysqlx");

            expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

            let okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);

            const conn = await getDB(conName);

            expect(conn).toBeDefined();

            expect(await conn!.findElement(By.css(".tileDescription")).getText())
                .toBe("Another description");

            host = await getDB(conName);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            conDialog = await driver.findElement(By.css(".valueEditDialog"));

            expect(
                await conDialog.findElement(By.css("#databaseType label")).getText(),
            ).toBe("MySQL");

            expect(
                await conDialog.findElement(By.id("caption")).getAttribute("value"),
            ).toBe(conName);

            expect(
                await conDialog.findElement(By.id("description")).getAttribute("value"),
            ).toBe("Another description");

            expect(await conDialog.findElement(By.css("#scheme label")).getText()).toBe("mysqlx");

            expect(
                await conDialog.findElement(By.id("hostName")).getAttribute("value"),
            ).toBe("1.1.1.1");

            okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect((await driver.findElements(By.css(".valueEditDialog"))).length).toBe(0);
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Edit a database connection and verify errors", async () => {
        try {

            const host = await getDB(globalConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            const contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("edit")),
            );

            const conDialog = await driver.findElement(By.css(".valueEditDialog"));

            const customClear = async (el: WebElement) => {
                const textLength = (await el.getAttribute("value")).length;
                for (let i = 0; i <= textLength - 1; i++) {
                    await el.sendKeys(Key.BACK_SPACE);
                    await driver.sleep(100);
                }
            };

            await customClear(await conDialog.findElement(By.id("caption")));

            const okBtn = await conDialog.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const error = await driver.wait(
                until.elementLocated(By.css("label.error")),
                2000,
            );

            expect(await error.getText()).toBe("The caption cannot be empty");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

            await conDialog.findElement(By.id("caption")).sendKeys("WexQA");

            await customClear(await conDialog.findElement(By.id("hostName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .toBe("Specify a valid host name or IP address");

            expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

            await conDialog.findElement(By.id("hostName")).sendKeys("1.1.1.1");

            await customClear(await conDialog.findElement(By.id("userName")));

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await driver.findElement(By.id("ok")).click();

            expect(await conDialog.findElement(By.css("label.error")).getText())
                .toBe("The user name must not be empty");

            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            expect(await conDialog.findElement(By.id("ok")).isEnabled()).toBe(false);

            await driver.findElement(By.id("cancel")).click();
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Remove a database connection", async () => {
        try {

            const localConn: IDBConnection = {
                dbType: undefined,
                caption: `conn${new Date().valueOf()}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: String(process.env.DBUSERNAME),
                port: String(process.env.DBPORT),
                portX: String(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            await createDBconnection(localConn);

            const host = await getDB(localConn.caption);

            await driver.executeScript(
                "arguments[0].click();",
                await host!.findElement(By.id("triggerTileAction")),
            );

            const contextMenu = await driver.wait(
                until.elementLocated(By.css(".noArrow.menu")),
                2000,
            );

            expect(contextMenu).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await contextMenu.findElement(By.id("remove")),
            );

            const dialog = await driver.findElement(By.css(".confirmDialog"));

            expect(dialog).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                await dialog.findElement(By.id("accept")),
            );

            await driver.wait(
                async () => {
                    return (await driver.findElements(
                        By.xpath("//label[contains(text(), '" + localConn.caption + "')]"))).length === 0;
                },
                2000,
                "DB still exists",
            );
        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

    it("Connect to SQLite database", async () => {
        try {
            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                explicitWait, "Connection browser was not found");
            await connBrowser.findElement(By.id("-1")).click();

            const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await selectDatabaseType("Sqlite");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const localConn: IDBConnection = {
                dbType: undefined,
                caption: `Sqlite DB${String(new Date().valueOf())}`,
                description: "Local connection",
                hostname: String(process.env.DBHOSTNAME),
                protocol: "mysql",
                username: String(process.env.DBUSERNAME),
                port: String(process.env.DBPORT),
                portX: String(process.env.DBPORTX),
                schema: "sakila",
                password: String(process.env.DBPASSWORD),
                sslMode: undefined,
                sslCA: undefined,
                sslClientCert: undefined,
                sslClientKey: undefined,
            };

            await newConDialog.findElement(By.id("caption")).sendKeys(localConn.caption);

            await newConDialog.findElement(By.id("description")).clear();
            await newConDialog
                .findElement(By.id("description"))
                .sendKeys("Local Sqlite connection");

            const inputs = await newConDialog.findElements(By.css("input.msg.input"));
            let dbPath: WebElement;
            for (const input of inputs) {
                if (!(await input.getAttribute("id"))) {
                    dbPath = input;
                }
            }

            await dbPath!.sendKeys(String(process.env.SQLITE_PATH_FILE));
            await newConDialog.findElement(By.id("dbName")).sendKeys("SQLite");
            await newConDialog.findElement(By.id("ok")).click();

            const conn = await getDB(localConn.caption);
            expect(conn).toBeDefined();
            expect(await conn!.findElement(By.css(".tileDescription")).getText()).toBe(
                "Local Sqlite connection",
            );

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            expect(await (await getSelectedConnectionTab()).getText()).toBe(localConn.caption);

            await toggleSchemaObject("Schema", "main");

            const main = await getSchemaObject("Schema", "main");
            const attr = await main!.getAttribute("class");
            expect(attr.split(" ").includes("expanded")).toBe(true);

            await toggleSchemaObject("Tables", "Tables");

            const tables = await getSchemaObject("Tables", "Tables");

            expect(
                await (
                    await tables!.findElement(By.css("span.treeToggle"))
                ).getAttribute("class"),
            ).toContain("expanded");

            const table = await getSchemaObject("obj", "db_connection");

            await driver.wait(async () => {
                await driver
                    .actions()
                    .contextClick(table)
                    .perform();

                return (await driver.findElements(By.css(".noArrow.menu"))).length > 0;
            }, 4000, "Context menu was not opened");

            await driver.findElement(By.id("selectRowsMenuItem")).click();

            expect(await getResultStatus(true)).toContain("OK");

            const resultSet = await driver.findElement(
                By.css(".resultHost .tabulator-headers"),
            );

            const resultHeaderRows = await resultSet.findElements(
                By.css(".tabulator-col-title"),
            );

            expect(await resultHeaderRows[0].getText()).toBe("id");
            expect(await resultHeaderRows[1].getText()).toBe("db_type");
            expect(await resultHeaderRows[2].getText()).toBe("caption");
            expect(await resultHeaderRows[3].getText()).toBe("description");
        } catch (e) {
            testFailed = true;
            throw e;
        }

    });

    it("Connect to MySQL database using SSL", async () => {
        try {
            const connBrowser = await driver.wait(until.elementLocated(By.css(".connectionBrowser")),
                explicitWait, "Connection browser was not found");

            await connBrowser.findElement(By.id("-1")).click();

            const newConDialog = await driver.wait(until.elementLocated(By.css(".valueEditDialog")),
                explicitWait, "Dialog was not displayed");
            await driver.wait(async () => {
                await newConDialog.findElement(By.id("caption")).clear();

                return !(await driver.executeScript("return document.querySelector('#caption').value"));
            }, 3000, "caption was not cleared in time");

            const conName = `SSL Connection${String(Math.floor(Math.random() * 100))}`;
            await newConDialog.findElement(By.id("caption")).sendKeys(conName);

            await newConDialog.findElement(By.id("description")).clear();

            await newConDialog
                .findElement(By.id("description"))
                .sendKeys("New SSL Connection");

            await newConDialog.findElement(By.id("hostName")).clear();

            await newConDialog
                .findElement(By.id("hostName"))
                .sendKeys(String(globalConn.hostname));

            await newConDialog
                .findElement(By.id("userName"))
                .sendKeys(String(globalConn.username));

            await newConDialog
                .findElement(By.id("defaultSchema"))
                .sendKeys(String(globalConn.schema));

            await newConDialog.findElement(By.id("page1")).click();
            await newConDialog.findElement(By.id("sslMode")).click();
            const dropDownList = await driver.findElement(By.css(".noArrow.dropdownList"));
            await dropDownList.findElement(By.id("Require and Verify CA")).click();
            expect(await newConDialog.findElement(By.css("#sslMode label"))
                .getText()).toBe("Require and Verify CA");

            const paths = await newConDialog.findElements(By.css(".tabview.top input.msg"));
            await paths[0].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/ca.pem`);
            await paths[1].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-cert.pem`);
            await paths[2].sendKeys(`${String(process.env.SSL_ROOT_FOLDER)}/client-key.pem`);

            const okBtn = await driver.findElement(By.id("ok"));
            await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
            await okBtn.click();

            const conn = await getDB(conName);
            expect(conn).toBeDefined();

            await driver.executeScript(
                "arguments[0].click();",
                conn,
            );

            try {
                await setDBEditorPassword(globalConn);
                await setConfirmDialog(globalConn, "yes");
            } catch (e) {
                    //continue
            }

            expect(await (await getSelectedConnectionTab()).getText()).toBe(conName);

            await setEditorLanguage("mysql");

            const contentHost = await driver.findElement(By.id("contentHost"));
            await contentHost
                .findElement(By.css("textarea"))
                .sendKeys("SHOW STATUS LIKE 'Ssl_cipher';");

            const execSel = await getToolbarButton("Execute selection or full block and create a new block");
            await execSel?.click();

            const resultHost = await driver.wait(until.elementLocated(By.css(".resultHost")),
                explicitWait, "Result host was not found");

            const result = await driver.wait(until.elementLocated(async () => {
                return resultHost.findElements(By.css(".resultStatus label"));
            }), explicitWait, "Label not found");

            expect(await result.getText()).toContain("1 record retrieved");

            expect( await resultHost.findElement(By.xpath("//div[contains(text(), 'TLS_AES_256')]")) )
                .toBeDefined();

        } catch (e) {
            testFailed = true;
            throw e;
        }
    });

});