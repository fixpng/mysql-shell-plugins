/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
 * separately licensed software that they have either included with
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

/* eslint-disable max-classes-per-file */

export class NotFoundError extends Error {
    public constructor(public msg: string) {
        super(msg);
    }
}

export interface IMrsFetchData {
    [key: string]: unknown,
}

export interface IMrsFetchInput {
    errorMsg?: string;
    method?: string;
    body?: object | IMrsFetchData;
    input: string;
    timeout?: number;
}

export interface IMrsAuthUser {
    name: string;
    email: string;
}

export interface IMrsAuthStatus {
    status: string;
    user?: IMrsAuthUser;
}

interface IAuthChallenge {
    nonce: string;
    iterations: number;
    salt: Uint8Array;
    session?: string;
}

interface IMrsLoginState {
    userName?: string;
    password?: string;
    clientFirst?: string;
    clientFinal?: string;
    serverFirst?: string;
    challenge?: IAuthChallenge;
    loginError?: string;
}

export interface IMrsLoginResult {
    authApp?: string;
    jwt?: string;
    errorCode?: number;
    errorMessage?: string;
}

// --- MySQL Shell for VS Code Extension Remove --- Begin
declare const mrsLoginResult: IMrsLoginResult | undefined;
// --- MySQL Shell for VS Code Extension Remove --- End

/**
 * Implements a session that is used by a MrsService to perform fetch() calls.
 *
 * The session also supports authentication via MRS AuthApps.
 */
export class MrsBaseSession {
    public accessToken?: string;
    public authApp?: string;

    protected loginState: IMrsLoginState = {};

    public constructor(
        protected serviceUrl: string,
        protected authPath = "/authentication",
        protected defaultTimeout = 8000) {
        // --- MySQL Shell for VS Code Extension Only --- Begin
        try {
            // Try to get global mrsLoginResult values when already authenticated in the DB NoteBook
            this.accessToken = mrsLoginResult?.jwt;
            this.authApp = mrsLoginResult?.authApp;
        } catch (_e) {
            // Ignore
        }
        // --- MySQL Shell for VS Code Extension Only --- End
    }

    /**
     * A small wrapper around fetch() that uses the active JWT accessToken to the MRS and throws
     * an exception if the response was not OK
     *
     * @param input The RequestInfo, either a URL string or a JSON object with named parameters
     * @param errorMsg The error message to include in the exception if the fetch is not successful
     * @param method The HTTP method to use with GET being the default
     * @param body The request body as object
     * @param autoResponseCheck Set to false if the error checking should not be performed
     * @param timeout The timeout for this fetch call. If not specified, the default timeout of the session is used.
     *
     * @returns The response object
     */
    public doFetch = async (input: string | IMrsFetchInput, errorMsg?: string,
        method?: string, body?: object | IMrsFetchData, autoResponseCheck = true,
        timeout?: number): Promise<Response> => {
        // Check if parameters are passed as named parameters and if so, assign them
        if (typeof input === "object" && input !== null) {
            errorMsg = input?.errorMsg ?? "Failed to fetch data.";
            method = input?.method ?? "GET";
            body = input?.body;
            timeout = input?.timeout;
            input = input?.input;
        } else {
            errorMsg = errorMsg ?? "Failed to fetch data.";
            method = method ?? "GET";
        }

        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => { controller.abort(); }, timeout ?? this.defaultTimeout);
        let response;

        try {
            response = await fetch(`${this.serviceUrl ?? ""}${input}`, {
                method,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: (this.accessToken !== undefined) ? { Authorization: "Bearer " + this.accessToken } : undefined,
                body: (body !== undefined) ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (e) {
            throw new Error(`${errorMsg}\n\nPlease check if MySQL Router is running and the REST endpoint ` +
                `${this.serviceUrl ?? ""}${input} does exist.\n\n${(e instanceof Error) ? e.message : String(e)}`);
        } finally {
            clearTimeout(timeoutTimer);
        }

        if (!response.ok && autoResponseCheck) {
            // Check if the current session has expired
            if (response.status === 401) {
                /* this.setState({ restarting: true });
                window.alert("Your current session expired. You will be logged in again.");

                void this.startLogin(authApp); */
                throw new Error(`Not authenticated. Please authenticate first before accessing the ` +
                    `path ${this.serviceUrl ?? ""}${input}.`);
            }

            let errorInfo;
            try {
                errorInfo = await response.json();
            } catch (e) {
                throw new Error(`${response.status}. ${errorMsg} (${response.statusText})`);
            }
            // If there is a message, throw with that message
            if (typeof errorInfo.message === "string") {
                throw new Error(String(errorInfo.message));
            } else {
                throw new Error(`${response.status}. ${errorMsg} (${response.statusText})` +
                    `${(errorInfo !== undefined) ? ("\n\n" + JSON.stringify(errorInfo, null, 4) + "\n") : ""}`);
            }
        }

        return response;
    };

    /**
     * Gets the authentication status of the current session as defined by the accessToken
     *
     * @returns The response object with {"status":"authorized", "user": {...}} or {"status":"unauthorized"}
     */
    public readonly getAuthenticationStatus = async (): Promise<IMrsAuthStatus> => {
        try {
            return (await (await this.doFetch(
                { input: `/authentication/status`, errorMsg: "Failed to authenticate." })).json()) as IMrsAuthStatus;
        } catch (e) {
            return { status: "unauthorized" };
        }
    };

    public readonly verifyUserName = async (authApp: string, userName: string): Promise<void> => {
        this.authApp = authApp;

        const nonce = this.hex(crypto.getRandomValues(new Uint8Array(10)));

        const challenge: IAuthChallenge = await (await this.doFetch({
            input: `${this.authPath}/login?app=${authApp}`,
            method: "POST",
            body: {
                user: userName,
                nonce,
            },
        })).json();

        // Convert the salt to and Uint8Array
        challenge.salt = new Uint8Array(challenge.salt);

        this.loginState = {
            clientFirst: `n=${userName},r=${nonce}`,
            clientFinal: `r=${challenge.nonce}`,
            serverFirst: this.buildServerFirst(challenge),
            challenge,
            loginError: undefined,
        };
    };

    public readonly verifyPassword = async (password: string): Promise<IMrsLoginResult> => {
        const { challenge, clientFirst, serverFirst, clientFinal } = this.loginState;

        if (password !== undefined && password !== "" && this.authApp !== undefined &&
            clientFirst !== undefined && serverFirst !== undefined && challenge !== undefined &&
            clientFinal !== undefined) {
            const te = new TextEncoder();
            const authMessage = `${clientFirst},${serverFirst},${clientFinal}`;
            const clientProof = Array.from(await this.calculateClientProof(
                password, challenge.salt, challenge.iterations, te.encode(authMessage)));

            try {
                const response = await this.doFetch({
                    input: `${this.authPath}/login?app=${this.authApp}&sessionType=bearer` +
                        (challenge.session !== undefined ? "&session=" + challenge.session : ""),
                    method: "POST",
                    body: {
                        clientProof,
                        nonce: challenge.nonce,
                        state: "response",
                    },
                }, undefined, undefined, undefined, false);

                if (!response.ok) {
                    this.accessToken = undefined;

                    return {
                        authApp: this.authApp,
                        errorCode: response.status,
                        errorMessage: (response.status === 401)
                            ? "The sign in failed. Please check your username and password."
                            : `The sign in failed. Error code: ${String(response.status)}`,
                    };
                } else {
                    const result = await response.json();

                    this.accessToken = String(result.accessToken);

                    return {
                        authApp: this.authApp,
                        jwt: this.accessToken,
                    };
                }
            } catch (e) {
                return {
                    authApp: this.authApp,
                    errorCode: 2,
                    errorMessage: `The sign in failed. Server Error: ${String(e)}`,
                };
            }
        } else {
            return {
                authApp: this.authApp,
                errorCode: 1,
                errorMessage: `No password given.`,
            };
        }
    };

    private readonly hex = (arrayBuffer: Uint8Array): string => {
        return Array.from(new Uint8Array(arrayBuffer))
            .map((n) => { return n.toString(16).padStart(2, "0"); })
            .join("");
    };

    private readonly buildServerFirst = (challenge: IAuthChallenge): string => {
        const b64Salt = window.btoa(String.fromCharCode.apply(null, Array.from(challenge.salt)));

        return `r=${challenge.nonce},s=${b64Salt},i=${String(challenge.iterations)}`;
    };

    private readonly calculatePbkdf2 = async (password: BufferSource, salt: Uint8Array,
        iterations: number): Promise<Uint8Array> => {
        const ck1 = await crypto.subtle.importKey(
            "raw", password, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]);
        const result = new Uint8Array(await crypto.subtle.deriveBits(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations }, ck1, 256));

        return result;
    };

    private readonly calculateSha256 = async (data: BufferSource): Promise<Uint8Array> => {
        return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    };

    private readonly calculateHmac = async (secret: BufferSource, data: BufferSource): Promise<Uint8Array> => {
        const key = await window.crypto.subtle.importKey(
            "raw", secret, { name: "HMAC", hash: { name: "SHA-256" } }, true, ["sign", "verify"]);
        const signature = await window.crypto.subtle.sign("HMAC", key, data);

        return new Uint8Array(signature);
    };

    private readonly calculateXor = (a1: Uint8Array, a2: Uint8Array): Uint8Array => {
        const l1 = a1.length;
        const l2 = a2.length;
        // cSpell:ignore amax
        let amax;
        let amin;
        let loop;

        if (l1 > l2) {
            amax = new Uint8Array(a1);
            amin = a2;
            loop = l2;
        } else {
            amax = new Uint8Array(a2);
            amin = a1;
            loop = l1;
        }

        for (let i = 0; i < loop; ++i) {
            amax[i] ^= amin[i];
        }

        return amax;
    };

    private readonly calculateClientProof = async (password: string, salt: Uint8Array, iterations: number,
        authMessage: Uint8Array): Promise<Uint8Array> => {
        const te = new TextEncoder();
        const saltedPassword = await this.calculatePbkdf2(te.encode(password), salt, iterations);
        const clientKey = await this.calculateHmac(saltedPassword, te.encode("Client Key"));
        const storedKey = await this.calculateSha256(clientKey);
        const clientSignature = await this.calculateHmac(storedKey, authMessage);
        const clientProof = this.calculateXor(clientSignature, clientKey);

        return clientProof;
    };
}

export interface IMrsAuthApp {
    name: string;
    vendorId: string;
}

/**
 * Represents a MRS Service base class.
 *
 * MRS Service classes derive from this base class and add public MRS Schema objects that allow the user to work with
 * the MRS Service's MRS Schemas.
 *
 * Each services uses its own MrsBaseSession session to perform all fetch operations.
 */
export class MrsBaseService {
    public session: MrsBaseSession;

    public constructor(
        public readonly serviceUrl: string,
        protected readonly authPath = "/authentication",
        protected readonly defaultTimeout = 8000) {
        this.session = new MrsBaseSession(serviceUrl, authPath, defaultTimeout);
    }

    public readonly getAuthApps = async (): Promise<IMrsAuthApp[] | undefined> => {
        const response = await this.session.doFetch({
            input: `${this.authPath}/authApps`,
            timeout: 3000,
            errorMsg: "Failed to fetch Authentication Apps.",
        });

        if (response.ok) {
            const result = await response.json();

            return result as IMrsAuthApp[];
        } else {
            let errorInfo = null;
            try {
                errorInfo = await response.json();
            } catch (e) {
                // Ignore the exception
            }
            const errorDesc = "Failed to fetch Authentication Apps.\n\n" +
                "Please ensure MySQL Router is running and the REST endpoint " +
                `${String(this.serviceUrl)}${this.authPath}/authApps is accessible. `;

            throw new Error(errorDesc + `(${response.status}:${response.statusText})` +
                `${(errorInfo !== undefined) ? ("\n\n" + JSON.stringify(errorInfo, null, 4) + "\n") : ""}`);
        }
    };
}

/**
 * Represents a MRS Schema base class.
 *
 * All MRS Schema classes derive from this class.
 */
export class MrsBaseSchema {
    public constructor(
        public service: MrsBaseService,
        public requestPath: string) {
    }
}

export interface IMrsOperator {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "=": "$eq",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "!=": "$ne",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "<": "$lt",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "<=": "$lte",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ">": "$gt",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ">=": "$gte",
    "like": "$like",
    "null": "$null",
    "notNull": "$notnull",
    "between": "$between",
}

/**
 * A collection of MRS resources is represented by a JSON object returned by the MySQL Router, which includes the list
 * of underlying resource objects and additional hypermedia-related properties with pagination state and the
 * relationships with additional resources.
 * @see MrsResourceObject
 * @see IMrsLink
 * @see JsonObject
 */
export type IMrsResourceCollectionData<C> = {
    items: Array<MrsResourceObject<C>>,
    limit: number,
    offset?: number,
    hasMore: boolean,
    count: number,
    links?: IMrsLink[]
} & JsonObject;

/**
 * A single MRS resource object is represented by JSON object returned by the MySQL Router, which includes the
 * corresponding fields and values alongside additional hypermedia-related properties.
 * @see IMrsResourceData
 */
export type MrsResourceObject<T> = T & IMrsResourceData;

/**
 * A resource object is always represented as JSON and can include specific hypermedia properties such as a potential
 * list of links it has with other resources and metadata associated to the resource (e.g. its ETag).
 * @see IMrsLink
 * @see IMrsResourceMetadata
 * @see JsonObject
 */
export type IMrsResourceData = {
    links: IMrsLink[];
    _metadata: IMrsResourceMetadata;
} & JsonObject;

/**
 * Resource metadata includes the resource ETag.
 */
export interface IMrsResourceMetadata {
    etag: string;
}

/**
 * A link definition includes a type of relationship between two resources and a URL for accessing the other resource
 * in that relationship.
 */
export interface IMrsLink {
    rel: string,
    href: string,
}

export interface IMrsProcedureResultColumn {
    name: string;
    type: string;
}

export interface IMrsProcedureResultColumns {
    columns: IMrsProcedureResultColumn[];
}

export interface IMrsProcedureResult {
    type: string;
    items: IMrsFetchData;
    _metadata: IMrsProcedureResultColumn[];
}

export interface IMrsProcedureResultList<C> {
    items: C[],
}

export interface IMrsFunctionResult<C> {
    result: C,
}

export interface IMrsDeleteResult {
    itemsDeleted: number;
}

export type DataFilter<Type> = DelegationFilter<Type> | HighOrderFilter<Type>;

export type DelegationFilter<Type> = {
    [Key in keyof Type]?: DataFilterField<Type, Type[Key]> | Type[Key] | Array<ComparisonOpExpr<Type[Key]>>
};

/**
 * An object containing checks that should apply for the value of one or more fields.
 * @example
 * { name: "foo", age: 42 }
 * { name: { $eq: "foo" }, age: 42 }
 * { name: "foo", age: { $gte: 42 } }
 * { name: { $like: "%foo%" }, age: { $lte: 42 } }
 */
export type PureFilter<Type> = {
    [Key in keyof Type]: ComparisonOpExpr<Type[Key]> | Type[Key]
};

/**
 * An object that specifies multiple filters which must all be verified (AND) or alternatively, or in which only some
 * of them are verified (OR).
 * @example
 * { $and: [{ name: "foo" }, { age: 42 }] }
 * { $or: [{ name: { $eq: "foo" } }, { age: { $gte: 42 }}] }
 * @see {PureFilter}
 */
export type HighOrderFilter<Type> = {
    // $and/$or can work for a subset of fields, so we need Partial
    [Key in BinaryOperator]?: Array<PureFilter<Partial<Type>> | HighOrderFilter<Type>>
};

/**
 * An object that specifies an explicit operation to check against a given value.
 * @example
 * { $eq: "foo" }
 * { $gte: 42 }
 * { not: null }
 * { $between: [1, 2] }
 * @see {ISimpleOperatorProperty}
 */
export type ComparisonOpExpr<Type> = {
    [Operator in keyof ISimpleOperatorProperty]?: Type & ISimpleOperatorProperty[Operator]
} & {
    [Operator in "$notnull" | "$null"]?: boolean | null
} & {
    not?: null;
} & {
    $between?: NullStartingRange<Type & BetweenRegular> | NullEndingRange<Type & BetweenRegular>;
};

type NullStartingRange<Type> = readonly [Type | null, Type];
type NullEndingRange<Type> = readonly [Type, Type | null];

type BetweenRegular = string | number | Date;

interface ISimpleOperatorProperty {
    "$eq": string | number | Date;
    "$gt": number | Date;
    "$instr": string;
    "$gte": number | Date;
    "$lt": number | Date;
    "$lte": number | Date;
    "$like": string;
    "$ne": string | number | Date;
    "$ninstr": string;
}

export type BinaryOpExpr<ParentType, Type> = {
    [Operator in BinaryOperator]?: Array<BinaryOperatorParam<ParentType, Type>>
};

export type DataFilterField<ParentType, Type> = ComparisonOpExpr<Type> | BinaryOpExpr<ParentType, Type>;

export type BinaryOperatorParam<ParentType, Type> = ComparisonOpExpr<Type> | DelegationFilter<ParentType>;

export type BinaryOperator = "$and" | "$or";

export type ColumnOrder<Type> = {
    [Key in keyof Type]?: "ASC" | "DESC" | 1 | -1
};

// Prisma-like API type definitions.

// We need to distinguish between primitive types and objects (arrays and pojos) in order to
// determine if there are nesting levels to inspect.
type Primitive =
    | null
    | undefined
    | string
    | number
    | boolean
    | symbol
    | bigint;

/**
 * A JSON object contains keys which are strings and values in a specific range of primitives.
 */
export type JsonObject = { [Key in string]: JsonValue } & { [Key in string]?: JsonValue | undefined };

/**
 * A JSON array is just a list of valid JSON values.
 * Since ReadonlyArray is a first-class type in TypeScript, it needs to be accounted for.
 */
type JsonArray = JsonValue[] | readonly JsonValue[];

/**
 * JSON supports a set of primitives that includes strings, numbers, booleans and null.
 */
type JsonPrimitive = string | number | boolean | null;

/**
 * JSON supports a set of values that includes specific primitive types, other JSON object definitions
 * and arrays of these.
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * Columns can be assigned "NOT NULL" constraints, which can be enforced by the client type.
 * However, columns without that constraint should allow "null" assignments.
 */
export type MaybeNull<T> = T | null;

/**
 * A GEOMETRY column can store geometry values of any single-value spatial type.
 */
export type Geometry = Point | LineString | Polygon;

/**
 * A GEOMETRYCOLLECTION column can store a collection of objects of the same spatial type.
 */
export type GeometryCollection = MultiPoint | MultiLineString | MultiPolygon;

/**
 * In Well-Known Text (WKT) format the type name can be UPPERCASE or PascalCase. In this case, the PascalCase version is
 * determined by the non-generic type.
 */
type WellKnownText<T extends string> = T | Uppercase<T>;

/**
 * A position represents a coordinate in the grid.
 */
type Position = [number, number];

/**
 * A Point consists of a single position in the grid.
 */
export type Point = WellKnownText<`Point(${number} ${number})`> | {
    type: "Point";
    coordinates: Position;
};

/**
 * A MultiPoint consists of a list of positions in the grid.
 */
export type MultiPoint = WellKnownText<`MultiPoint(${string})`> | {
    type: "MultiPoint";
    coordinates: Position[];
};

/**
 * A LineString consists of two or more positions in the grid.
 */
export type LineString = WellKnownText<`LineString(${string})`> | {
    type: "LineString";
    coordinates: [Position, Position, ...Position[]];
};

/**
 * A MultiLineString consists of a list where each element consists of two or more positions in the grid.
 */
export type MultiLineString = WellKnownText<`MultiLineString(${string})`> | {
    type: "MultiLineString";
    coordinates: Array<[Position, Position, ...Position[]]>;
};

/**
 * A linear ring is a closed LineString with four or more positions. The first and last positions are equivalent, and
 * they MUST contain identical values; their representation SHOULD also be identical. A linear ring is the boundary of
 * a surface or the boundary of a hole in a surface. A linear ring MUST follow the right-hand rule with respect to the
 * area it bounds, i.e., exterior rings are counterclockwise, and holes are clockwise.
 * Apart from the minimum number of positions, the remaining constraints are not feasible to enforce via a TypeScript
 * type definition.
 */
type LinearRing = [Position, Position, Position, Position, ...Position[]];

/**
 * A Polygon consists of a list of linear rings. For Polygons with more than one of these rings, the first MUST be the
 * exterior ring, and any others MUST be interior rings. The exterior ring bounds the surface, and the interior rings
 * (if present) bound holes within the surface. This constraint is not feasible to enforce via a TypeScript type
 * definition.
 */
export type Polygon = WellKnownText<`Polygon(${string})`> | {
    type: "Polygon";
    coordinates: LinearRing[];
};

/**
 * A MultiPolygon consists of a list where each element is itself a list of linear rings.
 */
export type MultiPolygon = WellKnownText<`MultiPolygon(${string})`> | {
    type: "MultiPolygon";
    coordinates: LinearRing[][];
};

// A filter can apply to different kind of operations - find*(), delete*() and update*().
// Each operation should determine whether it is required or not.
export interface IFilterOptions<Filterable> {
    where: DataFilter<Filterable>;
}

/**
 * A cursor is a field which is unique and sequential. Examples are auto generated columns (such as ones created with
 * "AUTO INCREMENT") or TIMESTAMP columns.
 */
export type Cursor<EligibleFields> = {
    [Key in keyof EligibleFields]?: EligibleFields[Key]
};

// create*() API

// For now, to create a record we only need to specify the details of that specific record.
export interface ICreateOptions<Type> {
    data: Type;
}

/** Options available to find a record based on a unique identifier or primary key */
export interface IFindUniqueOptions<Item, Filterable> extends Partial<IFilterOptions<Filterable>> {
    // findUnique() should always return the same record based on the unique identifier or primary key.
    // The identifier is still specified using the "where" option.
    // Thus the only additional option available is to include a set of specific fields of that record in the result
    // set.

    // "select" determines which fields are included in the result set.
    // It supports both an object with boolean toggles to select or ignore specific fields or an array of field names
    // to include. Nested JSON/Relational duality fields can be specified using nested objects or with boolean toggles
    // or an array with field names containing the full field path using dot "." notation

    /** Fields to include in the result set. */
    select?: BooleanFieldMapSelect<Item> | FieldNameSelect<Item>;
}

/** Options available to find the first record that optionally matches a given filter. */
export interface IFindFirstOptions<Item, Filterable, Iterable> extends IFindUniqueOptions<Item, Filterable> {
    cursor?: Cursor<Iterable>;
    /* Return the first or last record depending on the specified order clause. */
    orderBy?: ColumnOrder<Filterable>;
    /** Skip a given number of records that match the same filter. */
    skip?: number;
}

/** Options available to find multiple that optionally match a given filter. */
export interface IFindManyOptions<Item, Filterable, Iterable> extends IFindFirstOptions<Item, Filterable, Iterable> {
    /** Enables or disables iterator behavior for findMany(). */
    iterator?: boolean;
    /** Set the maximum number of records in the result set. */
    take?: number;
}

/** Options available to customize the result set page size. */
export interface IFindAllOptions<Item, Filterable, Iterable> extends IFindFirstOptions<Item, Filterable, Iterable> {
    /**
     * Asynchronous function to handle progress updates.
     * @param items The list of records in the result set.
     * @returns A Promise that resolves once the result set is complete.
     */
    progress?: (items: Item[]) => Promise<void>;
}

/**
 * Object with boolean fields that determine if the field should be included (or not) in the result set.
 * @example
 * { select: { foo: { bar: true, baz: true } }
 * { select: { foo: { qux: false } } }
 */
export type BooleanFieldMapSelect<TableMetadata> = {
    /**
     * If the column contains a primitive value the type should be a boolean, otherwise, it contains an object value
     * and the type is inferred from the corresponding children.
     */
    [Key in keyof TableMetadata]?: TableMetadata[Key] extends (
        Primitive | JsonValue) ? boolean : NestingFieldMap<TableMetadata[Key]>;
};

/**
 * List of fields identified by their full path using dot "." notation.
 * @example
 * { foo: { bar: { baz: string } } } => ['foo.bar.baz']
 */
export type FieldNameSelect<Type> = Array<FieldPath<Type>>;

/** Full path of a field. */
export type FieldPath<Type> = keyof {
    /**
     * In the presence of nested fields, the field path is composed by the names of each parent field in the branch.
     * The entire path up to the root is carried as a list of field names,
     */
    [ColumnName in keyof Type & string as NestingPath<ColumnName, Type[ColumnName]>]?: unknown;
};

/**
 * When a field contains a primitive value (i.e. not an object), it is a valid stop condition, otherwise it is a nested
 * field and the entire path needs to be composed.
 */
export type NestingPath<ParentPath extends string, Child> = Child extends (Primitive | JsonValue) ? ParentPath :
    `${ParentPath}.${NestingFieldName<Child> & string}`;

/**
 * With an array of field names, if a field contains an array, the path of each sub-field in the array needs to be
 * composed by iterating over the array.
 */
export type NestingFieldName<Type> = Type extends unknown[] ? FieldPath<Type[number]> : FieldPath<Type>;

/**
 * With a boolean field map, if a field contains an array, each boolean sub-field map needs to be checked by
 * iterating over the array.
 */
export type NestingFieldMap<Type> = Type extends unknown[] ? BooleanFieldMapSelect<Type[number]>
    : BooleanFieldMapSelect<Type> | boolean;

// delete*() API

// To avoid unwarranted data loss, deleting a record from the database always requires a filter (IFilterOptions
// default).
export type IDeleteOptions<Type> = IFilterOptions<Type>;

// update*() API

// To avoid unwarranted data loss, updating a record in the database always requires a filter that operates only
// using the values of primary key columns. These need columns are identified by a list containing the corresponding
// column names. Additionally, batch updates can be enabled using a specific option.
// For single updates, each primary key should match a specific value. Each match is specified in a plain JavaScript
// object.
// For batch updates, each primary key can match more than one value. Those matches are specified in a list of one or
// more plain JavaScript objects.
export interface IUpdateOptions<Instance, Type, PrimaryKeys extends Array<string & keyof Type>, Config>
    extends ICreateOptions<Instance> {
    where: Config extends IBatchConfig ? Array<UpdateMatch<Type, PrimaryKeys>> : UpdateMatch<Type, PrimaryKeys>;
}

// Specific options for batch updates.
export interface IBatchConfig {
    batch: true;
}

// Each matcher should only allow to specify values for the names of primary key columns.
export type UpdateMatch<Type, PrimaryKeys extends Array<string & keyof Type>> = {
    [ColumnName in keyof Pick<Type, PrimaryKeys[number]>]-?: Type[ColumnName]
};

class MrsJSON {
    public static stringify = <T>(obj: T): string => {
        return JSON.stringify(obj, (key: string, value: { not?: null; } & T) => {
            // expand $notnull operator (lookup at the child level)
            // if we are operating at the root of the object, "not" is a field name, in which case, there is nothing
            // left to do
            // { where: { not: { foo: null } } } => ?q={"foo":{"$notnull":"null"}}
            if (key !== "" && typeof value === "object" && value !== null && value.not === null) {
                return { $notnull: "null" };
            }

            // expand $null operator
            // { where: { foo: null } } ?q={"foo":{"$null":"null"}}
            // { where: { not: null } } => ?q={"not":{"$null":"null"}}
            if (value === null) {
                return { $null: "null" };
            }

            return value;
        });
    };
}

/**
 * @template Filterable The set of fields of a given database object that can be used in a query filter.
 * @template Iterable The set of fields of a given database object that can be used as cursors. It has a default value
 * to accommodate the cases where there is no support for cursors, such as "findAll()", "findFirst()", "delete()" and
 * "deleteMany()".
 * This is an internal abstract class to hold common functionality related to query filters
 * between different types of MRS CRUD operations.
 */
abstract class MrsRequestFilter<Filterable, Iterable={}> {
    protected queryFilter: HighOrderFilter<Filterable> = {};
    protected cursorFields: Cursor<Iterable> = {};
    protected sortOrder: ColumnOrder<Filterable> = {};

    public constructor(
        protected readonly cursor?: Cursor<Iterable>) {
        for (const key in cursor) {
            this.cursorFields[key] = cursor[key];

            if (cursor[key] !== undefined) {
                this.queryFilter = { ...this.queryFilter, [key]: { $gt: cursor[key] } };
                this.sortOrder = { ...this.sortOrder, [key]: "ASC" };
            }
        }
    }

    /**
     * Specifies the query filter used in an MRS query.
     * @param filter An object containing checks that should apply for the value of one or
     * more fields which can, optionally, be part of high-order AND/OR operations.
     * @see {PureFilter}
     * @see {HighOrderFilter}
     * @returns The MRS request representation as defined by the child class.
     */
    public where = (filter?: DataFilter<Filterable>): this => {
        if (filter === undefined) {
            return this;
        }

        Object.entries(filter).forEach(([field, value]) => {
            if (Object.keys(this.cursorFields).indexOf(field) === -1) {
                this.queryFilter = { ...this.queryFilter, [field]: value };
            }
        });

        return this;
    };

    /**
     * Sort the result set according to the values of a given set of fields.
     * @param columnOrder An object where the keys are the field names and the values can be
     * either "ASC" or "DESC" depending on the order in which the records should be returned.
     * that any sorting condition for the same fields is overwritten.
     * @see {ColumnOrder}
     * @example
     * .orderBy({ name: "ASC" })
     * .orderBy({ name: "ASC", age: "DESC" })
     * @returns The MRS request representation as defined by the child class.
     */
    public orderBy = (columnOrder?: ColumnOrder<Filterable>): this => {
        for (const key in columnOrder) {
            if (Object.keys(this.cursorFields).indexOf(key) === -1) {
                this.sortOrder[key] = columnOrder[key];
            }
        }

        return this;
    };

    /**
     * Check if the request instance contains one or more cursors.
     * @returns A boolean that indicates whether the request contains one or more cursors.
     */
    protected hasPaginationCursor = (): boolean => {
        // It might be the case that the cursor object actually contains fields which are undefined. Those fields
        // should not be accounted as part of the cursor.
        return Object.values(this.cursorFields)
            .some((value) => {
                return typeof value !== "undefined";
            });
    };

    protected hasQueryFilter = (): boolean => {
        return Object.values(this.queryFilter)
            .some((value) => {
                return typeof value !== "undefined";
            });
    };

    protected hasSortOrder = (): boolean => {
        return Object.values(this.sortOrder)
            .some((value) => {
                return typeof value !== "undefined";
            });
    };

    protected increaseCursor = (field: string, value: unknown): this => {
        if (!this.queryFilter.$or) {
            this.queryFilter = { ...this.queryFilter, [field]: { $gt: value } };

            return this;
        }

        this.queryFilter = { $and: [ this.queryFilter, { [field]: { $gt: value } } ] };

        return this;
    };

    protected isCursor = (field: string): boolean => {
        return Object.keys(this.cursorFields).indexOf(field) > -1;
    };
}

/**
 * @template T The set of fields of a given database object that should be part of the result set.
 */
class MrsSimplifiedObjectResponse<T> {
    #json: MrsResourceObject<T>;
    #hypermediaProperties = ["_metadata", "links"];

    public constructor (json: MrsResourceObject<T>) {
        this.#json = json;
    }

    /**
     * Retrieve an application resource instance that hides hypermedia-related properties and prevents the application
     * from changing or deleting them.
     * @see {MrsResourceObject}
     * @returns An abstraction of the database object item without hypermedia-related properties.
     */
    public getInstance () {
        return new Proxy(this.#json, {
            deleteProperty: (target, p) => {
                const property = String(p);

                if (this.#hypermediaProperties.indexOf(property) > -1) {
                    throw new Error(`The "${property}" property cannot be deleted.`);
                }

                delete target[property];

                return true;
            },

            get: (target: MrsResourceObject<T> & { [key: symbol]: unknown }, key) => {
                if (key !== "toJSON") {
                    return target[key];
                }

                // .toJSON()
                return () => {
                    // We want to change a copy of the underlying json object, not the reference to the original one.
                    const partial = { ...this.#json as Omit<MrsResourceObject<T>, "links" | "_metadata"> };
                    delete partial.links;
                    // eslint-disable-next-line no-underscore-dangle
                    delete partial._metadata;

                    return partial;
                };
            },

            has: (target, p) => {
                const property = String(p);

                if (this.#hypermediaProperties.indexOf(property) > -1) {
                    return false;
                }

                return p in target;
            },

            ownKeys: (target) => {
                return Object.keys(target).filter((key) => {
                    return this.#hypermediaProperties.indexOf(key) === -1;
                });
            },

            set: (target, p, newValue) => {
                const property = String(p);

                if (this.#hypermediaProperties.indexOf(property) > -1) {
                    throw new Error(`The "${property}" property cannot be changed.`);
                }

                // Ultimately, json is always a JSON object and any other field can be re-assigned to a different value.
                (target as JsonObject)[property] = newValue;

                return true;
            },
        });
    }
}

/**
 * @template T The set of fields of a given database object that should be part of the result set.
 */
class MrsSimplifiedCollectionObjectResponse<T> {
    #json: IMrsResourceCollectionData<T>;

    public constructor (json: IMrsResourceCollectionData<T>) {
        this.#json = json;
    }

    /**
     * Retrieve an application resource instance that hides hypermedia-related properties and prevents the application
     * from changing or deleting them.
     *Data{IMrsResourceCollectionObject}
     * @returns A list of the database object items without hypermedia-related properties.
     */
    public getInstance () {
        return new Proxy(this.#json, {
            deleteProperty: (_, p) => {
                throw new Error(`The "${String(p)}" property cannot be deleted.`);
            },

            get: (target: IMrsResourceCollectionData<T> & { [key: symbol]: unknown }, key,
                receiver: IMrsResourceCollectionData<T>) => {
                if (key !== "toJSON" && key !== "items") {
                    return target[key];
                }

                // .toJSON()
                if (key === "toJSON") {
                    return () => {
                        // Each item is already a Proxy that provides a custom toJSON() handler.
                        // This falls into the scope of the alternative condition below.
                        return receiver.items;
                    };
                }

                // .items
                return target.items.map((item) => {
                    const resource = new MrsSimplifiedObjectResponse(item);

                    return resource.getInstance();
                });
            },

            has: () => {
                return false;
            },

            ownKeys: () => {
                return [];
            },

            set: (_, p) => {
                throw new Error(`The "${String(p)}" property cannot be changed.`);
            },
        });
    }
}

/**
 * @template Item The entire set of fields of a given database object.
 * @template Filterable The set of fields of a given database object that can be used in a query filter.
 * @template Iterable An optional set of fields of a given database object that can be used as cursors. It is optional
 * because it is not used by "findAll()" or "findFirst()", both of which, also create an instance of MrsBaseObjectQuery.
 * Creates an object that represents an MRS GET request.
 */
export class MrsBaseObjectQuery<Item, Filterable, Iterable={}> extends MrsRequestFilter<Filterable, Iterable> {
    protected offsetCondition?: number;
    protected limitCondition?: number;
    protected pageSizeCondition = 25;

    public constructor(
        private readonly schema: MrsBaseSchema,
        private readonly requestPath: string,
        private readonly fieldsToGet?: string[] | BooleanFieldMapSelect<Item> | FieldNameSelect<Item>,
        private readonly fieldsToOmit?: string[],
        protected readonly cursor?: Cursor<Iterable>,
        private readonly simplified: boolean = true) {
        super(cursor);
    }

    /**
     * Although the query filter can already be specified by now, one can incrementally introduce other optional rules
     * that are embedded in a top-level OR operation.
     * @param filter An object containing checks that should apply for the value of one or
     * more fields.
     * @see {PureFilter}
     * @example
     * .or({ name: "foo", age: 42 })
     * .or({ name: { $eq: "foo" }, age: 42 })
     * .or({ name: "foo", age: { $gte: 42 } })
     * .or({ name: { $like: "%foo%" }, age: { $lte: 42 } })
     * @returns The MRS GET request representation.
     */
    public or = (filter?: PureFilter<Filterable>): this => {
        if (filter === undefined) {
            return this;
        }

        // Discard all cursors from the additional filter.
        for (const field in filter) {
            if (Object.keys(this.cursorFields).indexOf(field) > -1) {
                delete filter[field];
            }
        }

        const additionalFilterFields = Object.keys(filter);

        // After discarding the cursors, if the additional filter is empty, there is nothing to do.
        if (additionalFilterFields.length === 0) {
            return this;
        }

        // If the existing filter contains an explicit high-level OR, the fields should go there.
        if (this.queryFilter.$or !== undefined) {
            this.queryFilter.$or.push(filter);

            return this;
        }

        const existingFilterFields = Object.keys(this.queryFilter);

        // If the the existing filter contains only one field and that field is a cursor it still must be required, so
        // it must be within the scope of an AND operator.
        if (existingFilterFields.length === 1 && this.isCursor(existingFilterFields[0])) {
            // If the additional filter only contains one field, it becomes part of the AND operator.
            if (additionalFilterFields.length === 1) {
                this.queryFilter = { $and: [this.queryFilter, filter] };

                return this;
            }

            // Otherwise, the multiple fields still form an additional OR operator.
            this.queryFilter = { $and: [this.queryFilter, { $or: [filter] }] };

            return this;
        }

        // If the existing filter contains only one field and that field is not a cursor, it can safely be aggregated
        // into a new OR operator.
        if (existingFilterFields.length === 1) {
            this.queryFilter = { $or: [this.queryFilter, filter] };

            return this;
        }

        // If the filter contains more than one field, it means it is an implicit AND which must converted to an
        // explicit AND in order to be shoehorned into a new high-level OR.
        const explicitAnd = Object.entries(this.queryFilter).map(([field, value]) => {
            return { [field]: value };
        });

        this.queryFilter = { $or: [{ $and: explicitAnd }, filter] };

        return this;
    };

    public offset = (offset?: number): this => {
        if (typeof offset === "undefined") {
            return this;
        }

        this.offsetCondition = offset;

        return this;
    };

    public limit = (limit?: number): this => {
        if (typeof limit === "undefined") {
            return this;
        }

        this.limitCondition = limit;

        return this;
    };

    public pageSize = (pageSize: number): this => {
        this.pageSizeCondition = pageSize;

        return this;
    };

    public fetch = async (): Promise<IMrsResourceCollectionData<Item>> => {
        let inputStr = `${this.schema.requestPath}${this.requestPath}?`;

        const fields = this.fieldsToGet ?? {};
        const fieldsToGet = Array.isArray(fields) ? fields : this.fieldsToInclude(fields);
        const fieldsToOmit = Array.isArray(fields) ? this.fieldsToOmit : this.fieldsToExclude(fields);

        if (fieldsToOmit !== undefined && fieldsToOmit.length > 0) {
            inputStr += `f=!${fieldsToOmit.join(",!")}&`;
        } else if (fieldsToGet !== undefined && fieldsToGet.length > 0) {
            inputStr += `f=${fieldsToGet.join(",")}&`;
        }
        if (this.hasQueryFilter() && !this.hasSortOrder()) {
            inputStr += `q=${MrsJSON.stringify(this.queryFilter)}&`;
        } else if (!this.hasQueryFilter() && this.hasSortOrder()) {
            inputStr += `q=${MrsJSON.stringify({ $orderby: this.sortOrder })}&`;
        } if (this.hasQueryFilter() && this.hasSortOrder()) {
            inputStr += `q=${MrsJSON.stringify({ ...this.queryFilter, $orderby: this.sortOrder })}&`;
        }
        if (!this.hasPaginationCursor() && this.offsetCondition !== undefined) {
            inputStr += `offset=${this.offsetCondition}&`;
        }
        if (this.limitCondition !== undefined) {
            inputStr += `limit=${this.limitCondition}&`;
        }

        const res = await this.schema.service.session.doFetch({
            /*input: `/mrsNotes/notesAll?f=!content&offset=${offset}&limit=10${q}`,*/
            input: inputStr.slice(0, -1),
            errorMsg: "Failed to fetch items.",
        });

        const responseBody: IMrsResourceCollectionData<Item> = await res.json();

        if (this.simplified === false) {
            return responseBody;
        }

        const collection = new MrsSimplifiedCollectionObjectResponse(responseBody);

        return collection.getInstance();
    };

    /**
     * Fetches all items that match an optional where condition.
     *
     * Items are fetched in pages with the size of pageSize or with the size parameter specified with a call to the
     * this.pageSize() function. An optional progress callback can be specified that is called with the data of each
     * page.
     *
     * @param progress An optional callback function that is called for each page that is fetched.
     * @returns A list of typed IMrsResourceDatas
     */
    public fetchAll = async (progress?: (items: Item[]) => Promise<void>):
    Promise<IMrsResourceCollectionData<Item>> => {
        const resultList: IMrsResourceCollectionData<Item> = {
            items: [],
            limit: this.pageSizeCondition,
            offset: 0,
            hasMore: true,
            count: 0,
        };

        // Initialize offsetCondition and limitCondition
        this.offsetCondition = 0;
        this.limitCondition = this.pageSizeCondition;

        // Fetch pages of the size of this.pageSizeCondition until all items have been fetched
        while (resultList.hasMore) {
            const res = await this.fetch();

            // Add items to the newNotes list
            resultList.items.push(...res.items);

            // Update count and limit
            resultList.count += res.items.length;
            resultList.limit += this.pageSizeCondition;

            // Check if there is more to fetch
            resultList.hasMore = res.hasMore;

            if (progress !== undefined) {
                await progress(res.items);
            }

            this.offsetCondition += this.pageSizeCondition;

            // increase any existing cursor
            for (const field in this.cursorFields) {
                this.increaseCursor(field, res.items[res.items.length - 1][field]);
            }
        }

        return resultList;
    };

    public fetchOne = async (): Promise<MrsResourceObject<Item> | undefined> => {
        this.limitCondition = 1;

        const resultList = await this.fetch();

        if (resultList.items.length >= 1) {
            return resultList.items[0];
        } else {
            return undefined;
        }
    };

    /**
     * Retrieve a list of the names of columns that should be included in the result set.
     *
     * @param fields An object where the keys correspond to the column names (nested or not)
     * and the values are "true" if the column should be included or "false" if not.
     * @returns A list of column names.
     */
    private readonly fieldsToInclude = (fields: BooleanFieldMapSelect<Item>): string[] => {
        return this.fieldsWithValue(fields, true);
    };

    /**
     * Retrieve a list of the names of columns that should be excluded from the result set.
     *
     * @param fields An object where the keys correspond to the column names (nested or not)
     * and the values are "true" if the column should be included or "false" if not.
     * @returns A list of column names.
     */
    private readonly fieldsToExclude = (fields: BooleanFieldMapSelect<Item>): string[] => {
        return this.fieldsWithValue(fields, false);
    };

    /**
     * Retrieve a list of the names of columns that are assigned a given value.
     *
     * @param fields An object where the keys correspond to the column names (nested or not)
     * and the values are "true" if the column should be included or "false" if not.
     * @param value The value to check.
     * @param [prefix] A prefix to carry when the function is called recursively on nested fields.
     * @returns A list of column names.
     */
    private readonly fieldsWithValue = (
        fields: BooleanFieldMapSelect<Item>, value: unknown, prefix = ""): string[] => {
        const result: string[] = [];

        for (const field in fields) {
            const fieldValue = fields[field];

            if (typeof fieldValue === "object" && prefix.length > 0) {
                result.push(...this.fieldsWithValue(fieldValue, value, `${prefix}.${field}`));
            } else if (typeof fieldValue === "object") {
                result.push(...this.fieldsWithValue(fieldValue, value, field));
            } else if (fieldValue === value && prefix.length > 0) {
                result.push(`${prefix}.${field}`);
            } else if (fieldValue === value) {
                result.push(field);
            }
        }

        return result;
    };
}

export class MrsBaseObjectCreate<T extends object> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected item: T,
        protected simplified: boolean = true) {
    }

    public fetch = async (): Promise<MrsResourceObject<T>> => {
        const input = `${this.schema.requestPath}${this.requestPath}`;
        const body = this.item;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "POST",
            body,
            errorMsg: "Failed to create item.",
        });

        const responseBody = await res.json() as MrsResourceObject<T>;

        if (this.simplified === false) {
            return responseBody;
        }

        const resource = new MrsSimplifiedObjectResponse(responseBody);

        return resource.getInstance();
    };
}

export class MrsBaseObjectDelete<T> extends MrsRequestFilter<T> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string) {
        super();
    }

    public fetch = async (): Promise<IMrsDeleteResult> => {
        let inputStr = `${this.schema.requestPath}${this.requestPath}`;

        if (this.queryFilter !== undefined) {
            inputStr += `?q=${MrsJSON.stringify(this.queryFilter as JsonObject)}&`;
        }

        const res = await this.schema.service.session.doFetch({
            input: inputStr.slice(0, -1),
            method: "DELETE",
            errorMsg: "Failed to delete items.",
        });

        const responseBody = await res.json();

        return responseBody as IMrsDeleteResult;
    };
}

export class MrsBaseObjectUpdate<T extends object | undefined> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected fieldsToSet: T,
        protected keys: string[],
        protected simplified: boolean = true) {
    }

    public whereKey = (key: string | number): this => {
        this.keys = [String(key)];

        return this;
    };

    public whereKeys = (keys: string[] | number[]): this => {
        this.keys = keys.map((k) => {
            return String(k);
        });

        return this;
    };

    public fetch = async (): Promise<MrsResourceObject<T>> => {
        const input = `${this.schema.requestPath}${this.requestPath}/${this.keys.join(",")}`;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "PUT",
            body: this.fieldsToSet,
            errorMsg: "Failed to update item.",
        });

        // The REST service returns a single resource, which is an ORDS-compatible object representation decorated with
        // additional fields such as "links" and "_metadata".
        const responseBody = await res.json() as MrsResourceObject<T>;

        if (this.simplified === false) {
            return responseBody;
        }

        const resource = new MrsSimplifiedObjectResponse(responseBody);

        return resource.getInstance();
    };
}

class MrsBaseObjectCall<I, P extends IMrsFetchData> {
    protected constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected params: P) {
    }

    protected async fetch(): Promise<I> {
        const input = `${this.schema.requestPath}${this.requestPath}`;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "PUT",
            body: this.params,
            errorMsg: "Failed to call item.",
        });

        return await res.json() as I;
    }
}

export class MrsBaseObjectProcedureCall<I, P extends IMrsFetchData>
    extends MrsBaseObjectCall<IMrsProcedureResultList<I>, P> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected params: P) {
        super(schema, requestPath, params);
    }

    public async fetch(): Promise<IMrsProcedureResultList<I>> {
        const res = await super.fetch();

        return res;
    }
}

export class MrsBaseObjectFunctionCall<I, P extends IMrsFetchData> extends MrsBaseObjectCall<I, P> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected params: P) {
        super(schema, requestPath, params);
    }

    public async fetch(): Promise<I> {
        const res = await super.fetch() as IMrsFunctionResult<I>;

        return res.result;
    }
}