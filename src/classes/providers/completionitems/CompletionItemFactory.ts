import { SAPNodeDAO } from "../../librarydata/SAPNodeDAO";
import * as vscode from "vscode";
import { UI5MetadataPreloader } from "../../librarydata/UI5MetadataDAO";
import { SAPIcons } from "../../UI5Classes/SAPIcons";
import { ResourceModelData } from "../../UI5Classes/ResourceModelData";
import { SAPUIDefineFactory } from "./js/sapuidefine/SAPUIDefineFactory";
import { ViewIdCompletionItemFactory } from "./js/ViewIdCompletionItemFactory";
import { JSDynamicCompletionItemsFactory } from "./js/JSDynamicCompletionItemsFactory";
import { AcornSyntaxAnalyzer } from "../../UI5Classes/JSParser/AcornSyntaxAnalyzer";
import { UIClassFactory } from "../../UI5Classes/UIClassFactory";
import { CustomUIClass } from "../../UI5Classes/UI5Parser/UIClass/CustomUIClass";
import { CustomCompletionItem } from "./CustomCompletionItem";
import { GeneratorFactory } from "./codegenerators/GeneratorFactory";

export class CompletionItemFactory {
	private static readonly _nodeDAO = new SAPNodeDAO();
	public static JSDefineCompletionItems: CustomCompletionItem[] = [];
	private readonly _language: GeneratorFactory.language;

	constructor(completionItemType: GeneratorFactory.language) {
		this._language = completionItemType;
	}

	public async createUIDefineCompletionItems(document?: vscode.TextDocument) {
		let completionItems: CustomCompletionItem[] = [];

		if (this._language === GeneratorFactory.language.js) {
			completionItems = await this._createJSCompletionItems(document);
		}

		return completionItems;
	}

	private async _createJSCompletionItems(document?: vscode.TextDocument) {
		let completionItems: CustomCompletionItem[] = [];

		if (CompletionItemFactory.JSDefineCompletionItems.length === 0) {
			const UIDefineFactoy = new SAPUIDefineFactory();
			completionItems = await UIDefineFactoy.generateUIDefineCompletionItems();
			CompletionItemFactory.JSDefineCompletionItems = completionItems;
		} else {
			completionItems = CompletionItemFactory.JSDefineCompletionItems;

			if (document) {
				UIClassFactory.setNewContentForCurrentUIClass(document);
			}
			const currentClassName = AcornSyntaxAnalyzer.getClassNameOfTheCurrentDocument();
			if (currentClassName) {
				const UIClass = <CustomUIClass>UIClassFactory.getUIClass(currentClassName);
				const activeTextEditor = vscode.window.activeTextEditor;
				const position = activeTextEditor?.document.offsetAt(activeTextEditor.selection.start);
				if (position) {

					if (UIClass.fileContent) {
						const args = UIClass.fileContent?.body[0]?.expression?.arguments;
						if (args && args.length === 2) {
							const UIDefinePaths: string[] = args[0].elements || [];
							const node = AcornSyntaxAnalyzer.findAcornNode(UIDefinePaths, position);
							const isString = node?.type === "Literal";
							if (isString) {
								completionItems = completionItems.map(completionItem => {
									const completionItemWOQuotes = new CustomCompletionItem(completionItem.label);
									completionItemWOQuotes.kind = completionItem.kind;
									completionItemWOQuotes.className = completionItem.className;
									completionItemWOQuotes.insertText = (<any>completionItem.insertText).substring(1, (<any>completionItem.insertText).length - 1);
									completionItemWOQuotes.documentation = completionItem.documentation;
									completionItemWOQuotes.command = completionItem.command;

									return completionItemWOQuotes;
								});
							}
						}
					}
				}
			}
		}

		return completionItems;
	}

	public createViewIdCompletionItems() {
		const idCompletionItems = new ViewIdCompletionItemFactory();

		return idCompletionItems.createIdCompletionItems();
	}

	public createPropertyMethodCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		const jsDynamicFactory = new JSDynamicCompletionItemsFactory();
		UIClassFactory.setNewContentForCurrentUIClass(document);

		const completionItems = jsDynamicFactory.createUIClassCompletionItems(document, position);
		return completionItems;
	}
}