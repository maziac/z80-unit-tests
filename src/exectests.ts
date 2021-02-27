import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';
import * as path from 'path';



// Z80 Debugger extension.
const dezogExtensionId = "maziac.dezog";

/**
 * Enumeration for the returned test case pass or failure.
 */
enum TestCaseResult {
	OK = 0,
	FAILED = 1,
	TIMEOUT = 2,
	CANCELLED = 3,	// Testcases have been cancelled, e.g. manually or the connection might have been lost or whatever.
}


/**
 * This structure is returned by getAllUnitTests.
 */
export interface UnitTestCase {
	label: string;	// The full label of the test case, e.g. "test.UT_test1"
	file: string;	// The full path of the file
	line: number;	// The line number of the label
}


/**
 * Retrieves the unit tests from the dezog extension.
 * @param rootFolder The root folder of the project.
 */
export async function loadTests(rootFolder: string): Promise<TestSuiteInfo> {
	// Check for deZog
	const dezog = vscode.extensions.getExtension(dezogExtensionId);
	if (!dezog) {
		// Return error
		const txt = "'" + dezogExtensionId + "' extension not found. Please install!";
		throw txt;
	}

	// Activate DeZog
	if (!dezog.isActive) {
		try {
			await dezog.activate();
		}
		catch (e) {
			// Return error
			const txt = "'DeZog' activation failed.";
			throw txt;
		}
	}

	// Get unit tests of project
	const testSuite = await getAllUnitTests(rootFolder);

	// Return
	return testSuite;
}


/**
 * Function that converts the string labels in a test suite info.
 * @param rootFolder The root folder of the project.
 */
function convertLabelsToTestSuite(rootFolder: string, lblLocations: UnitTestCase[]): TestSuiteInfo|undefined {
	const labels = lblLocations.map(lblLoc => lblLoc.label);
	const labelMap = new Map<string, any>();
	for(const label of labels) {
		const parts = label.split('.');
		let map = labelMap;
		// E.g. "ut_string" "UTT_byte_to_string"
		for(const part of parts) {
			// Check if entry exists
			let nextMap = map.get(part);
			// Check if already existent
			if(!nextMap) {
				// Create entry
				nextMap = new Map<string, any>();
				map.set(part, nextMap);
			}
			// Next
			map = nextMap;
		}
	}
	// Note: an entry with a map of length 0 is a leaf, i.e. a testcase. Others are test suites.
	if(labelMap.size == 0) {
		// Return an empty suite
		return undefined;
	}
	// Convert map into suite
	const projectName = path.basename(rootFolder);
	const testSuite = createTestSuite(labelMap, projectName) as TestSuiteInfo;
	// Assign files and line numbers
	const fileLinesMap = new Map<string, {file: string, line:number}>();
	lblLocations.map(lblLoc => {
		fileLinesMap.set(lblLoc.label, {file: lblLoc.file, line: lblLoc.line});
	});
	assignFilesAndLines(testSuite, fileLinesMap);
	return testSuite;
}


/**
 * Executes 'dezog.getAllUnitTests' in DeZog and then
 * evaluates the returned testcase labels.
 * @param rootFolder The root folder of the project.
 * @returns A test suite or (reject) an error text.
 */
async function getAllUnitTests(rootFolder: string): Promise<TestSuiteInfo> {
	const lblLocations = await vscode.commands.executeCommand('dezog.getAllUnitTests', rootFolder) as UnitTestCase[];
	const testSuite = convertLabelsToTestSuite(rootFolder, lblLocations)!;
	return testSuite;
}


/**
 * Create a testsuite object from the given map.
 * Calls itself recursively.
 * @param map A map of maps. An entry with a map of length 0 is a leaf,
 * i.e. a testcase. Others are test suites.
 * @return The correspondent testsuite.
 */
function createTestSuite(map: Map<string,any>, name: string, id = ''): TestSuiteInfo|TestInfo {
	// Check if testsuite or testcase
	if(map.size == 0) {
		// It has no children, it is a leaf, i.e. a testcase
		return {
			type: 'test',
			id: id,
			label: name
		};
	}

	// It has children, i.e. it is a test suite
	const children: Array<TestSuiteInfo|TestInfo> = [];
	for(const [key, childMap] of map) {
		const totalKey = (id == '')? key : id+'.'+key;
		const childSuite = createTestSuite(childMap, key, totalKey);
		children.push(childSuite);
	}
	return {
		type: 'suite',
		id: id,
		label: name,
		children: children
	};
}


/**
 * Assigns files and line numbers to the testSuite.
 * Calls itself recursively.
 * @param testSuite The complete test suite with label names.
 * @param fileLinesMap A map with the label as key and the filename and line number as value.
 */
function assignFilesAndLines(testSuite: TestSuiteInfo|TestInfo, fileLinesMap: Map<string, {file: string, line:number}>) {
	const label = testSuite.id;
	const location = fileLinesMap.get(label);
	if(location) {
		// Set filename and line number
		testSuite.file = location.file;
		testSuite.line = location.line;
	}
	// Dive into children
	const children = (testSuite as any).children;
	if(children) {
		for(const child of children)
			assignFilesAndLines(child, fileLinesMap);
	}
}


/**
 * Runs one or more test cases.
 * @param debug true if debugger should be started in debug mode.
 * @param rootFolder The root folder of the project.
 * @param tests An array with the test case names. If only one is selected it is the tetcase itself or
 * the selected testsuite. But it is also possible to select certain testcase. Then it is an array with more than 1 entry.
 * @param testStatesEmitter
 */
export async function runTests(
	debug: boolean,
	rootFolder: string,
	tests: string[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent|TestRunFinishedEvent|TestSuiteEvent|TestEvent>
): Promise<void> {

	// The testadapter does not wait on completion, so we have to handle ourselves and put the requests in a queue
	const f = async () => {
		// Get all selected testcases.
		const testCases = await getTestCases(rootFolder, tests);
		// Runs the testcases
		await runTestCases(debug, rootFolder, testCases, testStatesEmitter);
	};
	runTestsQueue.push(f);

	// Return if already running
	if (runTestsQueue.length > 1)
		return;

	// Loop through queue
	while (runTestsQueue.length > 0) {
		const func = runTestsQueue[0];
		await func();
		runTestsQueue.shift()
	}
}
const runTestsQueue = new Array <() => void> ();



/**
 * Cancels all running test cases.
 * Note: This is called once per project in a multiroot project.
 * So correct implementation would be to check the runTestsQueue (the queue would be required to be extended to also contain the rootFolder).
 * All entries with the rootFolder would be removed from the queue.
 * If it would be the first entry then dezog would be informed to cancel the test.
 * Drawback is that this would come in the wrong order already the next queued testcases would have started.
 * So a simplified approach was chosen: any project 'cancel' cancels everything.
 * There is anyhow only one button for all.
 */
export async function cancelTests(): Promise<void> {
	// Tell DeZog to cancel the running unit tests.
	if (runTestsQueue.length > 0) {
		runTestsQueue.length = 0;
		// Do only once
		await vscode.commands.executeCommand('dezog.cancelUnitTests');
	}
}


/**
 * Returns all test cases that are identified by the strings in
 * 'tests' array. If a suite is mentioned all testcases from that suite are returned.
 * @param rootFolder The root folder of the project.
 * @param tests An array with test cases or test suite names.
 * @returns An array with test cases.
 */
async function getTestCases(rootFolder: string, tests: string[]): Promise<TestInfo[]> {
	const testCases: TestInfo[] = [];

	// Get test suite (again)
	const testSuite = await getAllUnitTests(rootFolder);

	// Loop
	if (testSuite) {
		for (const suiteOrTestId of tests) {
			const node = findNode(testSuite, suiteOrTestId);
			assert(node);
			if(node) {
				const tcs = getAllFromNode(node);
				testCases.push(...tcs);
			}
		}
	}

	// return
	return testCases;
}


/**
 * Returns all testcases that migth be included. I.e. returns all
 * child testcases of a 'suite'.
 * If node is a 'test' it only returns the node itself.
 * @param node Either 'test' or 'suite'.
 * @returns An array with all testcases.
 */
function getAllFromNode(node: TestSuiteInfo | TestInfo): TestInfo[] {
	if(node.type === 'test') {
		// REtrun just the test case
		return [node];
	}

	// It's a suite, so take all children
	assert(node.type === 'suite');
	const testCases: TestInfo[] = [];

	// Loop over all chldren
	for (const child of node.children) {
		const childTestCases = getAllFromNode(child);
		testCases.push(...childTestCases);
	}

	// Return
	return testCases;
}


/**
 * Searches the node 'id' in the test (sub) tree.
 * @param searchNode The test (sub) tree.
 * @param id The id to search.
 * @returns The node, Either a TestSuiteInfo or a TestInfo.
 */
function findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
	if (searchNode.id === id) {
		return searchNode;
	}
	else if (searchNode.type === 'suite') {
		for (const child of searchNode.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return undefined;
}


/**
 * Runs the testcases.
 * @param debug true if debugger should be started in debug mode.
 * @param rootFolder The root folder of the project.
 * @param testCases Array of tests.
 * @param testStatesEmitter
 */
async function runTestCases(debug: boolean,
 	rootFolder: string,
	testCases: TestInfo[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
	// Event: Start the test cases
	const tcLabels=testCases.map(tc => tc.id);
	testStatesEmitter.fire(<TestRunStartedEvent>{type: 'started', tests: tcLabels});

	// Run all test cases
	await runProjectTestCases(debug, rootFolder, tcLabels, testStatesEmitter);

	// Event: Stop the test cases
	testStatesEmitter.fire(<TestRunFinishedEvent>{type: 'finished'});
}


/**
 * Runs all testcases for one project in case of a multiroot project.
 */
async function runProjectTestCases(debug: boolean,
	rootFolder: string,
	testCaseLabels: string[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
	return new Promise<void>(resolve => {
		// Tell dezog to clear current tests
		vscode.commands.executeCommand('dezog.initUnitTests');
		// Start all testcases
		let tcCount = 0;
		for (const tcLabel of testCaseLabels) {
			testStatesEmitter.fire(<TestEvent>{type: 'test', test: tcLabel, state: 'running'});
			// Tell dezog what to test
			tcCount++;
			vscode.commands.executeCommand('dezog.execUnitTestCase', tcLabel)
				.then(testCaseResult => {
					// Return the result
					let tcResultStr = "errored";
					let message;
					switch (testCaseResult) {
						case TestCaseResult.OK:
							tcResultStr = "passed";
							break;
						case TestCaseResult.TIMEOUT:
							message = 'Timed out!';
						// Flow through
						case TestCaseResult.FAILED:
							tcResultStr = "failed";
							break;
					}
					testStatesEmitter.fire(<TestEvent>{type: 'test', test: tcLabel, state: tcResultStr, message: message});
					// Check if last test case run
					tcCount--;
					if (tcCount == 0) {
						// Return after last testcase finished
						resolve();
					}
				});
		}

		// Start the unit tests
		if (debug)
			vscode.commands.executeCommand('dezog.debugPartialUnitTests', rootFolder);
		else
			vscode.commands.executeCommand('dezog.runPartialUnitTests', rootFolder);
	});
}

