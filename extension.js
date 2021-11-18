
const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let curClassDisposable = vscode.commands.registerCommand('symfony-service-locator.gotoClassServiceDefinition', function () {

		let currentDoc = vscode.window.activeTextEditor.document.getText();
		let namespace = getNamespace(currentDoc);
		let className = getClassName(currentDoc);
		let state = { isFound: false };

		if (!className) {
			vscode.window.showInformationMessage("No class found in current document");
			return;
		}

		let serviceName = namespace + '\\' + className;
		const searchRegEx = constructRegExp(serviceName);
		searchConfigs(serviceName, state, searchRegEx);
	});

	let selectionDisposable = vscode.commands.registerCommand('symfony-service-locator.gotoServiceDefinitionSelection', function () {

		if (vscode.window.activeTextEditor.selection.isEmpty) {
			vscode.window.showInformationMessage("No text selected for search");
			return;
		}

		let selectedText = vscode.window.activeTextEditor.document.getText(
			vscode.window.activeTextEditor.selection.with()
		);

		if (0 == selectedText.length) {
			vscode.window.showInformationMessage("No text selected for search");
			return;
		}

		let state = { isFound: false };
		const searchRegEx = constructSelectionRegExp(selectedText);
		searchConfigs(selectedText, state, searchRegEx);
	});

	context.subscriptions.push(curClassDisposable, selectionDisposable);
}

function constructRegExp(serviceName)
{
	serviceName = serviceName.replace(/\\/g, '\\\\');
	let confOptions = [];
	confOptions.push('^\\s+' + serviceName + ':');
	confOptions.push('^\\s+class:\\s*' + serviceName + '\\s*$');
	confOptions.push('<service[^>]*"'+ serviceName +'"');

	return new RegExp(confOptions.join('|'), 'm');
}

function constructSelectionRegExp(serviceId)
{
	serviceId = serviceId.replace(/\\/g, '\\\\');
	let confOptions = [];
	confOptions.push('^\\s+' + serviceId + ':\\s*$');
	confOptions.push('<service[^>]*id="'+ serviceId +'"');

	return new RegExp(confOptions.join('|'), 'm');
}

function searchConfigs(serviceName, state, searchRegEx)
{
	getClosestConfigs().then((configs) => {
		for (const num in configs) {
			vscode.workspace.fs.readFile(configs[num]).then((configContent) => {
				let servicePos = configContent.toString().search(searchRegEx);

				if (servicePos != -1) {
					goToConfigFile(configs[num].fsPath, servicePos, serviceName.length);
					state.isFound = true;
				}

				if (!state.isFound && num == configs.length - 1) {
					informNoServiceFound(serviceName);
				}
			});
		}
	});
}

function goToConfigFile(configPath, offset)
{
	vscode.window.showTextDocument(vscode.workspace.openTextDocument(configPath)).then(
		(editor) => {
			const docText = editor.document.getText();
			const lineStart = docText.substr(offset).search(/[^\n\s\t]/);
			const lineEnd = docText.substr(offset + 1).search(/\n+/);

			const foundRange = new vscode.Range(
			 	editor.document.positionAt(offset + lineStart),
			 	editor.document.positionAt(offset + lineEnd + 1)
			);

			let decoration = vscode.window.createTextEditorDecorationType(
				{ border: '1px solid DarkOrange;'}
			);

			editor.revealRange(foundRange);
			editor.setDecorations(decoration, [foundRange]);
		}
	);
}

function informNoServiceFound(serviceName)
{
	vscode.window.showInformationMessage("No service for class or with id " + serviceName + " found");
}

function getClosestConfigs()
{

	const filePath = vscode.workspace.workspaceFolders[0];
	let upperLevel = new vscode.RelativePattern(filePath, '**/Resources/**/*.{yaml,yml,xml}');

	return vscode.workspace.findFiles(upperLevel, '/vendor/', 300);
}

function getNamespace(currentDoc) {
	let namespacePos = currentDoc.indexOf('namespace');

	if (-1 == namespacePos) {
		return '';
	}

	let nextDelimPos = currentDoc.substr(namespacePos + 10).trim().search(";");

	if (-1 == nextDelimPos) {
		return '';
	}

	return currentDoc.substr(namespacePos + 10, nextDelimPos).trim();
}

function getClassName(currentDoc) {
	let classPos = currentDoc.indexOf('class');

	if (-1 == classPos) {
		return false;
	}

	let nextDelimPos = currentDoc.substr(classPos + 6).trim().search(/[^A-Za-z0-9_]/g);

	if (-1 == nextDelimPos) {
		return false;
	}

	let className = currentDoc.substr(classPos + 6, nextDelimPos);

	return className.trim();
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
