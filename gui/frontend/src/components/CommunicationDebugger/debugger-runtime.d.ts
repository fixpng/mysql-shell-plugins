/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */

declare interface INativeShellDictionary {
    [key: string]: string | number | boolean | undefined | INativeShellDictionary[] | INativeShellDictionary;
}

/** A data record for requests sent to the backend. */
declare interface INativeShellRequest extends INativeShellDictionary {
    /** A unique ID to identify this request. It's used for all responses. */
    request_id: string;

    /** The request to be executed. */
    request: string;

    /** Optional field to carry the command if this is an execution request. */
    command?: string;

    /** Optional arguments for the command. */
    args?: INativeShellDictionary;
}

declare interface INativeShellResponse extends INativeShellDictionary {
    /** A unique ID to identify this request. It's used for all responses. */
    request_id: string;

    /** Information about the request (success or error, with a short response message). */
    request_state: {
        type: string;
        msg: string;
    };
}

declare class DebuggerWebSocket {
    /** Indicates if a connection is currently being established. */
    public readonly isConnecting: boolean;

    /** Indicates if a connection is currently active. */
    public readonly isConnected: boolean;

    /**
     * Returns the last unique ID which was generated by calling `generateRequestId()`.
     *
     * @returns The generated id or an empty string if no id was generated since the last execution of the script.
     */
    public readonly lastGeneratedRequestId: string;

    /**
     * A field to store script data in. Variables are not kept alive between script calls, so use this member
     * for storing temporary data.
     */
    public readonly tokens: object;

    /** Returns the module session ID of the last server response that returned such an ID (usually start_session). */
    public get lastModuleSessionId(): string | undefined;

    /** The full response last received for a given request (if any). */
    public get lastResponse(): INativeShellResponse | undefined;

    /** The last returned backend error (if any). */
    public get lastError(): INativeShellResponse | undefined;

    /**
     * @returns a special value which indicates that the member in an object or array should be ignored
     * when comparing the owning object/array to another object/array.
     */
    public get ignore(): Symbol;

    /** Opens the web socket connection to the backend (ignored if already connected). */
    public connect(): void;

    /** Closes the web socket connection to the backend (ignored if no connection exists). */
    public disconnect(): void;

    /** A disconnect call followed by a connect call. */
    public reconnect(): void;

    /**
     * Resets all state fields to their initial value (tokens, lastGeneratedRequestId, lastModuleSessionId,
     * lastResponse, lastError).
     * This is usually called each time a script is executed in the debugger, but can also be used in the script itself.
     */
    public clearState(): void;

    /**
     * Allows to send a request to the backend.
     *
     * @param data A record containing the request details (like what to execute and the request ID).
     *
     * @returns A promise with the data of the first response from the server for this request. All further responses
     *          are ignored.
     */
    public send(data: INativeShellRequest): Promise<INativeShellResponse>;

    /**
     * Generates a new unique identifier (uuid) which can be used to identify requests to the backend.
     * The value is also stored and can be retrieved with `lastGeneratedRequestId`.
     */
    public generateRequestId(): string;

    /** Prints the given value to the output console. Objects are formatted as human readable JSON text. */
    public log(output: unknown): void;

    /**
     * Validation (test) function to determine if two responses are equal. The comparison is recursively done on a
     * field-by-field basis, so that the order of the fields doesn't matter. Additionally, special values are supported
     * to guide and enhance the comparison process. See the fields/functions: `ignore` and `matchRegexp`.
     *
     * The function will send the comparison result to the log as comments.
     *
     * @param actual A single response received from the backend.
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     *
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateResponse(actual: unknown, expected: unknown, responseIndex?: number): boolean;

    /**
     * Convenience function to validate the last received response. It uses `validateResponse` to do the actual work.
     *
     * @param expected A structure describing the expected values in the actual response.
     * @param responseIndex An optional index which, when given, adds the number to the output.
     *
     * @returns True if both values are semantically equal, otherwise false.
     */
    public validateLastResponse(expected: unknown, responseIndex?: number): boolean;

    /**
     * Sends the specified request to the backend and waits for the responses. Fulfills the returned promise when all
     * responses arrived or a timeout of 3 seconds happened, whatever comes first.
     *
     * @param data The request to send.
     * @param expected A list of responses to compare to. The function will not fulfill the promise until the same
     *                 number of responses have been received, as there are items in this list. If not enough responses
     *                 come in during a specific time frame (3 secs currently) the validation will fail.
     *                 Any extraneous response is ignore, once all items in the expected list have been processed.
     */
    public sendAndValidate(data: INativeShellRequest, expected: INativeShellResponse[]): Promise<void>;

    /**
     * Loads the script at the given path and executes it.
     *
     * @param path The path to the script to execute.
     */
    public execute(path: string): Promise<void>;

    /**
     * @returns a special value which indicates that the member in an object or array should be matched against
     * the given pattern, when comparing the owning object/array to another object/array.
     *
     * @param pattern The pattern to match.
     */
    public matchRegexp(pattern: string): Symbol;
}

declare const ws: DebuggerWebSocket;
