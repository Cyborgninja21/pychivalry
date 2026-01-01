# pygls.uris

**Module:** `pygls.uris`

A collection of URI utilities with logic built on the VSCode URI library.

https://github.com/Microsoft/vscode-uri/blob/e59cab84f5df6265aed18ae5f43552d3eef13bb9/lib/index.ts

## Functions

### from_fs_path(path: 'str')

Returns a URI for the given filesystem path.

### to_fs_path(uri: 'str') -> 'str | None'

Returns the filesystem path of the given URI.

Will handle UNC paths and normalize windows drive letters to lower-case.
Also uses the platform specific path separator. Will *not* validate the
path for invalid characters and semantics.

### uri_scheme(uri: 'str')

### uri_with(uri: 'str', scheme: 'Optional[str]' = None, netloc: 'Optional[str]' = None, path: 'Optional[str]' = None, params: 'Optional[str]' = None, query: 'Optional[str]' = None, fragment: 'Optional[str]' = None)

Return a URI with the given part(s) replaced.
Parts are decoded / encoded.

### urlparse(uri: 'str')

Parse and decode the parts of a URI.

### urlunparse(parts: 'URLParts') -> 'str'

Unparse and encode parts of a URI.

