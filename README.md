# Z80 Unit Test Adapter

This is a unit test adapter for the Z80 assembler language.
It allows to run unit tests very comfortable from the vscode UI.

The adapter is just a mediator, it requires other extensions
- [Z80 Debugger](https://github.com/maziac/z80-debug)
- [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) 


## Gallery

![](documentation/images/gallery_unittest.gif)

![](documentation/images/gallery_unittest_fail.gif)


# Howto

An explanation how to prepare your assembler sources to use unit tests can be found here.

TODO:
[Z80 Unit Tests](https://github.com/maziac/z80-debug/...)

If this is working (i.e. you can execute Z80 unit tests from the command palette) then this extension should run out-of-the box:

1. Enter the testing area:
![](documentation/images/gallery_ut0.jpg)

2. Refresh (retrieve addresses of the unit test cases):
![](documentation/images/gallery_ut1.jpg)

3. Navigate to the unit test you want to execute:
![](documentation/images/gallery_ut2.jpg)

4. Hover over it and select Debug, Run or Goto:
![](documentation/images/gallery_ut3.jpg)

5. Run a single unit test. A successful unit test execution will be indicated by a green arrow:
![](documentation/images/gallery_ut4.jpg)

6. Execute all unit tests:
![](documentation/images/gallery_ut5.jpg)

7. A failed testcase is indicated by a red icon:
![](documentation/images/gallery_ut6.jpg)

8. Jump to it:
![](documentation/images/gallery_ut7.jpg)

9. See where it failed:
![](documentation/images/gallery_ut8.jpg)
In this case register 'a' was tested for the number 1 ("TEST_A 1") but obviously it was 0.
The testcase failed and stopped here.
Please note that the code coverage indicated by the green background also stops here because the lines after the failure where not executed anymore.


# Acknowledgements

This extension is based on the examples sources [vscode-example-test-adapter](https://github.com/hbenl/vscode-example-test-adapter) by Holger Benl

It makes use of the brilliant [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension and API (also by Holger Benl).


# License

z80-unit-test is licensed under the [MIT license]().

The source code is available on [github]().



# Implementing a Test Adapter for Visual Studio Code

This repository contains an example for implementing a `TestAdapter` extension that works with the
[Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension.

## Setup

* install the [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension
* fork and clone this repository and open it in VS Code
* run `npm install`
* run `npm run watch` or start the watch Task in VS Code
* start the debugger

You should now see a second VS Code window, the Extension Development Host.
Open a folder in this window and click the "Test" icon in the Activity bar.
Now you should see the fake example test suite in the side panel:

![The fake example test suite](img/fake-tests.png)

## Basic implementation

* add any configuration properties that your Test Adapter needs to the `contributes.configuration.properties` section of `package.json`
* replace the `loadFakeTests()` call in `src/adapter.ts` with your code for loading the test definitions for the real test framework
* replace the `runFakeTests()` call in `src/adapter.ts` with your code for running the tests in a child process using the real test framework

## Getting ready to publish

* search for all occurrences of the word "example" in this project and replace them with the name of the testing framework that your Test Adapter supports
* update `package.json` with your preferred values (at a minimum you should change `author`, `publisher`, `homepage`, `repository` and `bugs`)
* create an icon for your Test Adapter (there's an SVG version of the Test Explorer icon at `img/test-explorer.svg`) and reference it in `package.json`
* replace this README with your documentation

Now you're ready to [publish](https://code.visualstudio.com/docs/extensions/publish-extension) the first version of your Test Adapter.

## Completing the implementation

* implement the `debug()` method
* implement the `cancel()` method (it should kill the child process that was started by `run()` or `debug()`)
* watch the configuration for any changes that may affect the loading of test definitions and reload the test definitions if necessary
* watch the workspace for any changes to the test files and reload the test definitions if necessary
* watch the configuration for any changes that may affect the results of running the tests and emit an `autorun` event if necessary
* watch the workspace for any changes to the source files and emit an `autorun` event if necessary
* ensure that only one test run is active at a time
