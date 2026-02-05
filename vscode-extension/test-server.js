#!/usr/bin/env node
/**
 * Simple test script to verify the TypeScript server can start
 */

console.log('Testing TypeScript Language Server...');
console.log('Node version:', process.version);
console.log('__dirname:', __dirname);
console.log('');

try {
    // The server should be listening on stdin/stdout
    console.log('Attempting to load server...');
    require('./dist/server-main.js');
    
    // If we get here, the server loaded successfully
    console.log('Server loaded successfully!');
    
    // Send a test initialization message
    setTimeout(() => {
        console.log('\nServer is running and listening for LSP messages.');
        console.log('Press Ctrl+C to exit.');
    }, 100);
    
} catch (error) {
    console.error('Failed to load server:', error);
    process.exit(1);
}
