import * as vscode from "vscode";
import { CompletionItemFactory } from "../providers/completionitems/CompletionItemFactory";
import { FileWatcherMediator } from "../utils/FileWatcherMediator";
import { UI5Plugin } from "../../UI5Plugin";
import { CustomCompletionItem } from "../providers/completionitems/CustomCompletionItem";
import { UIDefineCompletionItemGenerator } from "../providers/completionitems/codegenerators/define/UIDefineCompletionItemGenerator";
import { GeneratorFactory } from "../providers/completionitems/codegenerators/GeneratorFactory";

export class CompletionItemRegistrator {
	static async register() {
		/* Completion Items */

		const JSCompletionItemFactory = new CompletionItemFactory(GeneratorFactory.language.js);
		await JSCompletionItemFactory.createUIDefineCompletionItems();
		console.log("JS Completion Items generated");

		const JSMethodPropertyProvider = vscode.languages.registerCompletionItemProvider({ language: "javascript", scheme: "file" }, {
			async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				let itemsToReturn: CustomCompletionItem[] = [];
				try {
					if (UIDefineCompletionItemGenerator.getIfCurrentPositionIsInDefine()) {
						itemsToReturn = await JSCompletionItemFactory.createUIDefineCompletionItems(document);
					} else {
						itemsToReturn = JSCompletionItemFactory.createPropertyMethodCompletionItems(document, position);
					}

				} catch (error) {
					console.log(error);
				}
				return itemsToReturn;
			}
		}, ".", "\"", "'");

		const JSViewIDProvider = vscode.languages.registerCompletionItemProvider({ language: "javascript", scheme: "file" }, {
			provideCompletionItems() {
				return JSCompletionItemFactory.createViewIdCompletionItems();
			}
		}, "\"", "'");

		let i = 65;
		const aChars: string[] = [];
		for (i = 65; i <= 122; i++) {
			aChars.push(String.fromCharCode(i));
		}

		UI5Plugin.getInstance().addDisposable(JSMethodPropertyProvider);
		UI5Plugin.getInstance().addDisposable(JSViewIDProvider);

		FileWatcherMediator.synchronizeSAPUIDefineCompletionItems(CompletionItemFactory.JSDefineCompletionItems);
	}
}