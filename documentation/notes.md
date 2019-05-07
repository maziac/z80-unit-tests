# Debugging

The setup is a little bit tricky. There are 3 extensions involved.
- the hbenl.vscode-test-explorer
- the maziac.z80-debug 
- this extension (z80-unit-tests)

hbenl.vscode-test-explorer should be installed via the market place.

z80-debug need to be installed as a vsix file.
It cannot be debugged along with this extension.

This extension (z80-unit-tests) can be started in debug mode. A new vscode will open. There an assembler project (with unit tests) should be opened.
This will start the z80-unit-tests test adapter.


