# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

"""Sub-Module for shortcut functions"""

# cSpell:ignore mrs, mysqlsh

from mysqlsh.plugin_manager import plugin_function
import mrs_plugin.lib as lib


@plugin_function('mrs.info', shell=True, cli=True, web=True)
def info():
    """Returns basic information about this plugin.

    Returns:
        str
    """
    return (f"MySQL REST Data Service (MRS) Plugin Version {lib.general.VERSION} PREVIEW\n"
            "Warning! For testing purposes only!")


@plugin_function('mrs.version', shell=True, cli=True, web=True)
def version():
    """Returns the version number of the plugin

    Returns:
        str
    """
    return lib.general.VERSION


@plugin_function('mrs.ls', shell=True, cli=True, web=True)
def ls(path=None, session=None):
    """Lists the schemas that are currently offered via MRS

    Args:
        path (str): The path to use.
        session (object): The database session to use.

    Returns:
        None
    """

    with lib.core.MrsDbSession(session=session) as session:

        service = None
        schema = None
        content_set = None

        # If a path was given, try to get the corresponding objects
        if path is not None:
            service, schema, content_set = lib.core.validate_service_path(
                path=path, session=session)
        # If no path was given, check if current objects are set
        else:
            service = lib.services.get_current_service(session=session)
            schema = lib.schemas.get_current_schema(session=session)
            content_set = lib.content_sets.get_current_content_set(
                session=session)

        # If there is not current_service set, list all services
        if not service:
            print("List of MRS Services\n")
            services = lib.services.get_services(session)
            if services and len(services) > 0:
                print(lib.services.format_service_listing(services=services,
                                                          print_header=True))
            else:
                print("No services available.\n\nUse mrs.add.service() "
                      "to add a service.")
            return

        # List service content
        if service and not schema and not content_set:
            print(f"MRS Service {service.get('host_ctx')}\n")
            schemas = lib.schemas.get_schemas(
                service_id=service.get('id'), session=session)
            content_sets = lib.content_sets.get_content_sets(
                service_id=service.get('id'), session=session)

            auth_apps = lib.auth_apps.get_auth_apps(
                service_id=service.get('id'), session=session)

            if not schemas and not content_sets:
                print("No schemas added to this service yet.\n\n"
                      "Use mrs.add.schema() to add a schema to the service.")
            if schemas:
                print("List of Schemas")
                print(lib.schemas.format_schema_listing(
                    schemas=schemas, print_header=True) + "\n")
            if content_sets:
                print("List of Content Sets")
                print(lib.content_sets.format_content_set_listing(
                    content_sets=content_sets, print_header=True) + "\n")
            if auth_apps:
                print("List of Authentication Apps")
                print(lib.auth_apps.format_auth_app_listing(
                    auth_apps=auth_apps, print_header=True) + "\n")

        # List schema objects
        if service and schema:
            print(f"MRS Service {service.get('host_ctx')}"
                  f"{schema.get('request_path')} - Database Objects\n")
            db_objects = lib.db_objects.get_db_objects(
                session=session, schema_id=schema.get('id'))
            if len(db_objects) > 0:
                print(lib.db_objects.format_db_object_listing(
                    db_objects=db_objects, print_header=True))
            else:
                print("No database objects added to this schema yet.\n\n"
                      "Use mrs.add.db_object() to add an object to the "
                      "schema.")

        # List content_set files
        if service and content_set:
            print(f"MRS Service {service.get('host_ctx')}"
                  f"{content_set.get('request_path')} - Content Files\n")
            content_files = lib.content_files.get_content_files(
                content_set_id=content_set.get('id'), session=session)
            if len(content_files) > 0:
                print(lib.content_files.format_content_file_listing(
                    content_files=content_files, print_header=True))
            else:
                print("No content files added to this content set yet.\n\n"
                      "Use mrs.add.content_file() to add a file to the "
                      "content set.")


@plugin_function('mrs.cd')
def cd(path=None, session=None):
    """Change the current service and/or schema

    Args:
        path (str): The name of the service and/or schema to make current
        session (object): The database session to use

    Returns:
        none

    """

    with lib.core.MrsDbSession(session=session) as session:

        # If a path was given, try to get the corresponding objects
        if path:
            service, schema, content_set = lib.core.validate_service_path(
                path=path, session=session)

            current_path = ""
            if service:
                current_path += service.get("host_ctx")
            if schema:
                current_path += schema.get("request_path")
            if content_set:
                current_path += content_set.get("request_path")

            lib.core.set_current_objects(service=service, schema=schema,
                                         content_set=content_set)

            print(f"Current path set to {current_path}")
            return
        # If an empty path was given, set the current path to root
        elif path == "":
            lib.core.set_current_objects(
                service=None, schema=None, db_object=None)
            print(f"Current path set to root.")
        # If no path was given, let the user choose
        else:
            current_service = lib.services.get_current_service(session=session)

            # If the current service has not been set, let the user select it
            if not current_service:
                # Check if there already is at least one service
                row = lib.core.select(
                    table="service", cols="COUNT(*) as service_count").exec(session).first
                service_count = row["service_count"] if row else 0

                # If there is exactly one service, set id to its id
                if service_count == 0:
                    raise ValueError("No MRS service available.")

                # If there are more services, let the user select one or all
                print("MRS - Service Listing\n")
                services = lib.services.get_services(session)
                item = lib.core.prompt_for_list_item(
                    item_list=services,
                    prompt_caption=("Please select a service index or type "
                                    "'hostname/root_context'"),
                    item_name_property="host_ctx",
                    given_value=None,
                    print_list=True)
                if not item:
                    raise ValueError("Operation cancelled.")
                else:
                    lib.core.set_current_objects(service=item)
                    print(f"Current path set to {item.get('host_ctx')}")
                    return

            current_schema = lib.schemas.get_current_schema(session=session)
            current_content_set = lib.content_sets.get_current_content_set(
                session=session)

            if not current_schema and not current_content_set:
                print(f"MRS Service {current_service.get('host_ctx')} - "
                      "Schema and Content Set Listing:\n")
                # Get the schema
                schemas = lib.schemas.get_schemas(
                    service_id=current_service.get("id"),
                    session=session)
                context_sets = lib.content_sets.get_content_sets(
                    service_id=current_service.get("id"),
                    session=session)

                items = schemas + context_sets

                if items:
                    selection = lib.core.prompt_for_list_item(
                        item_list=items, prompt_caption=("Please select a schema "
                                                         "or content set: "),
                        item_name_property='request_path', print_list=True)

                    # If there is a key called name, it is a schema
                    if 'name' in selection:
                        lib.core.set_current_objects(service=current_service,
                                                     schema=selection)
                    else:
                        lib.core.set_current_objects(service=current_service,
                                                     content_set=selection)

                    if selection:
                        print(f"Current path set to {selection.get('host_ctx')}"
                              f"{selection.get('request_path')}")


@plugin_function('mrs.configure', shell=True, cli=True, web=True)
def configure(session=None, enable_mrs=None, allow_recreation_on_major_upgrade=False):
    """Initializes and configures the MySQL REST Data Service

    Args:
        session (object): The database session to use
        enable_mrs (bool): Whether MRS should be enabled or disabled
        allow_recreation_on_major_upgrade (bool): Whether the MRS metadata schema can be dropped and recreated if needed

    Returns:
        True on success, None in interactive mode
    """
    interactive = lib.core.get_interactive_default()

    if interactive:
        print("MySQL Rest Data Service configuration.\n\n"
              "Checking MRS metadata schema and version...")

    with lib.core.MrsDbSession(session=session, check_version=False) as session:
        schema_changed = False
        if lib.core.mrs_metadata_schema_exists(session):
            # Make sure the MRS metadata schema exists and has the right version
            schema_changed = lib.core.get_metadata_schema_updated()

            current_db_version = lib.core.get_mrs_schema_version(session)

            if lib.general.DB_VERSION < current_db_version:
                raise Exception(
                    "Unsupported MRS metadata database schema "
                    f"version {lib.general.DB_VERSION_STR}. "
                    "Please update your MRS Shell Plugin.")
            
            # Major upgrade available
            if current_db_version[0] < lib.general.DB_VERSION[0]:
                if allow_recreation_on_major_upgrade:
                    lib.core.create_rds_metadata_schema(session, drop_existing=True)
                    schema_changed = True
                    if interactive:
                        print("The MRS metadata has been recreated.")
                else:
                    raise Exception("This MRS Shell Plugin version requires a new major version of the MRS metadata "
                                    "schema. To drop and recreate the MRS metadata schema please set the "
                                    "allow_recreation parameter to True")

            elif current_db_version < lib.general.DB_VERSION:
                # this is a major version upgrade, so there must be user intervention
                # to proceed with the upgrade
                if interactive:
                    if lib.core.prompt("An upgrade is available for the MRS schema. Upgrade? [y/N]: ",
                                       {'defaultValue': 'n'}).strip().lower() == 'n':
                        raise Exception(
                            "The MRS schema is outdated. Please run `mrs.configure()` to upgrade.")

                # if the major upgrade was accepted or it's a minor upgrade,
                # proceed to execute it
                current_db_version = [str(ver) for ver in current_db_version]

                lib.core.update_rds_metadata_schema(
                    session, ".".join(current_db_version))

                if interactive:
                    print("The MRS metadata has been configured.")
            else:
                if interactive:
                    print("The MRS metadata is well configured, no changes "
                          "performed.")
        else:
            lib.core.create_rds_metadata_schema(session)
            schema_changed = True
            if interactive:
                print("The MRS metadata has been created.")

        if enable_mrs is not None:
            lib.core.update(table="config", sets="service_enabled=?", where="id=1"
                            ).exec(session, [1 if enable_mrs else 0])

            if interactive:
                if enable_mrs:
                    print(f"The MySQL REST Data Service has been enabled.")
                else:
                    print(f"The MySQL REST Data Service has been disabled.")
        else:
            row = lib.core.select(table="config", cols="service_enabled", where="id=1"
                                  ).exec(session).first
            enable_mrs = row["service_enabled"] if row else 0

        if not interactive:
            return {
                "schema_changed": schema_changed,
                "mrs_enabled": enable_mrs
            }


@plugin_function('mrs.status', shell=True, cli=True, web=True)
def status(session=None):
    """Checks the MRS service status and prints its

    Args:
        session (object): The database session to use

    Returns:
        None
    """

    with lib.core.MrsDbSession(
            exception_handler=lib.core.print_exception, session=session, check_version=False) as session:
        if lib.core.get_interactive_default():
            print("Checking the current status of the MRS...\n")

        status = lib.general.get_status(session)

        if lib.core.get_interactive_result():
            if status.get("service_configured", False) == False:
                print("The MySQL REST Data Service is not configured yet. "
                      "Run mrs.configure() to configure the service.")
            elif status['service_enabled']:
                print(f"The MySQL REST Data Service is enabled.")
                print("Number of enabled MRS services: "
                      f"{status['service_count']}")
                if int(status['service_count']) == 0:
                    print("\nUse mrs.add.service() to add a new service.")
            else:
                print(f"The MySQL REST Data Service is disabled.")
        else:
            return status
