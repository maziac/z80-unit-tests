import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';



// Z80 Debugger extension.
const z80DebugExtensionId = "maziac.z80-debug";

// An empty testsuite.
const emptyTestSuite: TestSuiteInfo = {
	type: 'suite',
	id: 'root',
	label: 'Root',
	children: []
};

/// The current testcases.
let currentTestSuite: TestSuiteInfo;


/* Example test suite:
const fakeTestSuite: TestSuiteInfo = {
	type: 'suite',
	id: 'root',
	label: 'Fake', // the label of the root node should be the name of the testing framework
	children: [
		{
			type: 'suite',
			id: 'nested',
			label: 'Nested suite',
			children: [
				{
					type: 'test',
					id: 'test1',
					label: 'Test #1'
				},
				{
					type: 'test',
					id: 'test2',
					label: 'Test #2'
				}
			]
		},
		{
			type: 'suite',
			id: 'nested2',
			label: 'Meine Nested suite',
			children: [
				{
					type: 'test',
					id: 'test21',
					label: 'Test #1'
				},
				{
					type: 'test',
					id: 'test22',
					label: 'Test #2'
				}
			]
		},
		{
			type: 'test',
			id: 'test3',
			label: 'Test #3'
		},
		{
			type: 'test',
			id: 'test4',
			label: 'Test #4'
		}
	]
};
*/



/**
 * Retrieves the unit tests from the z80-debug extension.
 */
export function loadTests(): Promise<TestSuiteInfo> {
	return new Promise<TestSuiteInfo>(resolve => {
		const z80Debug = vscode.extensions.getExtension(z80DebugExtensionId);
		if(!z80Debug) {
			// Show error
			vscode.window.showErrorMessage("'" + z80DebugExtensionId + "' extension not found. Please install!");
			// Return empty test suite
			resolve({type: 'suite', id: 'none', label: 'No tests', children: []}); 
			return;
		}
		if(z80Debug.isActive == false) {
			z80Debug.activate().then(
				// Fullfilled:
				() => {
					getAllUnitTests().then((testSuite) => {
						resolve(testSuite);
					});
				},
				// Reject:
				() => { 
					vscode.window.showErrorMessage("'z80-debug' activation failed.");
					currentTestSuite = emptyTestSuite;
					return resolve(currentTestSuite);
				}
			);
		}
		else {
			getAllUnitTests().then((testSuite) => {
				resolve(testSuite);
			});
		}		
	});
}


/**
 * Function that converts the string labels in a test suite info.
 */
function convertLabelsToTestSuite(labels: string[]): TestSuiteInfo {
	const labelMap = new Map<string, any>();
	for(const label of labels) {
		// Split label in parts
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
		return {
			type: 'suite',
			id: 'root',
			label: 'Root',
			children: []
		};
	}
	// Convert map into suite
	const testSuite = createTestSuite(labelMap) as TestSuiteInfo;
	return testSuite;
}


/**
 * Executes 'z80-debug.getAllUnitTests' in the z80-debug-adapter and then
 * evaluates the returned testcase labels.
 * @returns A test suite or (reject) an error text.
 */
function getAllUnitTests(): Promise<TestSuiteInfo> {
	return new Promise <TestSuiteInfo>(resolve => {
		vscode.commands.executeCommand('z80-debug.getAllUnitTests')
		.then(
			// Fullfilled
			result => {
				// Everything fine.
				const utLabels = result as string[];
				currentTestSuite = convertLabelsToTestSuite(utLabels);
				return resolve(currentTestSuite);			
			},
			// Rejected
			result => {
				// Error
				const errorText = result as string;
				vscode.window.showErrorMessage(errorText);
				// Return empty list
				currentTestSuite = emptyTestSuite;
				return resolve(currentTestSuite);
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
function createTestSuite(map: Map<string,any>, name = 'Root', id = 'root'): TestSuiteInfo|TestInfo {
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
		const childSuite = createTestSuite(childMap, key, id+'.'+key);			
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
 * Runs one or more test cases.
 * @param tests 
 * @param testStatesEmitter 
 */
export async function runTests(
	tests: string[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {

	// Get all selected testcases.
	const testCases = getTestCases(tests);

	// Runs the testcases
	runTestCases(testCases, testStatesEmitter);
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
 * @param node 
 * @param testStatesEmitter 
 */
async function runTestCases(
	testCases: TestInfo[],
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
	// Event: Start the test cases
	testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started'});

	// Tell z80-debug what to test

	/*
Hier muss getestet werden , vorher aber :
- load Tests für alle if-else 
- Nach dem Laden der Tests aus z80-debug scheint z80-debug nicht aus dem Debug mode raus zu getDiffieHellman.
*/
	if(false) {
		// Loop over all testcases
		for(const tc of testCases) {
			//runTestCase(tc, testStatesEmitter);
		}
	}

	// Event: Stop the test cases
	testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished'});
}


/**
 * Runs a single test case.
 * @param testCase 
 * @param testStatesEmitter 
 */
async function runTestCase(
	testCase: TestInfo,
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestEvent>
): Promise<void> {

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: testCase.id, state: 'running' });

	// Run a single test case in the debugger

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: testCase.id, state: 'passed' });
}
