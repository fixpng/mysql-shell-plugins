/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
    WebElement,
    By,
    EditorView,
    until,
    Key,
    error,
    Condition,
} from "vscode-extension-tester";
import { expect } from "chai";
import { basename } from "path";
import { driver, Misc } from "./misc";
import { credentialHelperOk } from "./until";
import * as constants from "./constants";
import * as interfaces from "./interfaces";
import { keyboard, Key as nutKey } from "@nut-tree/nut-js";

export class Database {

    public static setConnection = async (
        dbType: string | undefined,
        caption: string | undefined,
        description: string | undefined,
        basic: interfaces.IConnBasicMySQL | interfaces.IConnBasicSqlite | undefined,
        ssl?: interfaces.IConnSSL,
        advanced?: interfaces.IConnAdvanced,
        mds?: interfaces.IConnMDS,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.css(".visible.valueEditDialog")),
            constants.explicitWait * 5, "Connection dialog was not displayed");

        if (dbType) {
            const inDBType = await dialog.findElement(By.id("databaseType"));
            await inDBType.click();
            const popup = await driver.wait(until.elementLocated(By.id("databaseTypePopup")),
                constants.explicitWait, "Database type popup was not found");
            await popup.findElement(By.id(dbType)).click();
        }

        if (caption) {
            const inCaption = await dialog.findElement(By.id("caption"));
            await inCaption.clear();
            await inCaption.sendKeys(caption);
        }

        if (description) {
            const inDesc = await dialog.findElement(By.id("description"));
            await inDesc.clear();
            await inDesc.sendKeys(description);
        }

        if (dbType === "MySQL") {

            if (basic) {
                await dialog.findElement(By.id("page0")).click();
                if ((basic as interfaces.IConnBasicMySQL).hostname) {
                    const inHostname = await dialog.findElement(By.id("hostName"));
                    await inHostname.clear();
                    await inHostname.sendKeys((basic as interfaces.IConnBasicMySQL).hostname);
                }
                if ((basic as interfaces.IConnBasicMySQL).username) {
                    const inUserName = await dialog.findElement(By.id("userName"));
                    await inUserName.clear();
                    await inUserName.sendKeys((basic as interfaces.IConnBasicMySQL).username);
                }
                if ((basic as interfaces.IConnBasicMySQL).schema) {
                    const inSchema = await dialog.findElement(By.id("defaultSchema"));
                    await inSchema.clear();
                    await inSchema.sendKeys((basic as interfaces.IConnBasicMySQL).schema);
                }
                if ((basic as interfaces.IConnBasicMySQL).port) {
                    const inPort = await dialog.findElement(By.css("#port input"));
                    await inPort.clear();
                    await inPort.sendKeys((basic as interfaces.IConnBasicMySQL).port);
                }
                if ((basic as interfaces.IConnBasicMySQL).ociBastion !== undefined) {
                    await Database.toggleCheckBox("useMDS", (basic as interfaces.IConnBasicMySQL).ociBastion);
                }
            }

            if (ssl) {
                await dialog.findElement(By.id("page1")).click();
                if (ssl.mode) {
                    const inMode = await dialog.findElement(By.id("sslMode"));
                    await inMode.click();
                    const popup = await driver.findElement(By.id("sslModePopup"));
                    await popup.findElement(By.id(ssl.mode)).click();
                }
                if (ssl.caPath) {
                    const inCaPath = await dialog.findElement(By.id("sslCaFile"));
                    await inCaPath.clear();
                    await inCaPath.sendKeys(ssl.caPath);
                }
                if (ssl.clientCertPath) {
                    const inClientCertPath = await dialog.findElement(By.id("sslCertFile"));
                    await inClientCertPath.clear();
                    await inClientCertPath.sendKeys(ssl.clientCertPath);
                }
                if (ssl.clientKeyPath) {
                    const inClientKeyPath = await dialog.findElement(By.id("sslKeyFile"));
                    await inClientKeyPath.clear();
                    await inClientKeyPath.sendKeys(ssl.clientKeyPath);
                }
            }

            if (mds) {
                await dialog.findElement(By.id("page3")).click();
                if (mds.profile) {
                    const inProfile = await dialog.findElement(By.id("profileName"));
                    await inProfile.click();
                    await driver.wait(until.elementLocated(By.id("profileNamePopup")), constants.explicitWait);
                    await driver.wait(until.elementLocated(By.id(mds.profile)), constants.explicitWait).click();
                }
                if (mds.dbSystemOCID) {
                    const inDBSystem = await dialog.findElement(By.id("mysqlDbSystemId"));
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.dbSystemOCID);

                    await dialog.click();
                    const dbSystemName = dialog.findElement(By.id("mysqlDbSystemName"));
                    await driver.wait(new Condition("", async () => {
                        return !(await dbSystemName.getAttribute("value")).includes("Loading");
                    }), constants.ociExplicitWait, "DB System name is still loading");
                }
                if (mds.bastionOCID) {
                    const inDBSystem = await dialog.findElement(By.id("bastionId"));
                    await inDBSystem.clear();
                    await inDBSystem.sendKeys(mds.bastionOCID);

                    await dialog.click();
                    const bastionName = dialog.findElement(By.id("bastionName"));
                    await driver.wait(new Condition("", async () => {
                        return !(await bastionName.getAttribute("value")).includes("Loading");
                    }), constants.ociExplicitWait, "Bastion name is still loading");
                }
            }

        } else if (dbType === "Sqlite") {

            if (basic) {
                await dialog.findElement(By.id("page0")).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inPath = await dialog.findElement(By.id("dbFilePath"));
                    await inPath.clear();
                    await inPath.sendKeys((basic as interfaces.IConnBasicSqlite).dbPath);
                }
                if ((basic as interfaces.IConnBasicSqlite).dbName) {
                    const indbName = await dialog.findElement(By.id("dbName"));
                    await indbName.clear();
                    await indbName.sendKeys((basic as interfaces.IConnBasicSqlite).dbName);
                }
            }

            if (advanced) {
                await dialog.findElement(By.id("page1")).click();
                if ((basic as interfaces.IConnBasicSqlite).dbPath) {
                    const inParams = await dialog.findElement(By.id("otherParameters"));
                    await inParams.clear();
                    await inParams.sendKeys((basic as interfaces.IConnBasicSqlite).advanced.params);
                }
            }
        } else {
            throw new Error("Unknown DB Type");
        }

        await dialog.findElement(By.id("ok")).click();
    };

    public static createConnection = async (dbConfig: interfaces.IDBConnection): Promise<void> => {

        await driver.switchTo().defaultContent();
        await Misc.clickSectionToolbarButton(await Misc.getSection(constants.dbTreeSection),
            constants.createDBConnection);
        await Misc.switchToWebView();
        await driver.wait(until.elementLocated(By.css(".visible.valueEditDialog")),
            constants.explicitWait, "Connection dialog was not displayed").catch(async () => {
                const newConn = await driver.wait(until.elementLocated(By.id("-1")), constants.explicitWait,
                    "New Connection button was not displayed");
                await driver.executeScript("arguments[0].click()", newConn);
            });

        await Database.setConnection(
            dbConfig.dbType,
            dbConfig.caption,
            dbConfig.description,
            dbConfig.basic,
            dbConfig.ssl,
            undefined,
            dbConfig.mds,
        );

        await driver.switchTo().defaultContent();
    };

    public static getWebViewConnection = async (name: string, useFrame = true): Promise<WebElement> => {

        if (useFrame) {
            await Misc.switchToWebView();
        }

        const db = await driver.wait(async () => {
            const hosts = await driver.findElements(By.css("#tilesHost .connectionTile"));
            for (const host of hosts) {
                try {
                    const el = await host.findElement(By.css(".tileCaption"));
                    if ((await el.getText()) === name) {
                        return host;
                    }
                } catch (e) {
                    return undefined;
                }
            }

            return undefined;
        }, constants.explicitWait, "No DB was found");

        if (useFrame) {
            await driver.switchTo().defaultContent();
        }

        return db;
    };

    public static setPassword = async (dbConfig: interfaces.IDBConnection): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(
            By.css(".passwordDialog")), constants.explicitWait, "No password dialog was found");
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

        let uri = `${String((dbConfig.basic as interfaces.IConnBasicMySQL).username)}`;
        uri += `@${String((dbConfig.basic as interfaces.IConnBasicMySQL).hostname)}:`;
        uri += (dbConfig.basic as interfaces.IConnBasicMySQL).port;

        expect(service).to.equals(uri);
        expect(username).to.equals((dbConfig.basic as interfaces.IConnBasicMySQL).username);

        expect(await title.getText()).to.equals("Open MySQL Connection");

        await dialog.findElement(By.css("input")).sendKeys((dbConfig.basic as interfaces.IConnBasicMySQL).password);
        await dialog.findElement(By.id("ok")).click();
    };

    public static isConnectionLoaded = (): Condition<boolean> => {
        return new Condition("DB is not loaded", async () => {
            await driver.switchTo().defaultContent();
            await Misc.switchToWebView();
            const st1 = await driver.findElements(By.css(".msg.portal"));
            const st2 = await driver.findElements(By.css("textarea"));
            const st3 = await driver.findElements(By.id("title"));
            const st4 = await driver.findElements(By.id("resultPaneHost"));

            return st1.length > 0 || st2.length > 0 || st3.length > 0 || st4.length > 0;
        });
    };

    public static requiresCredentials = async (): Promise<boolean> => {
        return (await driver.findElements(By.css(".passwordDialog"))).length > 0;
    };

    public static closeConnection = async (name: string): Promise<void> => {
        await driver.switchTo().defaultContent();
        const edView = new EditorView();
        const editors = await edView.getOpenEditorTitles();
        for (const editor of editors) {
            if (editor === name) {
                await edView.closeEditor(editor);
                break;
            }
        }
    };

    public static selectDatabaseType = async (value: string): Promise<void> => {
        await driver.findElement(By.id("databaseType")).click();
        const dropDownList = await driver.findElement(By.css(".dropdownList"));
        const els = await dropDownList.findElements(By.css("div"));
        if (els.length > 0) {
            await dropDownList.findElement(By.id(value)).click();
        }
    };

    public static getToolbarButton = async (button: string): Promise<WebElement | undefined> => {
        const buttons = await driver.findElements(By.css("#contentHost .msg.button"));
        for (const btn of buttons) {
            if ((await btn.getAttribute("data-tooltip")) === button) {
                return btn;
            }
        }

        throw new Error(`Could not find '${button}' button`);
    };

    public static isStatementStart = async (statement: string): Promise<boolean | undefined> => {

        const getLineSentence = async (ctx: WebElement): Promise<string> => {
            const spans = await ctx.findElements(By.css("span"));
            let sentence = "";
            for (const span of spans) {
                sentence += (await span.getText()).replace("&nbsp;", " ");
            }

            return sentence;
        };

        let flag: boolean | undefined;

        await driver.wait(async () => {
            try {
                const leftSideLines = await driver.findElements(By.css(".margin-view-overlays > div"));
                const rightSideLines = await driver.findElements(
                    By.css(".view-lines.monaco-mouse-cursor-text > div > span"));

                let index = -1;

                for (let i = 0; i <= rightSideLines.length - 1; i++) {
                    const lineSentence = await getLineSentence(rightSideLines[i]);
                    if (lineSentence.includes(statement)) {
                        index = i;
                        break;
                    }
                }

                if (index === -1) {
                    throw new Error(`Could not find statement ${statement}`);
                }

                flag = (await leftSideLines[index].findElements(By.css(".statementStart"))).length > 0;

                return true;
            } catch (e) {
                if (e instanceof error.StaleElementReferenceError) {
                    return false;
                } else {
                    throw e;
                }
            }
        }, constants.explicitWait, "Lines were stale");

        return flag;
    };

    public static findInSelection = async (el: WebElement, flag: boolean): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if ((await action.getAttribute("title")).indexOf("Find in selection") !== -1) {
                const checked = await action.getAttribute("aria-checked");
                if (checked === "true") {
                    if (!flag) {
                        await action.click();
                    }
                } else {
                    if (flag) {
                        await action.click();
                    }
                }

                return;
            }
        }
    };

    public static expandFinderReplace = async (el: WebElement, flag: boolean): Promise<void> => {
        const divs = await el.findElements(By.css("div"));
        for (const div of divs) {
            if ((await div.getAttribute("title")) === "Toggle Replace") {
                const expanded = await div.getAttribute("aria-expanded");
                if (flag) {
                    if (expanded === "false") {
                        await div.click();
                    }
                } else {
                    if (expanded === "true") {
                        await div.click();
                    }
                }
            }
        }
    };

    public static replacerGetButton = async (el: WebElement, button: string): Promise<WebElement | undefined> => {
        const replaceActions = await el.findElements(
            By.css(".replace-actions div"),
        );
        for (const action of replaceActions) {
            if ((await action.getAttribute("title")).indexOf(button) !== -1) {
                return action;
            }
        }
    };

    public static closeFinder = async (el: WebElement): Promise<void> => {
        const actions = await el.findElements(By.css(".find-actions div"));
        for (const action of actions) {
            if ((await action.getAttribute("title")).indexOf("Close") !== -1) {
                await action.click();
            }
        }
    };

    public static clickContextItem = async (item: string): Promise<void> => {

        const isCtxMenuDisplayed = async (): Promise<boolean> => {
            const el = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);

            return el !== null;
        };

        await driver.wait(async () => {
            const textArea = await driver.findElement(By.css("textarea"));
            await driver.actions().contextClick(textArea).perform();

            return isCtxMenuDisplayed();

        }, constants.explicitWait, "Context menu was not displayed");

        await driver.wait(async () => {
            try {
                const el: WebElement = await driver.executeScript(`return document.querySelector(".shadow-root-host").
                shadowRoot.querySelector("span[aria-label='${item}']")`);
                await el.click();

                return !(await isCtxMenuDisplayed());
            } catch (e) {
                if (e instanceof TypeError) {
                    return true;
                }
            }
        }, constants.explicitWait, "Context menu is still displayed");
    };

    public static hasNewPrompt = async (): Promise<boolean | undefined> => {
        let text: String;
        try {
            const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
            const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
            text = await lastPrompt.getText();
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                throw new Error(String(e.stack));
            } else {
                await driver.sleep(500);
                const prompts = await driver.findElements(By.css(".view-lines.monaco-mouse-cursor-text .view-line"));
                const lastPrompt = await prompts[prompts.length - 1].findElement(By.css("span > span"));
                text = await lastPrompt.getText();
            }
        }

        return String(text).length === 0;
    };

    public static setRestService = async (restService: interfaces.IRestService): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
            constants.explicitWait, "MRS Service dialog was not displayed");

        // Main settings
        const inputServPath = await dialog.findElement(By.id("servicePath"));
        await inputServPath.clear();
        await inputServPath.sendKeys(restService.servicePath);

        await Database.toggleCheckBox("makeDefault", restService.default);
        await Database.toggleCheckBox("enabled", restService.enabled);

        // Settings
        if (restService.settings) {
            if (restService.settings.comments) {
                const inputComments = await dialog.findElement(By.id("comments"));
                await inputComments.clear();
                await inputComments.sendKeys(restService.settings.comments);
            }
            if (restService.settings.hostNameFilter) {
                const inputHost = await dialog.findElement(By.id("hostName"));
                await inputHost.clear();
                await inputHost.sendKeys(restService.settings.hostNameFilter);
            }
        }

        // Options
        if (restService.options) {
            await dialog.findElement(By.id("page1")).click();
            const options = await dialog.findElement(By.id("options"));
            await options.clear();
            await options.sendKeys(restService.options);
        }
        if (restService.authentication) {
            await dialog.findElement(By.id("page2")).click();
            if (restService.authentication.authenticationPath) {
                const inputAuthPath = await dialog.findElement(By.id("authPath"));
                await inputAuthPath.clear();
                await inputAuthPath.sendKeys(restService.authentication.authenticationPath);
            }
            if (restService.authentication.redirectionUrl) {
                const authCompletedUrlInput = await dialog.findElement(By.id("authCompletedUrl"));
                await authCompletedUrlInput.clear();
                await authCompletedUrlInput.sendKeys(restService.authentication.redirectionUrl);
            }
            if (restService.authentication.redirectionUrlValid) {
                const authCompletedUrlValidationInput = await dialog.findElement(By.id("authCompletedUrlValidation"));
                await authCompletedUrlValidationInput.clear();
                await authCompletedUrlValidationInput.sendKeys(restService.authentication.redirectionUrlValid);
            }
            if (restService.authentication.authCompletedChangeCont) {
                const authCompletedPageContentInput = await dialog.findElement(By.id("authCompletedPageContent"));
                await authCompletedPageContentInput.clear();
                await authCompletedPageContentInput.sendKeys(restService.authentication.authCompletedChangeCont);
            }
        }
        if (restService.authenticationApps) {
            await dialog.findElement(By.id("page3")).click();
            if (restService.authenticationApps.vendor) {
                await driver.wait(async () => {
                    try {
                        await dialog.findElement(By.id("authApps.authVendorName")).click();
                    } catch (e) {
                        if (!(e instanceof error.ElementClickInterceptedError)) {
                            throw e;
                        }
                    }

                    return (await driver.findElements(By.id("authApps.authVendorNamePopup")))
                        .length > 0;
                }, constants.explicitWait, "Vendor drop down list was not displayed");

                const popup = await driver.findElement(By.id("authApps.authVendorNamePopup"));
                await popup.findElement(By.id(restService.authenticationApps.vendor)).click();
            }
            if (restService.authenticationApps.name) {
                const input = await dialog.findElement(By.id("authApps.name"));
                await input.clear();
                await input.sendKeys(restService.authenticationApps.name);
            }
            if (restService.authenticationApps.description) {
                const descriptionInput = await dialog.findElement(By.id("authApps.description"));
                await descriptionInput.clear();
                await descriptionInput.sendKeys(restService.authenticationApps.description);
            }
            if (restService.authenticationApps.enabled !== undefined) {
                await Database.toggleCheckBox("authApps.enabled", restService.authenticationApps.enabled);
            }
            if (restService.authenticationApps.limitToRegisteredUsers !== undefined) {
                await Database.toggleCheckBox("authApps.limitToRegisteredUsers",
                    restService.authenticationApps.limitToRegisteredUsers);

            }
            if (restService.authenticationApps.appId) {
                const appIdInput = await dialog.findElement(By.id("authApps.appId"));
                await appIdInput.clear();
                await appIdInput.sendKeys(restService.authenticationApps.appId);
            }
            if (restService.authenticationApps.accessToken) {
                const accessTokenInput = await dialog.findElement(By.id("authApps.accessToken"));
                await accessTokenInput.clear();
                await accessTokenInput.sendKeys(restService.authenticationApps.accessToken);
            }
            if (restService.authenticationApps.customUrl) {
                const urlInput = await dialog.findElement(By.id("authApps.url"));
                await urlInput.clear();
                await urlInput.sendKeys(restService.authenticationApps.customUrl);
            }
            if (restService.authenticationApps.customUrlForAccessToken) {
                const urlDirectAuthInput = await dialog.findElement(By.id("authApps.urlDirectAuth"));
                await urlDirectAuthInput.clear();
                await urlDirectAuthInput.sendKeys(restService.authenticationApps.customUrlForAccessToken);
            }
        }

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS Service dialog was not closed");
    };

    public static getRestService = async (): Promise<interfaces.IRestService> => {
        const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
            constants.explicitWait, "MRS Service dialog was not displayed");

        // Main settings
        const restService: interfaces.IRestService = {
            servicePath: await dialog.findElement(By.id("servicePath")).getAttribute("value"),
        };

        restService.default = await Database.getCheckBoxValue("makeDefault");
        restService.enabled = await Database.getCheckBoxValue("enabled");

        // Settings
        const restServiceSettings: interfaces.IRestServiceSettings = {};
        restServiceSettings.comments = await dialog.findElement(By.id("comments")).getAttribute("value");
        restServiceSettings.hostNameFilter = await dialog.findElement(By.id("hostName")).getAttribute("value");
        restService.settings = restServiceSettings;

        // Options
        await dialog.findElement(By.id("page1")).click();
        restService.options = (await dialog.findElement(By.id("options"))
            .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim();

        // Authentication
        await dialog.findElement(By.id("page2")).click();
        const authentication: interfaces.IRestServiceAuthentication = {};
        authentication.authenticationPath = await dialog.findElement(By.id("authPath")).getAttribute("value");
        authentication.redirectionUrl = await dialog.findElement(By.id("authCompletedUrl")).getAttribute("value");
        authentication.redirectionUrlValid = await dialog.findElement(By.id("authCompletedUrlValidation"))
            .getAttribute("value");
        authentication.authCompletedChangeCont = await dialog.findElement(By.id("authCompletedPageContent"))
            .getAttribute("value");
        restService.authentication = authentication;

        // Authentication apps
        await dialog.findElement(By.id("page3")).click();
        const authenticationApps: interfaces.IRestServiceAuthApps = {
            vendor: await dialog.findElement(By.id("authApps.authVendorName"))
                .findElement(By.css("label")).getText(),
            name: await dialog.findElement(By.id("authApps.name")).getAttribute("value"),
            description: await dialog.findElement(By.id("authApps.description")).getAttribute("value"),
            enabled: await Database.getCheckBoxValue("authApps.enabled"),
            limitToRegisteredUsers: await Database.getCheckBoxValue("authApps.limitToRegisteredUsers"),
            appId: await dialog.findElement(By.id("authApps.appId")).getAttribute("value"),
            accessToken: await dialog.findElement(By.id("authApps.accessToken")).getAttribute("value"),
            customUrl: await dialog.findElement(By.id("authApps.url")).getAttribute("value"),
            customUrlForAccessToken: await dialog.findElement(By.id("authApps.urlDirectAuth"))
                .getAttribute("value"),
        };

        restService.authenticationApps = authenticationApps;

        await driver.wait(async () => {
            await dialog.findElement(By.id("cancel")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS Service dialog was not closed");

        return restService;
    };

    public static setRestSchema = async (restSchema: interfaces.IRestSchema): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
            constants.explicitWait, "MRS Schema dialog was not displayed");

        if (restSchema.restServicePath) {
            await driver.wait(async () => {
                try {
                    await dialog.findElement(By.id("service")).click();
                } catch (e) {
                    if (!(e instanceof error.ElementClickInterceptedError)) {
                        throw e;
                    }
                }

                return (await driver.findElements(By.id("servicePopup")))
                    .length > 0;
            }, constants.explicitWait, "Service drop down list was not displayed");
            const popup = await driver.findElement(By.id("servicePopup"));
            await popup.findElement(By.id(restSchema.restServicePath)).click();
        }

        if (restSchema.restSchemaPath) {
            const inputSchemaName = await dialog.findElement(By.id("requestPath"));
            await inputSchemaName.clear();
            await inputSchemaName.sendKeys(restSchema.restSchemaPath);
        }

        if (restSchema.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", restSchema.enabled);
        }

        if (restSchema.requiresAuth !== undefined) {
            await Database.toggleCheckBox("requiresAuth", restSchema.requiresAuth);
        }

        // Settings
        if (restSchema.settings) {
            if (restSchema.settings.schemaName) {
                const inputSchemaName = await dialog.findElement(By.id("dbSchemaName"));
                await inputSchemaName.clear();
                await inputSchemaName.sendKeys(restSchema.settings.schemaName);
            }
            if (restSchema.settings.itemsPerPage) {
                const inputItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
                await inputItemsPerPage.clear();
                await inputItemsPerPage.sendKeys(restSchema.settings.itemsPerPage);
            }
            if (restSchema.settings.itemsPerPage) {
                const inputItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
                await inputItemsPerPage.clear();
                await inputItemsPerPage.sendKeys(restSchema.settings.itemsPerPage);
            }
            if (restSchema.settings.comments) {
                const inputComents = await dialog.findElement(By.id("comments"));
                await inputComents.clear();
                await inputComents.sendKeys(restSchema.settings.comments);
            }
        }

        // Options
        await dialog.findElement(By.id("page1")).click();
        if (restSchema.options) {
            const inputOptions = await dialog.findElement(By.id("options"));
            await inputOptions.clear();
            await inputOptions.sendKeys(restSchema.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The REST Schema Dialog was not closed");

    };

    public static getRestSchema = async (): Promise<interfaces.IRestSchema> => {
        const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
            constants.explicitWait, "MRS Schema dialog was not displayed");

        // Main settings
        const restShema: interfaces.IRestSchema = {
            restServicePath: await dialog.findElement(By.css("#service label")).getText(),
            restSchemaPath: await dialog.findElement(By.id("requestPath")).getAttribute("value"),
        };

        restShema.enabled = await Database.getCheckBoxValue("enabled");
        restShema.requiresAuth = await Database.getCheckBoxValue("requiresAuth");

        // Settings
        const restSchemaSettings: interfaces.IRestSchemaSettings = {};
        restSchemaSettings.schemaName = await dialog.findElement(By.id("dbSchemaName")).getAttribute("value");
        restSchemaSettings.itemsPerPage = await dialog.findElement(By.id("itemsPerPage")).getAttribute("value");
        restSchemaSettings.comments = await dialog.findElement(By.id("comments")).getAttribute("value");
        restShema.settings = restSchemaSettings;

        // Options
        await dialog.findElement(By.id("page1")).click();
        restShema.options = (await dialog.findElement(By.id("options")).getAttribute("value"))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(By.id("cancel")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS Service dialog was not closed");

        return restShema;
    };

    public static getCurrentEditorType = async (): Promise<string> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        const img = await selector.findElements(By.css("img"));
        if (img.length > 0) {
            const imgSrc = await img[0].getAttribute("src");
            const srcPath = basename(imgSrc);

            return srcPath.split(".")[0];
        } else {
            const span = await selector.findElement(By.css(".msg.icon"));

            return span.getAttribute("style");
        }
    };

    public static setRestAuthenticationApp = async (authApp: interfaces.IRestAuthenticationApp): Promise<void> => {
        const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
            constants.explicitWait * 2, "Authentication app dialog was not displayed");

        if (authApp.vendor) {
            await dialog.findElement(By.id("authVendorName")).click();
            const popup = await driver.wait(until.elementLocated(By.id("authVendorNamePopup")),
                constants.explicitWait, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.vendor)).click();
        }

        if (authApp.name) {
            const nameInput = await dialog.findElement(By.id("name"));
            await nameInput.clear();
            await nameInput.sendKeys(authApp.name);
        }
        if (authApp.description) {
            const descriptionInput = await dialog.findElement(By.id("description"));
            await descriptionInput.clear();
            await descriptionInput.sendKeys(authApp.description);
        }
        if (authApp.accessToken) {
            const accessTokenInput = await dialog.findElement(By.id("accessToken"));
            await accessTokenInput.clear();
            await accessTokenInput.sendKeys(authApp.accessToken);
        }
        if (authApp.appId) {
            const appIdInput = await dialog.findElement(By.id("appId"));
            await appIdInput.clear();
            await appIdInput.sendKeys(authApp.appId);
        }
        if (authApp.customURL) {
            const urlInput = await dialog.findElement(By.id("url"));
            await urlInput.clear();
            await urlInput.sendKeys(authApp.customURL);
        }
        if (authApp.customURLforAccessToken) {
            const urlDirectAuthInput = await dialog.findElement(By.id("urlDirectAuth"));
            await urlDirectAuthInput.clear();
            await urlDirectAuthInput.sendKeys(authApp.customURLforAccessToken);
        }

        if (authApp.defaultRole) {
            await dialog.findElement(By.id("defaultRoleName")).click();
            const popup = await driver.wait(until.elementLocated(By.id("defaultRoleNamePopup")),
                constants.explicitWait, "Auth vendor drop down list was not displayed");

            await popup.findElement(By.id(authApp.defaultRole)).click();
        }

        if (authApp.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", authApp.enabled);
            await dialog.click();
        }

        if (authApp.limitToRegisteredUsers !== undefined) {
            await Database.toggleCheckBox("limitToRegisteredUsers", authApp.limitToRegisteredUsers);
            await dialog.click();
        }

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The Authentication App Dialog was not closed");

    };

    public static getAuthenticationApp = async (): Promise<interfaces.IRestAuthenticationApp> => {
        const dialog = await driver.wait(until.elementLocated(By.id("mrsAuthenticationAppDialog")),
            constants.explicitWait * 2, "Authentication app dialog was not displayed");

        const authenticationApp: interfaces.IRestAuthenticationApp = {
            vendor: await dialog.findElement(By.css("#authVendorName label")).getText(),
            name: await dialog.findElement(By.id("name")).getAttribute("value"),
            description: await dialog.findElement(By.id("description")).getAttribute("value"),
            accessToken: await dialog.findElement(By.id("accessToken")).getAttribute("value"),
            appId: await dialog.findElement(By.id("appId")).getAttribute("value"),
            customURL: await dialog.findElement(By.id("url")).getAttribute("value"),
            customURLforAccessToken: await dialog.findElement(By.id("urlDirectAuth")).getAttribute("value"),
            defaultRole: await dialog.findElement(By.css("#defaultRoleName label")).getText(),
        };

        authenticationApp.enabled = await Database.getCheckBoxValue("enabled");
        authenticationApp.limitToRegisteredUsers = await Database.getCheckBoxValue("limitToRegisteredUsers");

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The Authentication App Dialog was not closed");

        return authenticationApp;
    };

    public static setRestUser = async (restUser: interfaces.IRestUser): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
            constants.explicitWait * 2, "User dialog was not displayed");

        const nameInput = await dialog.findElement(By.id("name"));
        const passwordInput = await dialog.findElement(By.id("authString"));

        await nameInput.clear();
        await nameInput.sendKeys(restUser.username);

        await passwordInput.clear();
        await passwordInput.sendKeys(restUser.password);

        if (restUser.authenticationApp) {
            await dialog.findElement(By.id("authApp")).click();
            await driver.wait(until.elementLocated(By.id("authAppPopup")),
                constants.explicitWait, "Auth app drop down list was not displayed");

            await driver.wait(until.elementLocated(By.id(restUser.authenticationApp)), constants.explicitWait).click();
        }

        if (restUser.email) {
            const emailInput = await dialog.findElement(By.id("email"));
            await emailInput.clear();
            await emailInput.sendKeys(restUser.email);
        }

        if (restUser.assignedRoles) {
            await dialog.findElement(By.id("roles")).click();
            await driver.wait(until.elementLocated(By.id("rolesPopup")),
                constants.explicitWait, "Roles drop down list was not displayed");

            const roles = await driver.findElement(By.id(restUser.assignedRoles));
            const rolesLabel = await roles.findElement(By.css("label"));
            const rolesLabelClass = await rolesLabel.getAttribute("class");
            if (rolesLabelClass.includes("unchecked")) {
                await roles.click();
            } else {
                await driver.wait(async () => {
                    await keyboard.type(nutKey.Escape);

                    return (await driver.findElements(By.css(".popup.visible"))).length === 0;
                }, constants.explicitWait, "Roles drop down list was not closed");
            }
        }

        if (restUser.permitLogin !== undefined) {
            await Database.toggleCheckBox("loginPermitted", restUser.permitLogin);
        }

        if (restUser.userOptions) {
            const appOptionsInput = await dialog.findElement(By.id("appOptions"));
            await appOptionsInput.clear();
            await appOptionsInput.sendKeys(restUser.userOptions);
        }

        if (restUser.vendorUserId) {
            const vendorUserIdInput = await dialog.findElement(By.id("vendorUserId"));
            await vendorUserIdInput.clear();
            await vendorUserIdInput.sendKeys(restUser.vendorUserId);
        }

        if (restUser.mappedUserId) {
            const mappedUserIdInput = await dialog.findElement(By.id("mappedUserId"));
            await mappedUserIdInput.clear();
            await mappedUserIdInput.sendKeys(restUser.mappedUserId);
        }

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS User dialog was not closed");

    };

    public static getRestUser = async (): Promise<interfaces.IRestUser> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsUserDialog")),
            constants.explicitWait * 2, "User dialog was not displayed");

        const restUser: interfaces.IRestUser = {
            username: await dialog.findElement(By.id("name")).getAttribute("value"),
            password: await dialog.findElement(By.id("authString")).getAttribute("value"),
            authenticationApp: await dialog.findElement(By.css("#authApp label")).getText(),
            email: await dialog.findElement(By.id("email")).getAttribute("value"),
            assignedRoles: await dialog.findElement(By.css("#roles label")).getText(),
            userOptions: (await dialog.findElement(By.id("appOptions"))
                .getAttribute("value")).replace(/\r?\n|\r|\s+/gm, "").trim(),
            vendorUserId: await dialog.findElement(By.id("vendorUserId")).getAttribute("value"),
            mappedUserId: await dialog.findElement(By.id("mappedUserId")).getAttribute("value"),
        };

        restUser.permitLogin = await Database.getCheckBoxValue("loginPermitted");

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS User dialog was not closed");

        return restUser;

    };

    public static setRestObject = async (restObject: interfaces.IRestObject): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsDbObjectDialog")),
            constants.explicitWait * 2, "Edit REST Object dialog was not displayed");

        const processColumnActivation = async (colOption: interfaces.IRestObjectColumn): Promise<void> => {
            const inColumns = await driver.wait(until.elementsLocated(By.css(".mrsObjectJsonFieldDiv.withoutChildren")),
                constants.explicitWait);
            for (const col of inColumns) {
                if ((await col.findElement(By.css(".label")).getText()) === colOption.name) {
                    const isNotSelected = (await col.findElements(By.css(".checkbox.unchecked"))).length > 0;
                    if (colOption.isSelected === true) {
                        if (isNotSelected === true) {
                            await col.findElement(By.css(".checkMark")).click();

                            return;
                        }
                    } else {
                        if (isNotSelected === false) {
                            await col.findElement(By.css(".checkMark")).click();

                            return;
                        }
                    }
                }
            }
        };

        const processColumnOption = async (colName: string, colOption: string, wantedValue: boolean): Promise<void> => {
            const inColumns = await driver.wait(until.elementsLocated(By.css(".mrsObjectJsonFieldDiv.withoutChildren")),
                constants.explicitWait);
            for (const col of inColumns) {
                if ((await col.findElement(By.css(".label")).getText()) === colName) {
                    const fieldOptions = await col.findElements(By.css(".fieldOptions > .icon"));
                    for (const option of fieldOptions) {
                        const inOptionName = await option.getAttribute("data-tooltip");
                        if (inOptionName === constants.rowOwnership && colOption === constants.rowOwnership) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }
                        if (inOptionName === constants.allowSorting && colOption === constants.allowSorting) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }
                        if (inOptionName === constants.preventFiltering && colOption === constants.preventFiltering) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }
                        if (inOptionName === constants.preventUpdates && colOption === constants.preventUpdates) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }
                        if (inOptionName === constants.excludeETAG && colOption === constants.excludeETAG) {
                            const inOptionIsNotSelected = (await option.getAttribute("class"))
                                .split(" ").includes("notSelected");
                            if (wantedValue === true) {
                                if (inOptionIsNotSelected === true) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            } else {
                                if (inOptionIsNotSelected === false) {
                                    await driver.actions().move({ origin: col }).perform();
                                    await option.click();

                                    return;
                                }
                            }
                        }
                    }
                }
            }
        };

        if (restObject.restServicePath) {
            const inService = await dialog.findElement(By.id("service"));
            await inService.click();
            const popup = await driver.wait(until.elementLocated(By.id("servicePopup")),
                constants.explicitWait, "#servicePopup not found");
            await popup.findElement(By.id(restObject.restServicePath)).click();
        }
        if (restObject.restSchemaPath) {
            const inSchema = await dialog.findElement(By.id("schema"));
            await inSchema.click();
            const popup = await driver.wait(until.elementLocated(By.id("schemaPopup")),
                constants.explicitWait, "Schema drop down list was not found");
            await popup.findElement(By.id(restObject.restSchemaPath)).click();
        }
        if (restObject.restObjectPath) {
            const inObjPath = await dialog.findElement(By.id("requestPath"));
            await inObjPath.clear();
            await inObjPath.sendKeys(restObject.restObjectPath);
        }
        if (restObject.enabled !== undefined) {
            await Database.toggleCheckBox("enabled", restObject.enabled);
        }
        if (restObject.requiresAuth !== undefined) {
            await Database.toggleCheckBox("requiresAuth", restObject.requiresAuth);
        }
        if (restObject.jsonRelDuality) {
            if (restObject.jsonRelDuality.dbObject) {
                const inDbObj = await dialog.findElement(By.id("dbObject"));
                await inDbObj.clear();
                await inDbObj.sendKeys(restObject.jsonRelDuality.dbObject);
            }
            if (restObject.jsonRelDuality.sdkLanguage) {
                if (restObject.jsonRelDuality.sdkLanguage !== "SDK Language") {
                    const inSdk = await dialog.findElement(By.id("sdkLanguage"));
                    await inSdk.click();
                    const popup = await driver.wait(until.elementLocated(By.id("sdkLanguagePopup")),
                        constants.explicitWait, "SDK Language drop down list was not found");
                    await popup.findElement(By.id(restObject.jsonRelDuality.sdkLanguage)).click();
                }
            }
            if (restObject.jsonRelDuality.columns) {
                for (const column of restObject.jsonRelDuality.columns) {
                    await processColumnActivation(column);
                    const colKeys = Object.keys(column).splice(0);
                    for (let i = 0; i <= colKeys.length - 1; i++) {
                        if (i >= 2) {
                            await processColumnOption(column.name,
                                constants[colKeys[i]] as string, (column[colKeys[i]] as boolean));
                        }
                    }
                }
            }
            if (restObject.jsonRelDuality.crud) {
                const processCrudItem = async (item: { name: string, value: boolean }): Promise<void> => {
                    const crudDivs = await dialog.findElements(By.css(".crudDiv div"));
                    for (const crudDiv of crudDivs) {
                        const isInactive = (await crudDiv.getAttribute("class")).includes("deactivated");
                        const tooltip = await crudDiv.getAttribute("data-tooltip");
                        if (tooltip.toLowerCase().includes(item.name)) {
                            if (item.value === true) {
                                if (isInactive) {
                                    await crudDiv.click();
                                    break;
                                }
                            } else {
                                if (!isInactive) {
                                    await crudDiv.click();
                                    break;
                                }
                            }
                        }
                    }
                };
                for (const key of Object.keys(restObject.jsonRelDuality.crud)) {
                    try {
                        await processCrudItem({ name: key, value: restObject.jsonRelDuality.crud[key] });
                    } catch (e) {
                        if (!(e instanceof error.StaleElementReferenceError)) {
                            throw e;
                        } else {
                            await processCrudItem({ name: key, value: restObject.jsonRelDuality.crud[key] });
                        }
                    }
                }
            }
        }
        if (restObject.settings) {
            await driver.wait(async () => {
                await dialog.findElement(By.id("page1")).click();

                return (await dialog.findElement(By.id("page1")).getAttribute("class")).includes("selected");
            }, constants.explicitWait, "Settings tab was not selected");
            if (restObject.settings.resultFormat) {
                const inResultFormat = await dialog.findElement(By.id("crudOperationFormat"));
                await inResultFormat.click();
                const popup = await driver.wait(until.elementLocated(By.id("crudOperationFormatPopup")),
                    constants.explicitWait, "#crudOperationFormatPopup not found");
                await popup.findElement(By.id(restObject.settings.resultFormat)).click();
            }
            if (restObject.settings.itemsPerPage) {
                const inItemsPerPage = await dialog.findElement(By.id("itemsPerPage"));
                await inItemsPerPage.clear();
                await inItemsPerPage.sendKeys(restObject.settings.itemsPerPage);
            }
            if (restObject.settings.comments) {
                const inComments = await dialog.findElement(By.id("comments"));
                await inComments.clear();
                await inComments.sendKeys(restObject.settings.comments);
            }
            if (restObject.settings.mediaType) {
                const inMediaType = await dialog.findElement(By.id("mediaType"));
                await inMediaType.clear();
                await inMediaType.sendKeys(restObject.settings.mediaType);
            }
            if (restObject.settings.autoDetectMediaType !== undefined) {
                await Database.toggleCheckBox("autoDetectMediaType", restObject.settings.autoDetectMediaType);
            }
        }
        if (restObject.authorization) {
            await driver.wait(async () => {
                await dialog.findElement(By.id("page2")).click();

                return (await dialog.findElement(By.id("page2")).getAttribute("class")).includes("selected");
            }, constants.explicitWait, "Authorization tab was not selected");
            if (restObject.authorization.enforceRowUserOwner !== undefined) {
                await Database.toggleCheckBox("rowUserOwnershipEnforced", restObject.authorization.enforceRowUserOwner);
            }
            if (restObject.authorization.rowOwnerShipField) {
                const inOwner = await dialog.findElement(By.id("rowUserOwnershipColumn"));
                await inOwner.click();
                const popup = await driver.wait(until.elementLocated(By.id("rowUserOwnershipColumnPopup")),
                    constants.explicitWait, "#rowUserOwnershipColumnPopup not found");
                await popup.findElement(By.id(restObject.authorization.rowOwnerShipField)).click();
            }
            if (restObject.authorization.customStoredProcedure) {
                const inStoredPrc = await dialog.findElement(By.id("authStoredProcedure"));
                await inStoredPrc.clear();
                await inStoredPrc.sendKeys(restObject.authorization.customStoredProcedure);
            }
        }
        if (restObject.options) {
            await driver.wait(async () => {
                await dialog.findElement(By.id("page3")).click();

                return (await dialog.findElement(By.id("page3")).getAttribute("class")).includes("selected");
            }, constants.explicitWait, "Options tab was not selected");
            const inputOptions = await dialog.findElement(By.id("options"));
            await inputOptions.clear();
            await inputOptions.sendKeys(restObject.options);
        }

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS Object dialog was not closed");
    };

    public static getRestObject = async (): Promise<interfaces.IRestObject> => {

        const dialog = await driver.wait(until.elementLocated(By.id("mrsDbObjectDialog")),
            constants.explicitWait * 2, "Edit REST Object dialog was not displayed");

        const restObject: interfaces.IRestObject = {
            restServicePath: await dialog.findElement(By.css("#service label")).getText(),
            restSchemaPath: await dialog.findElement(By.css("#schema label")).getText(),
            restObjectPath: await dialog.findElement(By.id("requestPath")).getAttribute("value"),
            jsonRelDuality: {
                dbObject: await dialog.findElement(By.id("dbObject")).getAttribute("value"),
                sdkLanguage: await dialog.findElement(By.css("#sdkLanguage label")).getText(),
            },
        };

        restObject.enabled = await Database.getCheckBoxValue("enabled");
        restObject.requiresAuth = await Database.getCheckBoxValue("requiresAuth");

        const inColumns = await driver.wait(until.elementsLocated(By.css(".mrsObjectJsonFieldDiv.withoutChildren")),
            constants.explicitWait);
        const restColumns: interfaces.IRestObjectColumn[] = [];
        for (const col of inColumns) {
            const restObjectColumn: interfaces.IRestObjectColumn = {
                name: await col.findElement(By.css(".label")).getText(),
                isSelected: !((await col.findElements(By.css(".checkbox.unchecked"))).length > 0),
            };

            const fieldOptions = await col.findElements(By.css(".fieldOptions > .icon"));
            for (const option of fieldOptions) {
                const inOptionName = await option.getAttribute("data-tooltip");
                if (inOptionName === constants.rowOwnership) {
                    restObjectColumn.rowOwnership = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.allowSorting) {
                    restObjectColumn.allowSorting = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.preventFiltering) {
                    restObjectColumn.preventFiltering = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.preventUpdates) {
                    restObjectColumn.preventUpdates = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
                if (inOptionName === constants.excludeETAG) {
                    restObjectColumn.excludeETAG = !(await option.getAttribute("class"))
                        .split(" ").includes("notSelected");
                }
            }
            restColumns.push(restObjectColumn);
        }
        restObject.jsonRelDuality.columns = restColumns;

        const restObjectCrud: interfaces.IRestObjectCrud = {
            create: undefined,
            read: undefined,
            update: undefined,
            delete: undefined,
        };
        const crudDivs = await driver.wait(until.elementsLocated(By.css(".crudDiv div")), constants.explicitWait);
        const crudKeys = Object.keys(restObjectCrud);
        for (const crudDiv of crudDivs) {
            const isInactive = (await crudDiv.getAttribute("class")).includes("deactivated");
            const tooltip = await crudDiv.getAttribute("data-tooltip");
            for (const key of crudKeys) {
                if (tooltip.toLowerCase().includes(key)) {
                    restObjectCrud[key] = !isInactive;
                }
            }
        }
        restObject.jsonRelDuality.crud = restObjectCrud;

        await driver.wait(async () => {
            await dialog.findElement(By.id("page1")).click();

            return (await dialog.findElement(By.id("page1")).getAttribute("class")).includes("selected");
        }, constants.explicitWait, "Settings tab was not selected");
        restObject.settings = {
            resultFormat: await dialog.findElement(By.css("#crudOperationFormat label")).getText(),
            itemsPerPage: await dialog.findElement(By.id("itemsPerPage")).getAttribute("value"),
            comments: await dialog.findElement(By.id("comments")).getAttribute("value"),
            mediaType: await dialog.findElement(By.id("mediaType")).getAttribute("value"),
        };

        restObject.settings.autoDetectMediaType = await Database.getCheckBoxValue("autoDetectMediaType");

        await driver.wait(async () => {
            await dialog.findElement(By.id("page2")).click();

            return (await dialog.findElement(By.id("page2")).getAttribute("class")).includes("selected");
        }, constants.explicitWait, "Authorization tab was not selected");
        restObject.authorization = {};

        restObject.authorization.enforceRowUserOwner = await Database.getCheckBoxValue("rowUserOwnershipEnforced");

        restObject.authorization.rowOwnerShipField = await dialog.findElement(By.css("#rowUserOwnershipColumn label"))
            .getText();
        restObject.authorization.customStoredProcedure = await dialog.findElement(By.id("authStoredProcedure"))
            .getAttribute("value");

        await driver.wait(async () => {
            await dialog.findElement(By.id("page3")).click();

            return (await dialog.findElement(By.id("page3")).getAttribute("class")).includes("selected");
        }, constants.explicitWait, "Options tab was not selected");
        restObject.options = (await dialog.findElement(By.id("options")).getAttribute("value"))
            .replace(/\r?\n|\r|\s+/gm, "").trim();

        await driver.wait(async () => {
            await dialog.findElement(By.id("ok")).click();

            return (await Misc.existsWebViewDialog()) === false;
        }, constants.explicitWait * 2, "The MRS Object dialog was not closed");

        return restObject;
    };

    public static getCurrentEditor = async (): Promise<string> => {
        const getData = async (): Promise<string> => {
            const selector = await driver.wait(until.elementLocated(By.id("documentSelector")),
                constants.explicitWait, "Document selector was not found");
            const label = await selector.findElement(By.css("label"));

            return label.getText();
        };

        let result: string;
        try {
            result = await getData();
        } catch (e) {
            if (e instanceof error.StaleElementReferenceError) {
                result = await getData();
            } else {
                throw e;
            }
        }

        return result;
    };

    public static execScript = async (cmd: string, timeout?: number): Promise<string> => {

        const textArea = await driver?.findElement(By.css("textarea"));
        await textArea.sendKeys(cmd);
        await Misc.execOnEditor();
        timeout = timeout ?? 5000;

        return Database.getScriptResult(timeout);
    };

    public static getAutoCompleteMenuItems = async (): Promise<string[]> => {
        const els = [];
        let items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            constants.explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        await driver.findElement(By.css("textarea")).sendKeys(Key.ARROW_UP);

        items = await driver.wait(until.elementsLocated(By.css(".monaco-list .monaco-highlighted-label span")),
            constants.explicitWait, "Auto complete items were not displayed");

        for (const item of items) {
            els.push(await item.getText());
        }

        return [...new Set(els)] as string[];

    };

    public static isEditorStretched = async (): Promise<boolean> => {
        const editor = await driver.findElement(By.id("editorPaneHost"));
        const style = await editor.getCssValue("height");
        const height = parseInt(style.trim().replace("px", ""), 10);

        return height > 0;
    };

    public static getScriptResult = async (timeout = constants.explicitWait): Promise<string> => {
        let toReturn = "";
        await driver.wait(async () => {
            const resultHost = await driver.findElements(By.css(".resultHost"));
            if (resultHost.length > 0) {
                const content = await resultHost[resultHost.length - 1]
                    .findElements(By.css(".resultStatus label,.actionOutput span > span"));

                if (content.length) {
                    toReturn = await content[content.length - 1].getAttribute("innerHTML");

                    return true;
                }
            }
        }, timeout, `No results were found`);

        return toReturn;
    };

    public static isResultTabMaximized = async (): Promise<boolean> => {
        return (await driver.findElements(By.id("normalizeResultStateButton"))).length > 0;
    };

    public static selectCurrentEditor = async (editorName: string, editorType: string): Promise<void> => {
        const selector = await driver.findElement(By.id("documentSelector"));
        await driver.executeScript("arguments[0].click()", selector);

        await driver.wait(async () => {
            return (await driver.findElements(By.css("div.visible.dropdownList > div"))).length > 1;
        }, 2000, "No elements located on dropdown");

        const dropDownItems = await driver.findElements(
            By.css("div.visible.dropdownList > div"),
        );

        for (const item of dropDownItems) {
            const name = await item.findElement(By.css("label")).getText();
            const el = await item.findElements(By.css("img"));

            let type = "";

            if (el.length > 0) {
                type = await el[0].getAttribute("src");
            } else {
                type = await item.findElement(By.css(".msg.icon")).getAttribute("style");
            }

            if (name === editorName) {
                if (type.indexOf(editorType) !== -1) {
                    await driver.wait(async () => {
                        await item.click();
                        const selector = await driver.findElement(By.id("documentSelector"));
                        const selected = await selector.findElement(By.css("label")).getText();

                        return selected === editorName;
                    }, constants.explicitWait, `${editorName} with type ${editorType} was not properly selected`);

                    await driver.wait(
                        async () => {
                            return (
                                (
                                    await driver.findElements(
                                        By.css("div.visible.dropdownList > div"),
                                    )
                                ).length === 0
                            );
                        },
                        2000,
                        "Dropdown list is still visible",
                    );

                    return;
                }
            }
        }
        throw new Error(`Coult not find ${editorName} with type ${editorType}`);
    };

    public static setDBConnectionCredentials = async (data: interfaces.IDBConnection,
        timeout?: number): Promise<void> => {
        await Database.setPassword(data);
        if (credentialHelperOk) {
            await Misc.setConfirmDialog(data, "no", timeout);
        }
    };

    public static verifyNotebook = async (sql: string, resultStatus: string): Promise<void> => {

        const commands = [];
        await driver.wait(async () => {
            try {
                const cmds = await driver.wait(
                    until.elementsLocated(By.css(".view-lines.monaco-mouse-cursor-text > div > span")),
                    constants.explicitWait, "No lines were found");
                for (const cmd of cmds) {
                    const spans = await cmd.findElements(By.css("span"));
                    let sentence = "";
                    for (const span of spans) {
                        sentence += (await span.getText()).replace("&nbsp;", " ");
                    }
                    commands.push(sentence);
                }

                return commands.length > 0;
            } catch (e) {
                if (!(e instanceof error.StaleElementReferenceError)) {
                    throw e;
                }
            }
        }, constants.explicitWait, "No SQL commands were found on the notebook");


        if (!commands.includes(sql)) {
            throw new Error(`Could not find the SQL statement ${sql} on the notebook`);
        }

        let foundResult = false;
        const results = await driver.findElements(By.css(".resultStatus"));
        for (const result of results) {
            const text = await result.getText();
            if (text.includes(resultStatus)) {
                foundResult = true;
                break;
            }
        }

        if (!foundResult) {
            throw new Error(`Could not find the SQL result ${resultStatus} on the notebook`);
        }

    };

    public static setDataToHw = async (
        schemas?: string[],
        opMode?: string,
        output?: string,
        disableCols?: boolean,
        optimize?: boolean,
        enableMemory?: boolean,
        sqlMode?: string,
        exludeList?: string,
    ): Promise<void> => {

        const dialog = await driver.wait(until.elementLocated(By.css("#mdsHWLoadDataDialog .valueEditDialog")),
            constants.explicitWait, "MDS dialog was not found");
        if (schemas) {
            const schemaInput = await dialog.findElement(By.id("schemas"));
            await schemaInput.click();
            const popup = await driver.wait(until.elementLocated(By.css("#schemasPopup .popup.visible")));
            for (const schema of schemas) {
                await popup.findElement(By.id(schema)).click();
            }
            await driver.actions().sendKeys(Key.ESCAPE).perform();
        }
        if (opMode) {
            const modeInput = await dialog.findElement(By.id("mode"));
            await modeInput.click();
            const popup = await driver.wait(until.elementLocated(By.css("#modePopup .popup.visible")));
            await popup.findElement(By.id(opMode)).click();
        }
        if (output) {
            const outputInput = await dialog.findElement(By.id("output"));
            await outputInput.click();
            const popup = await driver.wait(until.elementLocated(By.css("#outputPopup .popup.visible")));
            await popup.findElement(By.id(output)).click();
        }
        if (disableCols) {
            const disableColsInput = await dialog.findElement(By.id("disableUnsupportedColumns"));
            await disableColsInput.click();
        }
        if (optimize) {
            const optimizeInput = await dialog.findElement(By.id("optimizeLoadParallelism"));
            await optimizeInput.click();
        }
        if (enableMemory) {
            const enableInput = await dialog.findElement(By.id("enableMemoryCheck"));
            await enableInput.click();
        }
        if (sqlMode) {
            const sqlModeInput = await dialog.findElement(By.id("sqlMode"));
            await sqlModeInput.sendKeys(sqlMode);
        }
        if (exludeList) {
            const exludeListInput = await dialog.findElement(By.id("excludeList"));
            await exludeListInput.sendKeys(exludeList);
        }

        await dialog.findElement(By.id("ok")).click();
    };

    private static toggleCheckBox = async (elId: string, checked: boolean): Promise<void> => {
        const isUnchecked = async () => {
            return (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ")
                .includes("unchecked");
        };

        if (checked && (await isUnchecked())) {
            await driver.findElement(By.id(elId)).findElement(By.css(".checkMark")).click();
        } else {
            if (!checked && !(await isUnchecked())) {
                await driver.findElement(By.id(elId)).findElement(By.css(".checkMark")).click();
            }
        }
    };

    private static getCheckBoxValue = async (elId: string): Promise<boolean> => {
        const classes = (await driver.findElement(By.id(elId)).getAttribute("class")).split(" ");

        return !classes.includes("unchecked");
    };
}
