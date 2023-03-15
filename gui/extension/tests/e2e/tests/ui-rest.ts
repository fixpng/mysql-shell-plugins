/*
 * Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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
    By,
    EditorView,
    Workbench,
    until,
    ModalDialog,
    TreeItem,
    CustomTreeSection,
} from "vscode-extension-tester";

import { before, after, afterEach } from "mocha";
import { expect } from "chai";
import {
    dbTreeSection,
    driver,
    explicitWait,
    Misc,
    isExtPrepared,
    dbMaxLevel,
} from "../lib/misc";

import { IDBConnection, Database } from "../lib/db";

describe("REST", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }

    const globalConn: IDBConnection = {
        caption: "conn",
        description: "Local connection",
        hostname: String(process.env.DBHOSTNAME),
        username: String(process.env.DBUSERNAME),
        port: Number(process.env.DBPORT),
        portX: Number(process.env.DBPORTX),
        schema: "sakila",
        password: String(process.env.DBPASSWORD),
        sslMode: undefined,
        sslCA: undefined,
        sslClientCert: undefined,
        sslClientKey: undefined,
    };

    let treeDBSection: CustomTreeSection;
    let treeGlobalConn: TreeItem | undefined;

    before(async function () {

        try {

            if (!isExtPrepared) {
                await Misc.prepareExtension();
            }

            await Misc.sectionFocus(dbTreeSection);

            await Misc.toggleBottomBar(false);

            const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
            globalConn.caption += randomCaption;
            treeDBSection = await Misc.getSection(dbTreeSection);
            await Database.createConnection(treeDBSection, globalConn, false);
            expect(await Database.getWebViewConnection(globalConn.caption)).to.exist;
            const edView = new EditorView();
            await edView.closeAllEditors();
            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeGlobalConn = await treeDBSection.findItem(globalConn.caption, dbMaxLevel);
            expect(treeGlobalConn).to.exist;

        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("REST API", () => {

        let randomService = "";
        let treeRandomService: TreeItem | undefined;
        let treeMySQLRESTService: TreeItem | undefined;
        let treeMySQLRESTSchema: TreeItem | undefined;

        before(async function () {
            try {
                const randomCaption = String(Math.floor(Math.random() * (9000 - 2000 + 1) + 2000));
                await treeGlobalConn?.expand();
                await Misc.setInputPassword(globalConn.password);

                await Misc.selectContextMenuItem(treeGlobalConn!, "Configure Instance for MySQL REST Service Support");

                await Misc.setInputPassword(globalConn.password);

                await Misc.verifyNotification("MySQL REST Service configured successfully.", true);

                await driver.wait(async () => {
                    treeMySQLRESTService = await treeDBSection.findItem("MySQL REST Service", dbMaxLevel);

                    return treeMySQLRESTService;
                }, explicitWait, `MySQL REST Service is not on the tree`);

                await Misc.selectContextMenuItem(treeGlobalConn!, "Show MySQL System Schemas");

                await driver.wait(treeDBSection.findItem("mysql_rest_service_metadata", dbMaxLevel),
                    explicitWait, `mysql_rest_service_metadata is not on the tree`);

                await Misc.selectContextMenuItem(treeMySQLRESTService!, "Add REST Service...");

                randomService = `Service${randomCaption}`;
                await Misc.switchToWebView();
                await Database.setRestService(`/${randomService}`, "", "localhost", ["HTTP"], true, true);

                await Misc.verifyNotification("The MRS service has been created.", true);

                await driver?.switchTo().defaultContent();

                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

                await treeMySQLRESTService?.expand();

                treeRandomService = await treeDBSection.findItem(`/${randomService}`, dbMaxLevel);

                expect(treeRandomService).to.exist;

                await driver?.switchTo().defaultContent();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            await driver.switchTo().defaultContent();
            if (this.currentTest?.state === "failed") {
                const notifications = await new Workbench().getNotifications();
                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].expand();
                }

                await Misc.processFailure(this);

                if (notifications.length > 0) {
                    await notifications[notifications.length - 1].dismiss();
                }
            }

            await new EditorView().closeAllEditors();
        });

        after(async function () {
            try {

                const treeServMetadata = await treeDBSection.findItem("mysql_rest_service_metadata", dbMaxLevel);
                await Misc.selectContextMenuItem(treeServMetadata!, "Drop Schema...");

                const ntf = await driver.findElements(By.css(".notifications-toasts.visible"));
                if (ntf.length > 0) {
                    await ntf[0].findElement(By.xpath(
                        `//a[contains(@title, 'Drop mysql_rest_service_metadata')]`)).click();
                } else {
                    const dialog = new ModalDialog();
                    await dialog.pushButton(`Drop mysql_rest_service_metadata`);
                }

                await Misc
                    .verifyNotification("The object mysql_rest_service_metadata has been dropped successfully.", true);

            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Set as new DEFAULT REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService!, "Set as New Default REST Service");

            await Misc.verifyNotification("The MRS service has been set as the new default service.", true);

            expect(await Misc.isDefaultItem(treeRandomService!, "rest")).to.be.true;
        });

        it("Edit REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService!, "Edit REST Service...");

            await Misc.switchToWebView();

            await Database.setRestService(`/edited${randomService}`, "edited",
                "localhost", [], false, false);

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS service has been successfully updated.", true);

            await driver.wait(async () => {
                await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");
                treeRandomService = await treeDBSection.findItem(`/edited${randomService}`, dbMaxLevel);

                return treeRandomService;
            }, 3000, `/edited${randomService} was not displayed on the tree`);

            await Misc.selectContextMenuItem(treeRandomService!, "Edit REST Service...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsServiceDialog")),
                explicitWait, "MRS Service dialog was not displayed");
            const inputServPath = await dialog.findElement(By.id("servicePath"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputHost = await dialog.findElement(By.id("hostName"));

            const protocols = await dialog.findElements(By.css("#protocols label.tag"));
            const inputMrsEnabled = await dialog.findElement(By.id("enabled"));

            const mrsEnabledClasses = (await inputMrsEnabled.getAttribute("class")).split(" ");

            expect(protocols.length).to.equals(0);
            expect(await inputServPath.getAttribute("value")).equals(`/edited${randomService}`);
            expect(await inputComments.getAttribute("value")).equals("edited");
            expect(await inputHost.getAttribute("value")).equals("localhost");
            expect(mrsEnabledClasses).to.include("unchecked");

        });

        it("Add a REST Service Schema", async () => {

            const randomServiceLabel = await treeRandomService?.getLabel();

            const treeSakila = await treeDBSection.findItem("sakila", dbMaxLevel);

            await Misc.selectContextMenuItem(treeSakila!, "Add Schema to REST Service");

            await Misc.switchToWebView();

            await Database.setRestSchema("sakila",
                `localhost${String(randomServiceLabel)}`, "/sakila", 1, true, true, "sakila");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been added successfully.", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            await (await treeDBSection.findItem(String(randomServiceLabel), dbMaxLevel)).expand();

            treeMySQLRESTSchema = await driver.wait(treeDBSection.findItem("sakila (/sakila)", dbMaxLevel),
                explicitWait, `'sakila (/sakila)' does not exist on the tree`);

        });

        it("Edit REST Schema", async () => {

            const randomServiceLabel = await treeRandomService?.getLabel();

            await (await treeDBSection.findItem(String(randomServiceLabel), dbMaxLevel)).expand();

            await Misc.selectContextMenuItem(treeMySQLRESTSchema!, "Edit REST Schema...");

            await Misc.switchToWebView();

            await Database.setRestSchema("sakila",
                `localhost${String(randomServiceLabel)}`, "/edited", 5, false, false, "edited");

            await driver.switchTo().defaultContent();

            await Misc.verifyNotification("The MRS schema has been updated successfully.", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            const treeSakilaEdited = await treeDBSection.findItem("sakila (/edited)", dbMaxLevel);

            await Misc.selectContextMenuItem(treeSakilaEdited, "Edit REST Schema...");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

            const inputSchemaName = await dialog.findElement(By.id("name"));
            const inputRequestPath = await dialog.findElement(By.id("requestPath"));
            const inputRequiresAuth = await dialog.findElement(By.id("requiresAuth"));
            const inputEnabled = await dialog.findElement(By.id("enabled"));
            const inputItemsPerPage = await dialog.findElement(By.css("#itemsPerPage"));
            const inputComments = await dialog.findElement(By.id("comments"));
            const inputRequiresAuthClasses = (await inputRequiresAuth.getAttribute("class")).split(" ");
            const inputEnabledClasses = (await inputEnabled.getAttribute("class")).split(" ");

            expect(await inputSchemaName.getAttribute("value")).equals("sakila");
            expect(await inputRequestPath.getAttribute("value")).equals("/edited");
            expect(inputRequiresAuthClasses).to.include("unchecked");
            expect(inputEnabledClasses).to.include("unchecked");
            expect(await inputItemsPerPage.getAttribute("value")).equals("5");
            expect(await inputComments.getAttribute("value")).equals("edited");

        });

        it("Add Table to REST Service", async () => {

            const treeSakilaEdited = await treeDBSection.findItem("sakila (/edited)", dbMaxLevel);

            await treeSakilaEdited?.collapse();

            await (await treeDBSection.findItem("sakila", dbMaxLevel)).expand();

            await (await treeDBSection.findItem("Tables", dbMaxLevel)).expand();

            const treeActor = await treeDBSection.findItem("actor", dbMaxLevel);

            await Misc.selectContextMenuItem(treeActor, "Add Database Object to REST Service");

            await Misc.switchToWebView();

            const dialog = await driver.wait(until.elementLocated(By.id("mrsSchemaDialog")),
                explicitWait, "MRS Schema dialog was not displayed");

            await dialog.findElement(By.id("ok")).click();

            await Misc.verifyNotification("The MRS Database Object actor has been added successfully", true);

            await treeSakilaEdited?.expand();

            expect(await treeDBSection.findItem("actor (/actor)", dbMaxLevel)).to.exist;
        });

        it("Delete REST Schema", async () => {

            await treeRandomService?.expand();

            const schema = await treeMySQLRESTSchema.getLabel();

            await Misc.selectContextMenuItem(treeMySQLRESTSchema!, "Delete REST Schema...");

            await Misc.verifyNotification("Are you sure the MRS schema sakila should be deleted?", false);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS schema has been deleted successfully");

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            expect(await treeDBSection.findItem(schema, dbMaxLevel)).to.not.exist;

        });

        it("Delete REST Service", async () => {

            await Misc.selectContextMenuItem(treeRandomService!, "Delete REST Service...");

            const label = await treeRandomService?.getLabel();

            await Misc.verifyNotification(`Are you sure the MRS service ${String(label)} should be deleted?`);

            const workbench = new Workbench();
            const ntfs = await workbench.getNotifications();

            await ntfs[ntfs.length - 1].takeAction("Yes");

            await Misc.verifyNotification("The MRS service has been deleted successfully", true);

            await Misc.clickSectionToolbarButton(treeDBSection, "Reload the connection list");

            treeDBSection = await Misc.getSection(dbTreeSection);

            expect(await treeDBSection.findItem(label, dbMaxLevel)).to.not.exist;
        });
    });

});
