# Logging

**Module:** `pygls` logging capabilities

## Overview

pygls uses Python's standard `logging` module for logging. The logging system is configured to provide detailed information about the language server's operation.

## Configuration

By default, pygls logs to stderr with INFO level. You can configure logging in your language server:

```python
import logging

# Set up basic logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Get the pygls logger
logger = logging.getLogger('pygls')
logger.setLevel(logging.DEBUG)
```

## Log Levels

- **DEBUG**: Detailed information for diagnosing problems
- **INFO**: General informational messages
- **WARNING**: Warning messages for potentially harmful situations
- **ERROR**: Error messages for serious problems
- **CRITICAL**: Critical messages for very serious errors

## Common Logger Names

- `pygls.server`: Language server operations
- `pygls.protocol`: Protocol-level operations
- `pygls.io`: Input/output operations
- `pygls.workspace`: Workspace management

## Example

```python
import logging
from pygls.server import LanguageServer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

server = LanguageServer('example-server', 'v0.1')

@server.feature('textDocument/completion')
def completions(params):
    logger.info(f"Completion requested at {params.position}")
    # ... completion logic
```
