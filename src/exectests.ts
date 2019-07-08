import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';



// Z80 Debugger extension.
const z80DebugExtensionId = "maziac.z80-debug";

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



/// The current testcases.
let currentTestSuite: TestSuiteInfo|undefined;


/**
 * Retrieves the unit tests from the z80-debug extension.
 */
export function loadTests(): Promise<TestSuiteInfo> {
	return new Promise<TestSuiteInfo>((resolve, reject) => {
		const z80Debug = vscode.extensions.getExtension(z80DebugExtensionId);
		if(!z80Debug) {
			// Return error
			currentTestSuite = undefined;
			const txt = "'" + z80DebugExtensionId + "' extension not found. Please install!";
			return reject(txt); 
		}
		if(z80Debug.isActive == false) {
			z80Debug.activate().then(
				// Fullfilled:
				() => {
					getAllUnitTests().then(
						// Resolve
						testSuite => {
							resolve(testSuite);
						},
						// Reject
						errorText => {
							reject(errorText);
						});
				},
				// Reject:
				() => { 
					currentTestSuite = undefined;
					// Return error
					const txt = "'z80-debug' activation failed.";
					reject(txt); 
				}
			);
		}
		else {
			getAllUnitTests().then(
				// Resolve
				testSuite => {
					resolve(testSuite);
				},
				// Reject
				errorText => {
					reject(errorText);
				});
		}		
	});
}


/**
 * Function that converts the string labels in a test suite info.
 */
function convertLabelsToTestSuite(lblLocations: UnitTestCase[]): TestSuiteInfo|undefined {
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
	const testSuite = createTestSuite(labelMap) as TestSuiteInfo;
	// Assign files and line numbers
	const fileLinesMap = new Map<string, {file: string, line:number}>();
	lblLocations.map(lblLoc => {
		fileLinesMap.set(lblLoc.label, {file: lblLoc.file, line: lblLoc.line});
	});
	assignFilesAndLines(testSuite, fileLinesMap);
	return testSuite;
}


/**
 * Executes 'z80-debug.getAllUnitTests' in the z80-debug-adapter and then
 * evaluates the returned testcase labels.
 * @returns A test suite or (reject) an error text.
 */
function getAllUnitTests(): Promise<TestSuiteInfo> {
	return new Promise <TestSuiteInfo>((resolve, reject) => {
		vscode.commands.executeCommand('z80-debug.getAllUnitTests')
		.then(
			// Fullfilled
			result => {
				// Everything fine.
				const lblLocations = result as UnitTestCase[];
				currentTestSuite = convertLabelsToTestSuite(lblLocations);
				return resolve(currentTestSuite);			
			},
			// Rejected
			result => {
				// Error
				const errorText = result as string;
				// Return empty list
				currentTestSuite = undefined;
				// Return error
				return reject(errorText); 
			}
		);
	});
}


/**
 * Create a testsuite object from the given map.
 * Calls itself recursively.
 * @param map A map of maps. An entry with a map of length 0 is a leaf, 
 * i.e. a testcase. Others are test suites.
 * @return The correspondent testsuite.
 */
function createTestSuite(map: Map<string,any>, name = 'z80-unit-tests', id = ''): TestSuiteInfo|TestInfo {
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
 * @param node 
 * @param testStatesEmitter 
 */
export async function runTests(
	debug: boolean,
	tests: string[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {

	// Get all selected testcases.
	const testCases = getTestCases(tests);

	// Runs the testcases
	runTestCases(debug, testCases, testStatesEmitter);
}


/**
 * Returns all test cases that are identified by the strings in
 * 'tests' array. If a suite is mentioned all testcases from that suite are returned.
 * @param tests An array with test cases or test suite names.
 * @returns An array with test cases.
 */
function getTestCases(tests: string[]): TestInfo[] {
	const testCases: TestInfo[] = [];

	// Loop
	if(currentTestSuite) {
		for (const suiteOrTestId of tests) {
			const node = findNode(currentTestSuite, suiteOrTestId);
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
 * @param node 
 * @param testStatesEmitter 
 */
async function runTestCases(debug: boolean,
	testCases: TestInfo[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
	// Event: Start the test cases
	testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started'});

	// Tell z80-debug to clear current tests
	vscode.commands.executeCommand('z80-debug.initUnitTests');

	// Loop over all testcases and emit that test case started
	let tcCount = 0;
	for(const tc of testCases) {
		const tcLabel: string = tc.id;
		testStatesEmitter.fire(<TestEvent>{ type: 'test', test: tcLabel, state: 'running' });
		// Tell z80-debug what to test
		tcCount ++;
		vscode.commands.executeCommand('z80-debug.execUnitTestCase', tcLabel)
		.then(testCaseResult => {
			// Return the ersult
			let tcResultStr = "errored";
			let message;
			switch(testCaseResult) {
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
			tcCount --;
			if(tcCount == 0) {
				// Event: Stop the test cases
				testStatesEmitter.fire(<TestRunFinishedEvent>{type: 'finished'});
			}
		});
	}

	// Start the unit tests
	if(debug)
		vscode.commands.executeCommand('z80-debug.debugPartialUnitTests');
	else
		vscode.commands.executeCommand('z80-debug.runPartialUnitTests');
}


/**
 * Runs a single test case.
 * @param testCase 
 * @param testStatesEmitter 
 */
/*
async function runTestCase(
	testCase: TestInfo,
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestEvent>
): Promise<void> {

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: testCase.id, state: 'running' });

	// Run a single test case in the debugger

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: testCase.id, state: 'passed' });
}
*/