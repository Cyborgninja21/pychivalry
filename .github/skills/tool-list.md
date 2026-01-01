# GitHub Copilot Available Tools

Complete list of 74 tools available to GitHub Copilot for code assistance, organized by category.

## File System & Workspace Management

### create_directory
Create directory structure recursively (like mkdir -p).
- **Parameters**: `dirPath` (string) - absolute path to directory

### create_file
Create new file with content (automatically creates directories if needed).
- **Parameters**: 
  - `filePath` (string) - absolute path to file
  - `content` (string) - file content

### list_dir
List directory contents (folders end with /).
- **Parameters**: `path` (string) - absolute path to directory

### read_file
Read file contents with optional line range.
- **Parameters**:
  - `filePath` (string) - absolute path to file
  - `offset` (number, optional) - 1-based line number to start from
  - `limit` (number, optional) - maximum lines to read

### replace_string_in_file
Edit file by replacing exact string match. Must include 3+ lines of context.
- **Parameters**:
  - `filePath` (string) - absolute path to file
  - `oldString` (string) - exact text to replace (with context)
  - `newString` (string) - replacement text

### multi_replace_string_in_file
Apply multiple replace operations in one call (more efficient than sequential).
- **Parameters**:
  - `explanation` (string) - brief description of operations
  - `replacements` (array) - array of replacement operations

### file_search
Search files by glob pattern.
- **Parameters**:
  - `query` (string) - glob pattern (e.g., `**/*.py`)
  - `maxResults` (number, optional) - limit results

### grep_search
Fast text/regex search across workspace.
- **Parameters**:
  - `query` (string) - search pattern
  - `isRegexp` (boolean) - whether pattern is regex
  - `includePattern` (string, optional) - glob to limit search
  - `includeIgnoredFiles` (boolean, optional) - search in .gitignore files
  - `maxResults` (number, optional) - limit results

### semantic_search
Natural language search for relevant code/comments.
- **Parameters**: `query` (string) - natural language search query

## Code Analysis & Navigation

### list_code_usages
Find references, definitions, implementations of symbols.
- **Parameters**:
  - `symbolName` (string) - symbol name to find
  - `filePaths` (array, optional) - files likely containing definition

### get_errors
Get compile/lint errors for files or entire workspace.
- **Parameters**: `filePaths` (array, optional) - paths to check (omit for all)

### get_changed_files
Get git diffs of current changes.
- **Parameters**:
  - `repositoryPath` (string, optional) - path to git repo
  - `sourceControlState` (array, optional) - filter by state: staged, unstaged, merge-conflicts

## Workspace & Project Setup

### create_new_workspace
Get comprehensive project setup steps for full initialization.
- **Parameters**: `query` (string) - description of workspace to create

### get_project_setup_info
Get project setup information for specific project type.
- **Parameters**: `projectType` (string) - python-script, python-project, mcp-server, vscode-extension, next-js, vite, other

## VS Code Specific

### get_vscode_api
Get VS Code extension API documentation and references.
- **Parameters**: `query` (string) - specific API/concept to search for

### install_extension
Install VS Code extension by ID (use during workspace creation only).
- **Parameters**:
  - `id` (string) - extension ID (publisher.extension)
  - `name` (string) - extension name

### run_vscode_command
Execute VS Code command (use during workspace creation only).
- **Parameters**:
  - `commandId` (string) - command ID
  - `name` (string) - command description
  - `args` (array, optional) - command arguments

### vscode_searchExtensions_internal
Search VS Code marketplace for extensions.
- **Parameters**:
  - `keywords` (array, optional) - search keywords
  - `category` (string, optional) - extension category
  - `ids` (array, optional) - specific extension IDs

### open_simple_browser
Preview URL in VS Code's Simple Browser.
- **Parameters**: `url` (string) - HTTP/HTTPS URL to open

### get_search_view_results
Get results from search view.
- **Parameters**: None

## Terminal Operations

### run_in_terminal
Execute shell commands in persistent bash session.
- **Parameters**:
  - `command` (string) - shell command to execute
  - `explanation` (string) - one-sentence description
  - `isBackground` (boolean) - whether command runs in background

### get_terminal_output
Get output from background terminal process.
- **Parameters**: `id` (string) - terminal ID from background process

### terminal_last_command
Get last command run in active terminal.
- **Parameters**: None

### terminal_selection
Get current terminal selection.
- **Parameters**: None

### create_and_run_task
Create and run build/run/custom task in tasks.json.
- **Parameters**:
  - `task` (object) - task definition (label, type, command, etc.)
  - `workspaceFolder` (string) - absolute path to workspace folder

## Jupyter Notebooks

### create_new_jupyter_notebook
Generate new .ipynb file.
- **Parameters**: `query` (string) - description of notebook to create

### edit_notebook_file
Insert/edit/delete notebook cells.
- **Parameters**:
  - `filePath` (string) - path to notebook file
  - `editType` (string) - insert, delete, or edit
  - `cellId` (string) - cell ID or TOP/BOTTOM
  - `language` (string, optional) - cell language
  - `newCode` (string/array, optional) - cell content

### copilot_getNotebookSummary
Get notebook cell summary with IDs and execution info.
- **Parameters**: `filePath` (string) - path to notebook file

### run_notebook_cell
Execute code cell in notebook.
- **Parameters**:
  - `filePath` (string) - path to notebook file
  - `cellId` (string) - cell ID to execute
  - `continueOnError` (boolean, optional) - continue if error occurs
  - `reason` (string, optional) - explanation for execution

### read_notebook_cell_output
Retrieve cell output from last execution.
- **Parameters**:
  - `filePath` (string) - path to notebook file
  - `cellId` (string) - cell ID

### configure_notebook
Configure notebook before first use (call before running cells).
- **Parameters**: `filePath` (string) - path to notebook file

### notebook_install_packages
Install packages in notebook kernel.
- **Parameters**:
  - `filePath` (string) - path to notebook file
  - `packageList` (array) - list of packages to install

### notebook_list_packages
List installed packages in notebook kernel.
- **Parameters**: `filePath` (string) - path to notebook file

## Python Environment Management

### configure_python_environment
Set up Python environment for workspace (call before other Python tools).
- **Parameters**: `resourcePath` (string, optional) - path to Python file/workspace

### get_python_environment_details
Get Python env type, version, and installed packages.
- **Parameters**: `resourcePath` (string, optional) - path to Python file/workspace

### get_python_executable_details
Get Python executable path and command construction details.
- **Parameters**: `resourcePath` (string, optional) - path to Python file/workspace

### install_python_packages
Install Python packages in workspace environment.
- **Parameters**:
  - `packageList` (array) - list of packages to install
  - `resourcePath` (string, optional) - path to Python file/workspace

## GitHub & Pull Requests

### github-pull-request_activePullRequest
Get comprehensive info about active/checked-out PR.
- **Parameters**: None

### github-pull-request_openPullRequest
Get info about currently visible PR.
- **Parameters**: None

### github-pull-request_copilot-coding-agent
Launch async coding agent for task completion (creates branch and opens PR).
- **Parameters**:
  - `title` (string) - issue title
  - `body` (string) - issue description
  - `existingPullRequest` (number, optional) - existing PR number

### github-pull-request_formSearchQuery
Convert natural language to GitHub search query.
- **Parameters**:
  - `naturalLanguageString` (string) - plain text search description
  - `repo` (object, optional) - repository owner and name

### github-pull-request_doSearch
Execute GitHub search with proper syntax.
- **Parameters**:
  - `query` (string) - well-formed GitHub search query
  - `repo` (object) - repository owner and name

### github-pull-request_issue_fetch
Get issue/PR details as JSON.
- **Parameters**:
  - `issueNumber` (number) - issue/PR number
  - `repo` (object, optional) - repository owner and name

### github-pull-request_renderIssues
Render issue search results in markdown table.
- **Parameters**:
  - `arrayOfIssues` (array) - array of GitHub issues
  - `totalIssues` (number) - total issue count

### github-pull-request_suggest-fix
Summarize and suggest fix for GitHub issue.
- **Parameters**:
  - `issueNumber` (number) - issue number
  - `repo` (object) - repository owner and name

### github_repo
Search specific GitHub repository for code snippets.
- **Parameters**:
  - `repo` (string) - repository in format owner/repo
  - `query` (string) - search query with context

## Docker/Container Management (MCP)

### mcp_copilot_conta_list_containers
List all containers (including stopped ones).
- **Parameters**: None

### mcp_copilot_conta_list_images
List container images (including untagged and orphaned).
- **Parameters**: None

### mcp_copilot_conta_list_networks
List container networks.
- **Parameters**: None

### mcp_copilot_conta_list_volumes
List container volumes.
- **Parameters**: None

### mcp_copilot_conta_act_container
Start/stop/restart/remove container by name or ID.
- **Parameters**:
  - `containerNameOrId` (string) - container name or ID
  - `action` (string) - start, stop, restart, or remove

### mcp_copilot_conta_act_image
Pull/remove container image by name or ID.
- **Parameters**:
  - `imageNameOrId` (string) - image name or ID
  - `action` (string) - pull or remove

### mcp_copilot_conta_inspect_container
Inspect container by name or ID.
- **Parameters**: `containerNameOrId` (string) - container name or ID

### mcp_copilot_conta_inspect_image
Inspect image by name or ID.
- **Parameters**: `imageNameOrId` (string) - image name or ID

### mcp_copilot_conta_logs_for_container
View container logs by name or ID.
- **Parameters**: `containerNameOrId` (string) - container name or ID

### mcp_copilot_conta_run_container
Run new container with full configuration.
- **Parameters**:
  - `image` (string) - image to start container from
  - `name` (string, optional) - container name
  - `ports` (array, optional) - port bindings
  - `environmentVariables` (object, optional) - environment variables
  - `mounts` (array, optional) - bind/volume mounts
  - `network` (string, optional) - network name
  - `publishAllPorts` (boolean, optional) - publish all exposed ports
  - `interactive` (boolean, optional) - run interactively

### mcp_copilot_conta_tag_image
Tag container image with new tag.
- **Parameters**:
  - `imageNameOrId` (string) - image name or ID
  - `tag` (string) - tag to apply

### mcp_copilot_conta_prune
Prune unused container resources.
- **Parameters**: `pruneTarget` (string) - containers, images, volumes, networks, or all

## Pylance/Python Analysis (MCP)

### mcp_pylance_mcp_s_pylanceDocuments
Search Pylance documentation for help and configuration.
- **Parameters**: `search` (string) - detailed question in natural language

### mcp_pylance_mcp_s_pylanceWorkspaceRoots
Get workspace root directories.
- **Parameters**: `fileUri` (string, optional) - file URI to check workspace

### mcp_pylance_mcp_s_pylanceWorkspaceUserFiles
List all user Python files in workspace (excludes libraries).
- **Parameters**: `workspaceRoot` (string) - workspace root URI

### mcp_pylance_mcp_s_pylanceFileSyntaxErrors
Check Python file for syntax errors.
- **Parameters**:
  - `workspaceRoot` (string) - workspace root URI
  - `fileUri` (string) - file URI to check

### mcp_pylance_mcp_s_pylanceSyntaxErrors
Validate Python code snippet for syntax errors.
- **Parameters**:
  - `code` (string) - Python code to validate
  - `pythonVersion` (string) - Python version (e.g., "3.10")

### mcp_pylance_mcp_s_pylanceImports
Analyze imports across workspace user files.
- **Parameters**: `workspaceRoot` (string) - workspace root URI

### mcp_pylance_mcp_s_pylanceInstalledTopLevelModules
Get available top-level modules from installed packages.
- **Parameters**:
  - `workspaceRoot` (string) - workspace root URI
  - `pythonEnvironment` (string, optional) - Python environment path

### mcp_pylance_mcp_s_pylancePythonEnvironments
Get Python environment info for workspace.
- **Parameters**: `workspaceRoot` (string) - workspace root URI

### mcp_pylance_mcp_s_pylanceUpdatePythonEnvironment
Switch active Python environment for workspace.
- **Parameters**:
  - `workspaceRoot` (string) - workspace root URI
  - `pythonEnvironment` (string) - Python environment path or executable

### mcp_pylance_mcp_s_pylanceSettings
Get current Python analysis settings and configuration.
- **Parameters**: `workspaceRoot` (string) - workspace root URI

### mcp_pylance_mcp_s_pylanceInvokeRefactoring
Apply automated code refactoring to Python files.
- **Parameters**:
  - `fileUri` (string) - file URI to refactor
  - `name` (string) - refactoring name (source.unusedImports, source.convertImportFormat, source.convertImportStar, source.addTypeAnnotation, source.fixAll.pylance)
  - `mode` (string, optional) - output mode: update, edits, or string

### mcp_pylance_mcp_s_pylanceRunCodeSnippet
Execute Python code directly in workspace environment (PREFERRED over terminal).
- **Parameters**:
  - `workspaceRoot` (string) - workspace root URI
  - `codeSnippet` (string) - code to execute
  - `workingDirectory` (string, optional) - working directory
  - `timeout` (number, optional) - execution timeout

## Task & Project Management

### manage_todo_list
Track multi-step task progress with status updates.
- **Parameters**: `todoList` (array) - array of todo items with id, title, description, status

### runSubagent
Launch autonomous agent for complex multi-step tasks.
- **Parameters**:
  - `prompt` (string) - detailed task description
  - `description` (string) - short 3-5 word description

## Web & External Content

### fetch_webpage
Fetch and extract main content from webpage.
- **Parameters**:
  - `urls` (array) - array of URLs to fetch
  - `query` (string) - query to search for in content

## Testing

### test_failure
Include test failure information in prompt.
- **Parameters**: None

---

**Total Tools**: 74

**Invocation Format**: Tools are invoked using `<invoke name="function_name">` syntax within the tool-calling framework.

**Last Updated**: January 1, 2026
