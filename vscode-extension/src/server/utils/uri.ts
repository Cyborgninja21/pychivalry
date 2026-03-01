/**
 * URI utility functions for converting between file paths and file:// URIs.
 *
 * Replaces the various ad-hoc URI conversions that were duplicated across
 * server.ts, workspace.ts, and workspace-enhanced.ts. Those implementations
 * had bugs: manual encodeURIComponent mangled Windows drive letter colons
 * (C: -> C%3A), and decoding only handled %20 while ignoring all other
 * percent-encoded characters.
 *
 * These functions follow the file URI spec (RFC 8089):
 *   Windows: file:///C:/Users/foo   (three slashes, then drive letter)
 *   Unix:    file:///home/foo       (three slashes, then absolute path)
 */

/**
 * Convert a file system path to a file:// URI.
 *
 * Encodes each path segment with encodeURIComponent while preserving
 * slash separators and the Windows drive letter colon (e.g. "C:").
 *
 * @example
 *   pathToFileUri('C:\\Users\\my project\\file.txt')
 *   // => 'file:///C:/Users/my%20project/file.txt'
 *
 *   pathToFileUri('/home/user/file.txt')
 *   // => 'file:///home/user/file.txt'
 */
export function pathToFileUri(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');

    // Encode each segment individually so '/' separators stay literal
    const encoded = normalized
        .split('/')
        .map((segment, i) => {
            // Preserve the drive letter colon (e.g. "C:") — encoding it
            // would produce "C%3A" which breaks URI resolution
            if (i === 0 && /^[a-zA-Z]:$/.test(segment)) {
                return segment;
            }
            return encodeURIComponent(segment);
        })
        .join('/');

    // Windows: C:/... -> file:///C:/...
    if (/^[a-zA-Z]:/.test(encoded)) {
        return `file:///${encoded}`;
    }
    // Unix: /... -> file:///...  (file:// + absolute path starting with /)
    if (encoded.startsWith('/')) {
        return `file://${encoded}`;
    }
    // Fallback for relative paths (shouldn't happen in normal usage)
    return `file:///${encoded}`;
}

/**
 * Convert a file:// URI back to a native file system path.
 *
 * Uses decodeURIComponent to handle all percent-encoded characters
 * (spaces, unicode, brackets, etc.), not just %20.
 *
 * @example
 *   fileUriToPath('file:///C:/Users/my%20project/file.txt')
 *   // => 'C:/Users/my project/file.txt'
 *
 *   fileUriToPath('file:///home/user/file.txt')
 *   // => '/home/user/file.txt'
 */
export function fileUriToPath(uri: string): string {
    if (uri.startsWith('file:///')) {
        // Skip 'file:///' (8 chars) to get the path portion
        const decoded = decodeURIComponent(uri.substring(8));
        // Windows: decoded starts with drive letter (e.g. "C:/...")
        if (/^[a-zA-Z]:/.test(decoded)) {
            return decoded;
        }
        // Unix: re-add the leading slash that was part of the URI
        return '/' + decoded;
    }
    // file:// without third slash (UNC paths, etc.)
    if (uri.startsWith('file://')) {
        return decodeURIComponent(uri.substring(7));
    }
    // Not a file URI — return as-is
    return uri;
}
