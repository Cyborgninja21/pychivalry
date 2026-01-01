# pygls.client

**Module:** `pygls.client`

No module documentation available.

## Classes

### JsonRPCClient

Base JSON-RPC client.

**Methods:**

- `__init__(self, protocol_cls: 'Type[JsonRPCProtocol]' = <class 'pygls.protocol.json_rpc.JsonRPCProtocol'>, converter_factory: 'Callable[[], Converter]' = <function default_converter at 0x7f85d6750220>)`: Initialize self.  See help(type(self)) for accurate signature.
- `feature(self, feature_name: 'str', options: 'Optional[Any]' = None)`: Decorator used to register LSP features.
- `report_server_error(self, error: 'Exception', source: 'type[PyglsError] | type[JsonRpcException]')`: Called when the server does something unexpected e.g. respond with malformed
- `server_exit(self, server: 'asyncio.subprocess.Process')`: Called when the server process exits.
- `start_io(self, cmd: 'str', *args, **kwargs)`: Start the given server and communicate with it over stdio.
- `start_tcp(self, host: 'str', port: 'int')`: Start communicating with a server over TCP.
- `start_ws(self, host: 'str', port: 'int')`: Start communicating with a server over WebSockets.
- `stop(self)`

