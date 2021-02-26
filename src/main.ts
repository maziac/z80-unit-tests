import * as vscode from 'vscode';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { Z80UnitTestAdapter } from './adapter';

export async function activate(context: vscode.ExtensionContext) {
	// Create a simple logger that can be configured with the configuration variables
	// `z80UnitTestExplorer.logpanel` and `z80UnitTestExplorer.logfile`
	let workspaceFolder;
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
		workspaceFolder = vscode.workspace.workspaceFolders[0];
	const log = new Log('z80UnitTestExplorer', workspaceFolder, 'Z80 Unit Test Explorer Log');
	context.subscriptions.push(log);

	// Get the Test Explorer extension
	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
	if (log.enabled) log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);

	if (testExplorerExtension) {

		const testHub = testExplorerExtension.exports;

		// This will register an ExampleTestAdapter for each WorkspaceFolder
		context.subscriptions.push(new TestAdapterRegistrar(
			testHub,
			workspaceFolder => new Z80UnitTestAdapter(workspaceFolder, log),
			log
		));
	}
}
