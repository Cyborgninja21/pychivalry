const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Watch-mode markers for VS Code's background problem matcher (.vscode/tasks.json,
 * "extension: watch"): `[watch] build started` when the first of the bundles starts a
 * (re)build and `[watch] build finished` once every bundle has finished, so the Dev Mode
 * launch waits for both. Silent outside watch mode. One instance is shared by all
 * configurations; `expected` is their number.
 */
class WatchMarkers {
    constructor(expected) {
        this.expected = expected;
        this.state = new Map(); // compiler name -> 'running' | 'idle'
    }

    busy() {
        return Array.from(this.state.values()).some((s) => s === 'running');
    }

    apply(compiler) {
        const name = compiler.options.output.filename;
        compiler.hooks.watchRun.tap('WatchMarkers', () => {
            if (!this.busy()) {
                process.stdout.write('[watch] build started\n');
            }
            this.state.set(name, 'running');
        });
        const finish = () => {
            if (!compiler.watchMode) {
                return;
            }
            this.state.set(name, 'idle');
            if (this.state.size === this.expected && !this.busy()) {
                process.stdout.write('[watch] build finished\n');
            }
        };
        compiler.hooks.done.tap('WatchMarkers', finish);
        compiler.hooks.failed.tap('WatchMarkers', finish);
    }
}
const watchMarkers = new WatchMarkers(2);

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
        plugins: [watchMarkers],
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
            watchMarkers,
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
