import * as vscode from 'vscode';
/*
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { Z80UnitTestAdapter } from './adapter';
*/

export async function activate(context: vscode.ExtensionContext) {
	const message: string = "Please de-install the 'Z80 Unit Tests' extension. It is no longer required. The functionality has been incorporated in DeZog 2.4. Please see https://github.com/maziac/DeZog/blob/main/documentation/Migration.md for more info.";
	const msgDoc = "Open Migration.md";
	vscode.window.showWarningMessage(message, msgDoc)
		.then(result => {
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/maziac/DeZog/blob/main/documentation/Migration.md'));
		});
	// Also output to log
	console.log(message);

	/*
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
	*/
}
