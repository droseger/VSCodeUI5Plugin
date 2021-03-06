import * as vscode from "vscode";
import { FileReader } from "./FileReader";
import { AcornSyntaxAnalyzer } from "../UI5Classes/JSParser/AcornSyntaxAnalyzer";
import * as glob from "glob";
import * as fs from "fs";
import { UIClassFactory } from "../UI5Classes/UIClassFactory";
import { ResourceModelData } from "../UI5Classes/ResourceModelData";
import { ClearCacheCommand } from "../vscommands/ClearCacheCommand";
import { UI5Plugin } from "../../UI5Plugin";
import * as path from "path";
import { TemplateGeneratorFactory } from "../templateinserters/TemplateGeneratorFactory";
import { FileRenameMediator } from "../filerenaming/FileRenameMediator";
import { CustomCompletionItem } from "../providers/completionitems/CustomCompletionItem";
import { DiagnosticsRegistrator } from "../registrators/DiagnosticsRegistrator";
import { WorkspaceCompletionItemFactory } from "../providers/completionitems/js/sapuidefine/WorkspaceCompletionItemFactory";
const fileSeparator = path.sep;
const workspace = vscode.workspace;

export class FileWatcherMediator {
	static register() {
		let disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
			ClearCacheCommand.reloadWindow();
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		disposable = workspace.onDidSaveTextDocument(document => {
			if (document.fileName.endsWith(".js")) {

				const currentClassNameDotNotation = AcornSyntaxAnalyzer.getClassNameOfTheCurrentDocument(document.uri.fsPath);
				if (currentClassNameDotNotation) {
					UIClassFactory.setNewCodeForClass(currentClassNameDotNotation, document.getText());
				}
			} else if (document.fileName.endsWith(".view.xml")) {

				const viewContent = document.getText();
				FileReader.setNewViewContentToCache(viewContent, document.uri.fsPath);
			} else if (document.fileName.endsWith(".fragment.xml")) {

				FileReader.setNewFragmentContentToCache(document);
			} else if (document.fileName.endsWith(".properties")) {

				ResourceModelData.readTexts();
			} else if (document.fileName.endsWith("manifest.json")) {

				FileReader.rereadAllManifests();
			}
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		disposable = workspace.onDidCreateFiles(event => {
			event.files.forEach(this._handleFileCreate.bind(this));
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		disposable = workspace.onDidRenameFiles(event => {
			event.files.forEach(file => {
				if (file.newUri.fsPath.indexOf(".") === -1) {
					this._handleFolderRename(file.oldUri, file.newUri);
				} else {
					this._handleFileRename(file);
				}
			});
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		//sync diagnostics with deleted/renamed files
		disposable = vscode.workspace.onDidDeleteFiles(event => {
			event.files.forEach(file => {
				if (file.fsPath.endsWith(".js")) {
					DiagnosticsRegistrator.removeDiagnosticForUri(file, "js");
				}
				if (file.fsPath.endsWith(".xml")) {
					DiagnosticsRegistrator.removeDiagnosticForUri(file, "xml");
				}
			});
		});

		UI5Plugin.getInstance().addDisposable(disposable);
	}

	private static _handleFileRename(file: {
		oldUri: vscode.Uri;
		newUri: vscode.Uri;
	}) {
		FileRenameMediator.handleFileRename(file);
	}

	//TODO: Move to js completion items
	public static synchronizeSAPUIDefineCompletionItems(completionItems: CustomCompletionItem[]) {
		let disposable = workspace.onDidCreateFiles(event => {
			event.files.forEach(file => {
				if (file.fsPath.endsWith(".js")) {
					WorkspaceCompletionItemFactory.synchronizeCreate(completionItems, file);
				}
			});
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		disposable = workspace.onDidDeleteFiles(event => {
			event.files.forEach(file => {
				if (file.fsPath.endsWith(".js")) {
					WorkspaceCompletionItemFactory.synchronizeDelete(completionItems, file);
				}
			});
		});

		UI5Plugin.getInstance().addDisposable(disposable);

		disposable = workspace.onDidRenameFiles(event => {
			event.files.forEach(file => {
				if (file.newUri.fsPath.endsWith(".js")) {
					WorkspaceCompletionItemFactory.synchronizeCreate(completionItems, file.newUri);
					WorkspaceCompletionItemFactory.synchronizeDelete(completionItems, file.oldUri);
				}
			});
		});

		UI5Plugin.getInstance().addDisposable(disposable);
	}

	private static _handleFileCreate(uri: vscode.Uri) {
		const changedFileText = fs.readFileSync(uri.fsPath, "utf8");

		const thisFileIsEmpty = changedFileText.length === 0;

		if (thisFileIsEmpty) {
			this._insertCodeTemplate(uri);
		}
	}

	private static _insertCodeTemplate(uri: vscode.Uri) {
		const templateInserter = TemplateGeneratorFactory.createInstance(uri.fsPath);
		const textToInsert = templateInserter?.generateTemplate(uri);
		if (textToInsert) {
			fs.writeFileSync(uri.fsPath, textToInsert);
		}
	}

	private static _handleFolderRename(oldUri: vscode.Uri, newUri: vscode.Uri) {
		const newFilePaths = glob.sync(newUri.fsPath.replace(/\//g, fileSeparator) + "/**/*{.js,.xml}");
		newFilePaths.forEach(filePath => {
			const newFileUri = vscode.Uri.file(filePath);
			const oldFileUri = vscode.Uri.file(
				filePath
					.replace(/\//g, fileSeparator)
					.replace(
						newUri.fsPath.replace(/\//g, fileSeparator),
						oldUri.fsPath.replace(/\//g, fileSeparator)
					)
			);

			this._handleFileRename({
				newUri: newFileUri,
				oldUri: oldFileUri
			});
		});
	}
}