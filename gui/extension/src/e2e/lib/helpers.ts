/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import {
    WebDriver,
    WebElement,
    By,
    EditorView,
    until,
    Button,
    Key as key,
} from "vscode-extension-tester";

import { expect } from "chai";
import { keyboard, Key } from "@nut-tree/nut-js";
import { ChildProcess, spawn } from "child_process";
import { join } from "path";
import { platform, homedir } from "os";

export interface IContextMenu {
    dbActionsRestartShellProcess: number;
    dbActionsConnectShellProcess: number;
    dbActionsRelaunchWizard: number;
    dbResetWelcomeWizard: number;
    dbOpenConn: number;
    dbOpenConnNewTab: number;
    dbOpenConsole: number;
    dbEdit: number;
    dbDuplicate: number;
    dbDelete: number;
    dbShowSchemas: number;
    dbLoadDumpFromDisk: number;
    dbConfigRest: number;
    schemaDrop: number;
    tableShowData: number;
    tableAddRest: number;
    tableDrop: number;
}

export interface IDbConnection {
    caption: string;
    description: string;
    hostname: string;
    username: string;
    port: number;
    schema: string;
    password: string;
}

export const getLeftSection = async (driver: WebDriver, name: string): Promise<WebElement> => {
    // eslint-disable-next-line no-useless-escape
    const leftSideBar = await driver.findElement(By.id("workbench\.view\.extension\.msg-view"));
    const sections = await leftSideBar.findElements(By.css(".split-view-view.visible"));
    let ctx: WebElement | undefined;
    for (const section of sections) {
        if (await section.findElement(By.css("h3.title")).getText() === name) {
            ctx = section;
            break;
        }
    }
    expect(ctx).to.exist;

    return ctx!;
};

export const getLeftSectionButton = async (driver: WebDriver,
    sectionName: string,
    buttonName: string): Promise<WebElement> => {
    const section = await getLeftSection(driver, sectionName);
    expect(section).to.exist;
    await section.click();

    let btn: WebElement | undefined;
    const buttons = await section.findElements(By.css(".actions a"));
    for (const button of buttons) {
        const title = await button.getAttribute("title");
        if (title === buttonName) {
            btn = button;
            break;
        }
    }

    await section.click();
    await driver.wait(until.elementIsVisible(btn!), 2000, "Create new connection is not visible");

    return btn!;
};

export const createDBconnection = async (driver: WebDriver, dbConfig: IDbConnection): Promise<void> => {
    const createConnBtn = await getLeftSectionButton(driver, "DATABASE", "Create New MySQL Connection");
    await createConnBtn?.click();

    const editorView = new EditorView();
    const editor = await editorView.openEditor("SQL Connections");
    expect(await editor.getTitle()).to.equals("SQL Connections");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));

    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
    await driver.wait(async () => {
        await newConDialog.findElement(By.id("caption")).clear();

        return !(await driver.executeScript("return document.querySelector('#caption').value"));
    }, 3000, "caption was not cleared in time");
    await newConDialog.findElement(By.id("caption")).sendKeys(dbConfig.caption);
    await newConDialog.findElement(By.id("description")).clear();
    await newConDialog
        .findElement(By.id("description"))
        .sendKeys(dbConfig.description);
    await newConDialog.findElement(By.id("hostName")).clear();
    await newConDialog.findElement(By.id("hostName")).sendKeys(dbConfig.hostname);
    await driver.findElement(By.css("#port input")).clear();
    await driver.findElement(By.css("#port input")).sendKeys(dbConfig.port);
    await newConDialog.findElement(By.id("userName")).sendKeys(dbConfig.username);
    await newConDialog
        .findElement(By.id("defaultSchema"))
        .sendKeys(dbConfig.schema);

    await newConDialog.findElement(By.id("storePassword")).click();
    const passwordDialog = await driver.findElement(By.css(".passwordDialog"));
    await passwordDialog.findElement(By.css("input")).sendKeys(dbConfig.password);
    await passwordDialog.findElement(By.id("ok")).click();

    const okBtn = await driver.findElement(By.id("ok"));
    await driver.executeScript("arguments[0].scrollIntoView(true)", okBtn);
    await okBtn.click();
    await driver.switchTo().defaultContent();
};

export const getDB = async (driver: WebDriver, name: string): Promise<WebElement> => {
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));
    const db = await driver.wait(async () => {
        const hosts = await driver.findElements(By.css("#tilesHost button"));
        for (const host of hosts) {
            try {
                const el = await host.findElement(By.css(".textHost .tileCaption"));
                if ((await el.getText()) === name) {
                    return host;
                }
            } catch (e) {
                return undefined;
            }
        }

        return undefined;
    }, 5000, "No DB was found");

    await driver.switchTo().defaultContent();

    return db!;
};

export const selectItem = async (taps: number): Promise<void> => {
    for (let i = 1; i <= taps; i++) {
        await keyboard.type(Key.Down);
    }
    await keyboard.type(Key.Enter);
};

export const startServer = async (driver: WebDriver): Promise<ChildProcess> => {
    const params = ["--py", "-e", "gui.start.web_server(port=8000)"];
    const prc = spawn("mysqlsh", params, {
        env: {
            detached: "true",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            PATH: process.env.PATH,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            MYSQLSH_USER_CONFIG_HOME: join(homedir(), ".mysqlsh"),
            stdio: "inherit",
        },
    });

    let serverOutput = "";
    let serverErr = "";
    prc.stdout.on("data", (data) => {
        serverOutput += data as string;
    });
    prc.stderr.on("data", (data) => {
        serverErr += data as string;
    });

    try {
        await driver.wait( () => {
            if (serverOutput.indexOf("Starting MySQL Shell GUI web server...") !== -1) {
                return true;
            }
        }, 10000, "mysqlsh server was not started correctly");
    } catch (e) {
        prc.kill();
        throw serverErr[serverErr.length - 1];
    }

    return prc;
};

export const setDBEditorPassword = async (driver: WebDriver, dbConfig: IDbConnection): Promise<void> => {
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame\\:" + dbConfig.caption)));

    const dialog = await driver.wait(until.elementLocated(
        By.css(".passwordDialog")), 10000, "No password dialog was found");
    const title = await dialog.findElement(By.css(".title .label"));
    const gridDivs = await dialog.findElements(By.css("div.grid > div"));

    let service;
    let username;
    for (let i = 0; i <= gridDivs.length - 1; i++) {
        if (await gridDivs[i].getText() === "Service:") {
            service = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
        }
        if (await gridDivs[i].getText() === "User Name:") {
            username = await gridDivs[i + 1].findElement(By.css(".resultText span")).getText();
        }
    }

    expect(service).to.equals(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);
    expect(username).to.equals(dbConfig.username);

    expect(await title.getText()).to.equals("Open MySQL Connection in Shell Session");

    await dialog.findElement(By.css("input")).sendKeys(dbConfig.password);
    await dialog.findElement(By.id("ok")).click();
    await driver.switchTo().defaultContent();
};

export const setFeedbackRequested = async (driver: WebDriver,
    dbConfig: IDbConnection, value: string): Promise<void> => {
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame\\:" + dbConfig.caption)));

    const feedbackDialog = await driver.wait(until.elementLocated(
        By.css(".valueEditDialog")), 5000, "Feedback Requested dialog was not found");
    expect(await feedbackDialog.findElement(By.css(".title label")).getText()).to.equals("Feedback Requested");

    expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
        .to.contain(`${dbConfig.username}@${dbConfig.hostname}:${dbConfig.port}`);

    expect(await feedbackDialog.findElement(By.css(".valueTitle")).getText())
        .to.contain("? [Y]es/[N]o/Ne[v]er (default No):");

    await feedbackDialog.findElement(By.css("input")).sendKeys(value);
    await feedbackDialog.findElement(By.id("ok")).click();
    await driver.switchTo().defaultContent();
};

export const getTreeElement = async (driver: WebDriver, section: string, el: string): Promise<WebElement> => {
    const sec = await getLeftSection(driver, section);

    return sec?.findElement(By.xpath("//div[contains(@aria-label, '" + el + "')]"));
};

export const toggleTreeElement = async (driver: WebDriver, section: string, el: string): Promise<void> => {
    const element = await getTreeElement(driver, section, el);
    const toggle = await element?.findElement(By.css(".codicon-tree-item-expanded"));
    await toggle?.click();
};

export const toggleSection = async (driver: WebDriver, section: string, open: boolean): Promise<void> => {
    await driver.wait(async () => {
        const btn = await driver.findElement(By.xpath("//div[contains(@aria-label, '" + section + " Section')]/div"));
        await driver.executeScript("arguments[0].click()", btn);
        const el = await driver.findElement(By.xpath("//div[contains(@aria-label, '" + section + " Section')]"));
        const result = JSON.parse(await el.getAttribute("aria-expanded"));
        if (open) {
            if (result) {
                return true;
            } else {
                return false;
            }
        } else {
            if (result) {
                return false;
            } else {
                return true;
            }
        }
    }, 2000, "Toggle was not expanded/collapsed");
};

export const welcomeMySQLShell = async (): Promise<boolean> => {
    const editorView = new EditorView();
    const tabs = await editorView.getOpenTabs();
    let flag = false;
    for (const tab of tabs) {
        if (await tab.getTitle() === "Welcome to MySQL Shell") {
            flag = true;
        }
    }

    return flag;
};

export const deleteDBConnection = async (driver: WebDriver, dbName: string,
    ctx: IContextMenu): Promise <void> => {
    const el = await getTreeElement(driver, "DATABASE", dbName);
    expect(el).to.exist;

    await driver.actions()
        .mouseMove(el)
        .click(Button.RIGHT)
        .perform();

    await driver.sleep(500);
    await selectItem(ctx.dbDelete);

    const editorView = new EditorView();
    await driver.wait(async () => {
        const activeTab = await editorView.getActiveTab();

        return await activeTab?.getTitle() === "SQL Connections";
    }, 3000, "error");

    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));


    const dialog = await driver.wait(until.elementLocated(
        By.css(".visible.confirmDialog")), 7000, "confirm dialog was not found");
    await dialog.findElement(By.id("accept")).click();

    const item = driver.findElement(By.xpath("//label[contains(text(),'" + dbName + "')]"));
    await driver.wait(until.stalenessOf(item), 5000, "Database was not deleted");
    await driver.switchTo().defaultContent();
};

export const clearPassword = async (driver: WebDriver, dbName: string): Promise <void> => {
    const el = await getTreeElement(driver, "DATABASE", dbName);
    expect(el).to.exist;

    await driver.actions()
        .mouseMove(el)
        .click(Button.RIGHT)
        .perform();

    await driver.sleep(500);
    await selectItem(4);
    const editorView = new EditorView();
    const editors = await editorView.getOpenEditorTitles();
    expect(editors.includes("SQL Connections")).to.be.true;
    await driver.switchTo().frame(0);
    await driver.switchTo().frame(await driver.findElement(By.id("active-frame")));
    await driver.switchTo().frame(await driver.findElement(By.id("frame:SQL Connections")));
    const newConDialog = await driver.findElement(By.css(".valueEditDialog"));
    await newConDialog.findElement(By.id("Clear Password")).click();
    await driver.switchTo().defaultContent();
};

export const pressEnter = async (driver: WebDriver): Promise<void> => {
    if (platform() === "win32") {
        await driver
            .actions()
            .keyDown(key.CONTROL)
            .sendKeys(key.ENTER)
            .keyUp(key.CONTROL)
            .perform();
    } else if (platform() === "darwin") {
        await driver
            .actions()
            .keyDown(key.COMMAND)
            .sendKeys(key.ENTER)
            .keyUp(key.COMMAND)
            .perform();
    }
};

export const enterCmd = async (driver: WebDriver, textArea: WebElement, cmd: string): Promise<void> => {
    cmd = cmd.replace(/(\r\n|\n|\r)/gm, "");
    const prevBlocks = await driver.findElements(By.css(".zoneHost"));
    await textArea.sendKeys(cmd);
    await textArea.sendKeys(key.ENTER);
    await pressEnter(driver);

    if (cmd !== "\\q") {
        await driver.wait(async () => {
            const blocks = await driver.findElements(By.css(".zoneHost"));

            return blocks.length > prevBlocks.length;
        }, 3000, "Command '" + cmd + "' did not triggered a new results block");
    }
};

const existsAboutInformation = async (driver: WebDriver): Promise<boolean> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    const span = await zoneHosts[0].findElements(By.css("span"));
    let flag = false;
    if (span.length > 0) {
        if ((await span[0].getText()).indexOf("Welcome") !== -1) {
            flag = true;
        }
    }

    return flag;
};

export const getOutput = async (driver: WebDriver, blockNbr: number): Promise<string> => {
    const zoneHosts = await driver.findElements(By.css(".zoneHost"));
    let context;
    if (await existsAboutInformation(driver)) {
        context = zoneHosts[blockNbr]; //first element is the about information
    } else {
        context = zoneHosts[blockNbr - 1];
    }

    let items = await context.findElements(By.css("label"));
    const otherItems = await context.findElements(By.css(".textHost span"));
    let text;

    if (items.length > 0) {
        text = await items[0].getText();
    } else if (otherItems.length > 0) {
        text = await otherItems[0].getText();
    } else {
        items = await context.findElements(By.css(".info"));
        text = await items[0].getText();
    }

    return text;
};

export const setEditorLanguage = async (driver: WebDriver, language: string): Promise<void> => {

    const contentHost = await driver.wait(until.elementLocated(
        By.id("shellEditorHost")), 15000, "Console was not loaded");

    const textArea = await contentHost.findElement(By.css("textarea"));
    await enterCmd(driver, textArea, "\\" + language.replace("my", ""));
    const result = await getOutput(driver, 1);
    switch (language) {
        case "sql":
            expect(result).to.contain("Switching to SQL mode");
            break;
        case "js":
            expect(result).equals("Switched to Javascript mode");
            break;
        case "ts":
            expect(result).equals("Switched to Typescript mode");
            break;
        default:
            break;
    }
};