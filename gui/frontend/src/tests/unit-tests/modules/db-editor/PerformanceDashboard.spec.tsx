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

import { mount } from "enzyme";
import React from "react";

import { ISavedGraphData } from "../../../../modules/db-editor";
import { PerformanceDashboard } from "../../../../modules/db-editor/PerformanceDashboard";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface";

describe("PerformanceDashboard Tests", (): void => {

    it("Test PerformanceDashboard instantiation", () => {
        const backend = new ShellInterfaceSqlEditor();
        const graphData: ISavedGraphData = {
            timestamp: new Date().getTime(),
            activeColorScheme: "grays",
            displayInterval: 300,
            currentValues: new Map(),
            computedValues: {},
            series: new Map(),
        };

        const component = mount<PerformanceDashboard>(
            <PerformanceDashboard
                backend={backend}
                graphData={graphData}
            />,
        );

        // Note: we cannot do snapshot testing here, because graph data contains always changing timestamps.

        const props = component.props();
        expect(props.graphData.displayInterval).toBe(300);
        expect(props.graphData.series.size).toBe(6);
        expect(Object.values(props.graphData.computedValues).length).toBeGreaterThan(35);

        component.unmount();
    });

});
