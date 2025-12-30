# pygls.io_

**Module:** `pygls.io_`

No module documentation available.

## Classes

### StdinAsyncReader

Read from stdin asynchronously.

**Methods:**

- `__init__(self, stdin: 'BinaryIO', executor: 'ThreadPoolExecutor | None' = None)`: Initialize self.  See help(type(self)) for accurate signature.
- `readexactly(self, n: 'int') -> 'Awaitable[bytes]'`
- `readline(self) -> 'Awaitable[bytes]'`

### StdoutWriter

Align a stdout stream with pygls' writer interface.

**Methods:**

- `__init__(self, stdout: 'BinaryIO')`: Initialize self.  See help(type(self)) for accurate signature.
- `close(self)`
- `write(self, data: 'bytes') -> 'None'`

### WebSocketWriter

Align a websocket connection with pygls' writer interface

**Methods:**

- `__init__(self, ws: 'ServerConnection | ClientConnection')`: Initialize self.  See help(type(self)) for accurate signature.
- `close(self) -> 'Awaitable[None]'`
- `write(self, data: 'bytes') -> 'Awaitable[None]'`

## Functions

### run(stop_event: 'threading.Event', reader: 'Reader', protocol: 'JsonRPCProtocol', logger: 'logging.Logger | None' = None, error_handler: 'Callable[[Exception, type[JsonRpcException]], Any] | None' = None)

Run a main message processing loop, synchronously

Parameters
----------
stop_event
   A ``threading.Event`` used to break the main loop

reader
   The reader to read messages from

protocol
   The protocol instance that should handle the messages

logger
   The logger instance to use

error_handler
   Function to call when an error is encountered.

### run_async(stop_event: 'threading.Event', reader: 'AsyncReader', protocol: 'JsonRPCProtocol', logger: 'logging.Logger | None' = None, error_handler: 'Callable[[Exception, type[JsonRpcException]], Any] | None' = None)

Run a main message processing loop, asynchronously

Parameters
----------
stop_event
   A ``threading.Event`` used to break the main loop

reader
   The reader to read messages from

protocol
   The protocol instance that should handle the messages

logger
   The logger instance to use

### run_websocket(websocket: 'ClientConnection | ServerConnection', stop_event: 'threading.Event', protocol: 'JsonRPCProtocol', logger: 'logging.Logger | None' = None, error_handler: 'Callable[[Exception, type[JsonRpcException]], Any] | None' = None)

Run the main message processing loop, over websockets.

Parameters
----------
stop_event
   A ``threading.Event`` used to break the main loop

websocket
   The websocket to read messages from

protocol
   The protocol instance that should handle the messages

logger
   The logger instance to use

error_handler
   Function to call when an error is encountered.

