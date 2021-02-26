import * as vscode from 'vscode';
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { loadTests, runTests, cancelTests } from './exectests';


/**
 * Implementation of the Z80 Unit Test Adapter.
 */
export class Z80UnitTestAdapter implements TestAdapter {

	private disposables: { dispose(): void }[] = [];

	private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
	private readonly autorunEmitter = new vscode.EventEmitter<void>();

	get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
	get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
	get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }

	constructor(
		public readonly workspace: vscode.WorkspaceFolder,
		private readonly log: Log
	) {

		this.log.info('Initializing Z80 Unit Test Adapter');

		this.disposables.push(this.testsEmitter);
		this.disposables.push(this.testStatesEmitter);
		this.disposables.push(this.autorunEmitter);

	}

	async load(): Promise<void> {

		this.log.info('Loading unit tests');

		this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

		let loadedTests;
		try {
			const rootFolder = this.workspace.uri.fsPath;
			loadedTests = await loadTests(rootFolder);
			if(loadedTests)
				this.log.info('Unit tests found, ' + rootFolder);
			else
				this.log.info('No unit tests found, ' + rootFolder);
		}
		catch(e) {
			this.log.warn(e);
		}

		this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: loadedTests });

		this.log.info('Loading finished');
	}

	async run(tests: string[]): Promise<void> {
		const rootFolder = this.workspace.uri.fsPath;
		await runTests(false, rootFolder, tests, this.testStatesEmitter);
	}

	async debug(tests: string[]): Promise<void> {
		const rootFolder = this.workspace.uri.fsPath;
		await runTests(true, rootFolder, tests, this.testStatesEmitter);
	}


	// Called when the red square button is pressed. Can be done e.g. during debugging of a testcase.
	async cancel(): Promise<void> {
		// in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
		await cancelTests();
	}


	dispose(): void {
		this.cancel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}
}
