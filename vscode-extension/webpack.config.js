const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
    // Extension configuration
    {
        target: 'node',
        mode: 'none',
        entry: './src/extension.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'extension.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode'
        },
        resolve: {
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        },
        ignoreWarnings: [
            {
                module: /vscode-languageserver-types/,
                message: /Critical dependency/,
            },
        ],
    },
    // Server configuration
    {
        target: 'node',
        mode: 'none',
        entry: './src/server/server.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'server-main.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        devtool: 'source-map',
        resolve: {
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'ts-loader'
                        }
                    ]
                }
            ]
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    // Optional game-content data read at runtime (server/data/*): animation
                    // names, concepts, icons, extracted traits and the mod registry. CK3
                    // vocabulary is not here: it is the engine's spec package (below).
                    {
                        from: path.resolve(__dirname, '..', 'data'),
                        to: path.resolve(__dirname, 'dist', 'data'),
                        // diagnostics.yaml is the code reference (not read at runtime).
                        filter: (file) => !/(README\.md|\.gitkeep|diagnostics\.yaml)$/.test(file),
                    },
                    // The engine's spec package (built by `npm run build` in packages/engine):
                    // server/engine-host.ts loads dist/data/engine/ck3-spec.json.gz.
                    {
                        from: path.resolve(__dirname, '..', 'packages', 'engine', 'dist', 'data'),
                        to: path.resolve(__dirname, 'dist', 'data', 'engine'),
                    },
                ],
            }),
        ],
        ignoreWarnings: [
            {
                module: /vscode-languageserver-types/,
                message: /Critical dependency/,
            },
        ],
    },
];
