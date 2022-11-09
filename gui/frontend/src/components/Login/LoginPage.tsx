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

import "./LoginPage.css";
import logo from "../../assets/images/modules/module-shell.svg";
import chevronRight from "../../assets/images/chevron-right.svg";

import * as React from "react";

import {
    Component, Container, Icon, Label, Button, Input, Grid, GridCell, IInputChangeProperties,
    ContentAlignment, ContentWrap, Message, Orientation,
} from "../ui";
import { ShellInterface } from "../../supplement/ShellInterface";
import { MessageType } from "../../app-logic/Types";
import { requisitions } from "../../supplement/Requisitions";

interface ILoginPageState extends React.ComponentState {
    userName: string;
    password: string;
    errorMessage: string;
}

// Implements the main login page for the application.
export class LoginPage extends Component<{}, ILoginPageState> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            userName: "",
            password: "",
            errorMessage: "",
        };
    }

    public render(): React.ReactNode {
        const { userName, password, errorMessage } = this.state;

        const linkMap = new Map<string, string>([
            ["Learn More >", "http://localhost:3001/#"],
            ["Browse Tutorial >", "http://localhost:3001/#"],
            ["Read Docs >", "http://localhost:3001/#"],
        ]);

        const links = [];
        for (const url of linkMap) {
            links.push(
                <a key={url[0]} href={url[1]}>
                    {url[0]}
                </a>,
            );
        }

        return (
            <Container id="loginDialog" orientation={Orientation.TopDown}>
                <Icon src={logo} id="loginDialogSakilaLogo" />
                <Container id="heading" orientation={Orientation.TopDown}>
                    <Label id="headingLabel" as="h2">
                        MySQL Shell
                    </Label>
                    <Label id="headingSubLabel">
                        Welcome to the MySQL Shell GUI.
                        <br />Please provide your MySQL Shell GUI credentials to log into the shell interface.
                    </Label>
                </Container>
                <Container
                    id="loginDialogLinks"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Center}
                    wrap={ContentWrap.Wrap}
                >
                    {links}
                </Container>

                <Grid
                    id="loginDialogControls"
                    columns={[220, 40]}
                    columnGap={8}
                >
                    <GridCell orientation={Orientation.TopDown}>
                        <Input
                            id="loginUsername"
                            placeholder="Username"
                            spellCheck={false}
                            value={userName}
                            onChange={this.handleInput}
                            onConfirm={this.login}
                        />
                    </GridCell>
                    <GridCell />
                    <GridCell orientation={Orientation.TopDown}>
                        <Input
                            password={true}
                            id="loginPassword"
                            placeholder="Password"
                            value={password}
                            onChange={this.handleInput}
                            onConfirm={this.login}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown} mainAlignment={ContentAlignment.Center}>
                        <Button id="loginButton" round onClick={this.login}>
                            <Icon src={chevronRight} />
                        </Button>
                    </GridCell>
                </Grid>

                {errorMessage && (
                    <Message type={MessageType.Error}>{errorMessage}</Message>
                )}

                <Label id="loginDialogSubtext">
                    If you do not have an MySQL Shell GUI account yet, please<br />
                    ask your administrator to have one created for you.
                </Label>
                <div className="copyright" />
            </Container>
        );
    }

    private login = (): void => {
        const { userName, password } = this.state;

        ShellInterface.users.authenticate(userName, password).then((profile) => {
            this.setState({ errorMessage: "" });
            if (profile) {
                void requisitions.execute("userAuthenticated", profile);
            }
        }).catch((reason) => {
            this.setState({ errorMessage: reason });
        });
    };

    private handleInput = (_: React.ChangeEvent, props: IInputChangeProperties): void => {
        if (props.id === "loginUsername") {
            this.setState({ userName: props.value });
        } else {
            this.setState({ password: props.value });
        }
    };
}
