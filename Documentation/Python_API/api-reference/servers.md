# pygls.server

**Module:** `pygls.server`

No module documentation available.

## Classes

### JsonRPCServer

Base server class

Parameters
----------
protocol_cls
   Protocol implementation that should derive from
   :class:`~pygls.protocol.JsonRPCProtocol`

converter_factory
   Factory function to use when constructing a cattrs converter.

max_workers
   Maximum number of workers for `ThreadPoolExecutor`

**Methods:**

- `__init__(self, protocol_cls: 'Type[JsonRPCProtocol]', converter_factory: 'Callable[[], cattrs.Converter]', max_workers: 'int | None' = None)`: Initialize self.  See help(type(self)) for accurate signature.
- `command(self, command_name: 'str') -> 'Callable[[F], F]'`: Decorator used to register custom commands.
- `feature(self, feature_name: 'str', options: 'Any | None' = None) -> 'Callable[[F], F]'`: Decorator used to register LSP features.
- `report_server_error(self, error: 'Exception', source: 'ServerErrors')`: Default error reporter.
- `shutdown(self)`: Shutdown server.
- `start_io(self, stdin: 'Optional[BinaryIO]' = None, stdout: 'Optional[BinaryIO]' = None)`: Starts an IO server.
- `start_tcp(self, host: 'str', port: 'int') -> 'None'`: Starts TCP server.
- `start_ws(self, host: 'str', port: 'int') -> 'None'`: Starts WebSocket server.
- `thread(self) -> 'Callable[[F], F]'`: Decorator that mark function to execute it in a thread.

