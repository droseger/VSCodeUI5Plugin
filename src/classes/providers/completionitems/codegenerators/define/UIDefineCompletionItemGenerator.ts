import * as vscode from "vscode";
import { AcornSyntaxAnalyzer } from "../../../../UI5Classes/JSParser/AcornSyntaxAnalyzer";
import { CustomUIClass } from "../../../../UI5Classes/UI5Parser/UIClass/CustomUIClass";
import { UIClassFactory } from "../../../../UI5Classes/UIClassFactory";
import { SAPNode } from "../../../../librarydata/SAPNode";

export class UIDefineCompletionItemGenerator {

	public generateDefineString(node: SAPNode) {
		let defineString = "";

		if (node.node.visibility === "public" && (node.getKind() === "class" || node.getKind() === "enum" || node.getKind() === "namespace")) {
			defineString = `"${node.getName().replace(/\./g, "/")}"`;
		}

		return defineString;
	}

	public static getIfCurrentPositionIsInDefine(tryToSetNewContentIfPositionIsNearUIDefine = true): boolean {
		let isCurrentPositionInUIDefine = false;
		const textEditor = vscode.window.activeTextEditor;
		const document = textEditor?.document;
		if (document && textEditor) {
			const currentPositionOffset = document?.offsetAt(textEditor.selection.start);
			const currentClass = AcornSyntaxAnalyzer.getClassNameOfTheCurrentDocument();
			const UIClass = currentClass && UIClassFactory.getUIClass(currentClass);
			if (UIClass instanceof CustomUIClass && currentPositionOffset) {
				const args = UIClass.fileContent?.body[0]?.expression?.arguments;
				if (args && args.length === 2) {
					const UIDefinePaths: any = args[0];

					isCurrentPositionInUIDefine = currentPositionOffset > UIDefinePaths.start && currentPositionOffset <= UIDefinePaths.end;

					if (tryToSetNewContentIfPositionIsNearUIDefine && !isCurrentPositionInUIDefine) {
						const isCurrentPositionNearEndOfTheUIDefine = currentPositionOffset > UIDefinePaths.start && Math.abs(currentPositionOffset - UIDefinePaths.end) < 10;
						if (isCurrentPositionNearEndOfTheUIDefine) {
							UIClassFactory.setNewCodeForClass(UIClass.className, document.getText());
							isCurrentPositionInUIDefine = this.getIfCurrentPositionIsInDefine(false);
						}
					}
				}
			}
		}

		return isCurrentPositionInUIDefine;
	}
}