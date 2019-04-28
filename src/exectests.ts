import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';

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


/**
 * Retrieves the unit tests from the z80-debug extension.
 */
export function loadTests(): Promise<TestSuiteInfo> {
	return Promise.resolve<TestSuiteInfo>(fakeTestSuite);
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
	runTestCases(testCases);
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
	for (const suiteOrTestId of tests) {
		const node = findNode(fakeTestSuite, suiteOrTestId);
		assert(node);
		if(node) {
			const tcs = getAllFromNode(node);
			testCases.push(...tcs);
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

	// return
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
	node: TestSuiteInfo | TestInfo,
	testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });

	// Run a single test case in the debugger

	testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'passed' });
}
