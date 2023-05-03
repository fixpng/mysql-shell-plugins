/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { readFile, writeFile } from "fs/promises";

import { commands, OpenDialogOptions, SaveDialogOptions, Uri, window } from "vscode";

import {
    IEditorCloseChangeData, IEditorOpenChangeData, IMrsDbObjectEditRequest, IOpenDialogOptions, IOpenFileDialogResult,
    requisitions,
} from "../../../frontend/src/supplement/Requisitions";

import { IMySQLDbSystem } from "../../../frontend/src/communication";
import { EntityType, IDBEditorScriptState } from "../../../frontend/src/modules/db-editor";
import { DBEditorModuleId } from "../../../frontend/src/modules/ModuleInfo";
import { EditorLanguage, INewScriptRequest, IRunQueryRequest, IScriptRequest } from "../../../frontend/src/supplement";
import { IShellSessionDetails } from "../../../frontend/src/supplement/ShellInterface";
import { showMessageWithTimeout } from "../utilities";
import { WebviewProvider } from "./WebviewProvider";

export class DBConnectionViewProvider extends WebviewProvider {
    /**
     * Shows the given module page.
     *
     * @param page The page to show.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public show(page: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page } },
        ], "newConnection");
    }

    /**
     * Shows a sub part of a page.
     *
     * @param pageId The page to open in the webview tab (if not already done). Can either be the name of a page
     *               or a connection id.
     * @param type The type of the section.
     * @param id The id of the item to be selected.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public showPageSection(pageId: string, type: EntityType, id: string): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: pageId } },
            { requestType: "showPageSection", parameter: { id, type } },
        ], "newConnection");
    }

    /**
     * Executes a single statement in a webview tab.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details Required information about the query that must be executed.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runQuery(page: string, details: IRunQueryRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page, suppressAbout: true } },
            { requestType: "editorRunQuery", parameter: details },
        ], details.linkId === -1 ? "newConnection" : "newConnectionWithEmbeddedSql");
    }

    /**
     * Executes a full script in a webview tab.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public runScript(page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            {
                requestType: "showPage", parameter:
                    { module: DBEditorModuleId, page, suppressAbout: true, noEditor: true },
            },
            { requestType: "editorRunScript", parameter: details },
        ], "newConnection");
    }

    /**
     * Opens a new script editor in the webview tab and loads the given content into it.
     *
     * @param page The page to open in the webview tab (if not already done).
     * @param details The content of the script to run and other related information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editScriptInNotebook(page: string, details: IScriptRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page, suppressAbout: true } },
            { requestType: "editorEditScript", parameter: details },
        ], "newConnection");
    }

    /**
     * Inserts data from a script (given by a module data id) into this connection editor.
     * The editor must already exist.
     *
     * @param state The script information.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public insertScriptData(state: IDBEditorScriptState): Promise<boolean> {
        if (state.dbDataId) {
            return this.runCommand("editorInsertUserScript",
                { language: state.language, resourceId: state.dbDataId }, "newConnection");
        }

        return Promise.resolve(false);
    }

    /**
     * Opens the dialog for adding a new connection on the app.
     *
     * @param mdsData Additional data for MDS connections.
     * @param profileName The config profile name for MDS connections.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public addConnection(mdsData?: IMySQLDbSystem, profileName?: String): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "addNewConnection", parameter: { mdsData, profileName } },
        ], "connections");
    }

    /**
     * Removes the connection from the stored connection list.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public removeConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "removeConnection", parameter: connectionId },
        ], "connections");
    }

    /**
     * Shows the connection editor on the connections page for the given connection id.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "editConnection", parameter: connectionId },
        ], "connections");
    }

    /**
     * Shows the connection editor on the connections page with a duplicate of the given connection.
     *
     * @param connectionId The connection id.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public duplicateConnection(connectionId: number): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page: "connections" } },
            { requestType: "duplicateConnection", parameter: connectionId },
        ], "connections");
    }

    public renameFile(request: IScriptRequest): Promise<boolean> {
        // Can only be called if a connection is active. This is the bounce-back from a save request from a connection.
        return this.runCommand("job", [
            { requestType: "editorRenameScript", parameter: request },
        ], "connections");
    }

    /**
     * Closes the editor with the given id in the webview tab.
     *
     * @param connectionId The id of the webview tab.
     * @param editorId The id of the editor to close.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public closeEditor(connectionId: number, editorId: string): Promise<boolean> {
        return this.runCommand("job", [
            // No need to send a showModule request here. The module must exist or the editor wouldn't be open.
            { requestType: "editorClose", parameter: { connectionId, editorId } },
        ], "");
    }

    public reselectLastItem(): void {
        void requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "editorSelect",
                parameter: { connectionId: -1, editorId: "" },
            },
        });
    }

    /**
     * We have 2 entry points to create new scripts. One is from the web app via a remote request. The other is from the
     * extension via a local request. This method handles the local request.
     *
     * @param language The language of the script to create.
     */
    public createScript(language: EditorLanguage): void {
        void requisitions.execute("proxyRequest", {
            provider: this,
            original: {
                requestType: "createNewScript",
                parameter: language,
            },
        });
    }

    /**
     * Shows the MRS DB object editor dialog.
     *
     * @param page The page to show.
     * @param data Details of the object to edit.
     *
     * @returns A promise which resolves after the command was executed.
     */
    public editMrsDbObject(page: string, data: IMrsDbObjectEditRequest): Promise<boolean> {
        return this.runCommand("job", [
            { requestType: "showModule", parameter: DBEditorModuleId },
            { requestType: "showPage", parameter: { module: DBEditorModuleId, page } },
            { requestType: "showMrsDbObjectDialog", parameter: data },
        ], "newConnection");
    }

    protected requisitionsCreated(): void {
        super.requisitionsCreated();

        if (this.requisitions) {
            // For requests sent by the web app. These are often forwarded to the global extension requisitions.
            this.requisitions.register("refreshConnections", this.refreshConnections);
            this.requisitions.register("refreshOciTree", this.refreshOciTree);
            this.requisitions.register("codeBlocksUpdate", this.updateCodeBlock);
            this.requisitions.register("editorSaveScript", this.editorSaveScript);
            this.requisitions.register("createNewScript", this.createNewScript);
            this.requisitions.register("newSession", this.createNewSession);
            this.requisitions.register("closeInstance", this.closeInstance);
            this.requisitions.register("editorsChanged", this.editorsChanged);
            this.requisitions.register("editorSelect", this.editorSelect);
            this.requisitions.register("showInfo", this.showInfo);
            this.requisitions.register("editorSaveNotebook", this.editorSaveNotebook);
            this.requisitions.register("editorLoadNotebook", this.editorLoadNotebook);
            this.requisitions.register("showOpenDialog", this.showOpenDialog);
        }
    }

    protected refreshConnections = (): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "refreshConnections", parameter: undefined },
        });
    };

    protected refreshOciTree = (): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "refreshOciTree", parameter: undefined },
        });
    };

    protected updateCodeBlock = (data: { linkId: number; code: string; }): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "codeBlocksUpdate", parameter: data },
        });
    };

    private editorSaveScript = (details: IScriptRequest): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "editorSaveScript", parameter: details },
        });
    };

    private createNewScript = (details: INewScriptRequest): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "createNewScript", parameter: details },
        });
    };

    private createNewSession = async (_details: IShellSessionDetails): Promise<boolean> => {
        await commands.executeCommand("msg.newSession");

        return true;
    };

    private editorsChanged = (details: IEditorOpenChangeData | IEditorCloseChangeData): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "editorsChanged", parameter: details },
        });
    };

    private editorSelect = (details: { connectionId: number, editorId: string; }): Promise<boolean> => {
        return requisitions.execute("proxyRequest", {
            provider: this,
            original: { requestType: "editorSelect", parameter: details },
        });
    };

    private showInfo = (values: string[]): Promise<boolean> => {
        showMessageWithTimeout(values.join("\n"), 5000);

        return Promise.resolve(true);
    };

    /**
     * Sent when a notebook shall be saved. This comes in two flavours: either with no content, which means the content
     * must be created first (which is only handled by the frontend), or with content, which means the user has to
     * select a file to save to.
     *
     * This is used for notebook content in a DB editor tab. There's a separate implementation for a standalone
     * notebook file here {@link NotebookEditorProvider.triggerSave}.
     *
     * @param content The content to save.
     *
     * @returns A promise which resolves to true if the save was successful.
     */
    private editorSaveNotebook = (content?: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (content) {
                const dialogOptions: SaveDialogOptions = {
                    title: "",
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        "MySQL Notebook": ["mysql-notebook"],
                    },
                    saveLabel: "Save Notebook",
                };

                void window.showSaveDialog(dialogOptions).then((uri: Uri) => {
                    const path = uri.fsPath;
                    writeFile(path, content).then(() => {
                        return resolve(true);
                    }).catch(() => {
                        void window.showErrorMessage(`Could not save notebook to ${path}.`);

                        return resolve(false);
                    });
                });
            } else {
                return resolve(false);
            }
        });
    };

    /**
     * Sent when a notebook shall be loaded. The user has to select a file to load from. The content of the file is
     * then sent back to the frontend and used there to add a new notebook.
     *
     * This is used for notebook content in a DB editor tab. There's a separate implementation for a standalone
     * notebook file here {@link NotebookEditorProvider.triggerLoad}.
     *
     * @returns A promise which resolves to true if the save was successful.
     */
    private editorLoadNotebook = (): Promise<boolean> => {
        return new Promise((resolve) => {
            const dialogOptions: OpenDialogOptions = {
                title: "",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "MySQL Notebook": ["mysql-notebook"],
                },
                openLabel: "Open Notebook",
            };

            void window.showOpenDialog(dialogOptions).then((paths?: Uri[]) => {
                if (paths && paths.length > 0) {
                    const path = paths[0].fsPath;
                    readFile(path, { encoding: "utf-8" }).then((content) => {
                        this.requisitions?.executeRemote("editorLoadNotebook", { content, standalone: false });
                    }).catch(() => {
                        void window.showErrorMessage(`Could not load notebook from ${path}.`);
                    });
                }

                resolve(true);
            });
        });
    };

    private showOpenDialog = (options: IOpenDialogOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            const dialogOptions = {
                id: options.id,
                defaultUri: Uri.file(options.default ?? ""),
                openLabel: options.openLabel,
                canSelectFiles: options.canSelectFiles,
                canSelectFolders: options.canSelectFolders,
                canSelectMany: options.canSelectMany,
                filters: options.filters,
                title: options.title,

            };

            void window.showOpenDialog(dialogOptions).then((paths?: Uri[]) => {
                if (paths) {
                    const result: IOpenFileDialogResult = {
                        resourceId: dialogOptions.id ?? "",
                        path: paths.map((path) => {
                            return path.fsPath;
                        }),
                    };
                    void this.requisitions?.executeRemote("selectFile", result);
                }

                resolve(true);
            });
        });
    };

    private closeInstance = (): Promise<boolean> => {
        this.close();

        return Promise.resolve(true);
    };

}
