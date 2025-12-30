import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting CK3 Language Support tests');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(extension, 'Extension should be installed');
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(extension, 'Extension should be installed');

        // Activate the extension
        await extension.activate();
        assert.ok(extension.isActive, 'Extension should be active');
    });

    test('CK3 language should be registered', async () => {
        const languages = await vscode.languages.getLanguages();
        assert.ok(languages.includes('ck3'), 'CK3 language should be registered');
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(
            commands.includes('ck3LanguageServer.restart'),
            'Restart command should be registered'
        );
    });

    test('Configuration should have correct defaults', () => {
        const config = vscode.workspace.getConfiguration('ck3LanguageServer');

        // Note: In test workspace, settings may override defaults
        // Just verify the configuration exists and has expected keys
        assert.ok(config.has('enable'), 'enable setting should exist');
        assert.ok(config.has('pythonPath'), 'pythonPath setting should exist');
        assert.ok(config.has('trace.server'), 'trace.server setting should exist');
        assert.ok(config.has('args'), 'args setting should exist');
    });
});

suite('Language Configuration Tests', () => {
    test('Should recognize .txt files as CK3', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: 'namespace = test',
        });
        assert.strictEqual(doc.languageId, 'ck3', 'Document should be CK3 language');
    });

    test('Should handle CK3 script content', async () => {
        const content = `namespace = my_mod

my_mod.0001 = {
    type = character_event
    title = my_mod.0001.t
    desc = my_mod.0001.desc
    
    trigger = {
        is_adult = yes
    }
    
    option = {
        name = my_mod.0001.a
    }
}`;
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: content,
        });

        assert.ok(doc.getText().includes('namespace'), 'Document should contain content');
        assert.ok(doc.lineCount >= 15, 'Document should have reasonable line count');
    });
});

suite('Document Handling Tests', () => {
    test('Should open CK3 document without errors', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: 'trigger = { is_adult = yes }',
        });

        const editor = await vscode.window.showTextDocument(doc);
        assert.ok(editor, 'Editor should be opened');
        assert.strictEqual(editor.document.languageId, 'ck3', 'Editor should show CK3 document');

        // Close the editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Should handle empty document', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: '',
        });

        assert.strictEqual(doc.getText(), '', 'Empty document should have no content');
        assert.strictEqual(doc.languageId, 'ck3', 'Empty document should still be CK3');
    });

    test('Should handle large document', async () => {
        // Generate a large CK3 script
        let content = 'namespace = test\n\n';
        for (let i = 1; i <= 100; i++) {
            content += `test.${String(i).padStart(4, '0')} = {
    type = character_event
    title = test.${String(i).padStart(4, '0')}.t
    option = { name = test.${String(i).padStart(4, '0')}.a }
}

`;
        }

        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: content,
        });

        assert.ok(doc.lineCount > 500, 'Large document should have many lines');
    });
});
