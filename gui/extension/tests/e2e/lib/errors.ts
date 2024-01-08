/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

export const doesNotExistOnTree = (label: string): string => {
    return `${label} does not exist on the tree`;
};

export const existsOnTree = (label: string): string => {
    return `${label} still exists on the tree`;
};

export const captionError = (expected: string, found: string): string => {
    return `The connection caption should be ${expected}, but found ${found}`;
};

export const queryResultError = (expected: string, found: string): string => {
    return `The query result should match ${expected}, but found ${found}`;
};

export const queryDataSetError = (expected: string): string => {
    return `The ${expected} was not found on the query result data set`;
};

export const tabIsNotOpened = (name: string): string => {
    return `The ${name} tab was not opened`;
};

export const missingTitle = (name: string): string => {
    return `The ${name} title was not found`;
};

export const notDefault = (name: string): string => {
    return `The ${name} was not marked as default on the tree`;
};

export const isDefault = (name: string): string => {
    return `The ${name} is marked as default on the tree`;
};
