var lib = ws.tokens.lib
var _this = lib.sql_editor.open_connection_validate_sqlite

await ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": "Connection was successfully opened."
    },
    "result": {
        "module_session_id": ws.lastModuleSessionId,
        "info": {},
        "default_schema": _this.params["default_schema"]
    }
})

_this.result["info"] = ws.lastResponse['result']['info']
_this.result["module_session_id"] = ws.lastResponse['result']['module_session_id']

await ws.validateLastResponse({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "OK",
        "msg": ""
    },
    "done": true
})
