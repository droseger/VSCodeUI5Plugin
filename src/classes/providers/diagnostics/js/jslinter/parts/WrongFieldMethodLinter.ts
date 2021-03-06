import { Error, Linter } from "./abstraction/Linter";
import * as vscode from "vscode";
import LineColumn = require("line-column");
import { CustomDiagnosticType } from "../../../../../registrators/DiagnosticsRegistrator";
import { AcornSyntaxAnalyzer } from "../../../../../UI5Classes/JSParser/AcornSyntaxAnalyzer";
import { FieldsAndMethodForPositionBeforeCurrentStrategy } from "../../../../../UI5Classes/JSParser/strategies/FieldsAndMethodForPositionBeforeCurrentStrategy";
import { CustomUIClass } from "../../../../../UI5Classes/UI5Parser/UIClass/CustomUIClass";
import { UIClassFactory } from "../../../../../UI5Classes/UIClassFactory";
import { FileReader } from "../../../../../utils/FileReader";
import { ConfigHandler } from "./config/ConfigHandler";
export class WrongFieldMethodLinter extends Linter {
	public static timePerChar = 0;
	getErrors(document: vscode.TextDocument): Error[] {
		let errors: Error[] = [];

		if (vscode.workspace.getConfiguration("ui5.plugin").get("useWrongFieldMethodLinter")) {
			// console.time("WrongFieldMethodLinter");
			const start = new Date().getTime();
			errors = this._getLintingErrors(document);
			const end = new Date().getTime();
			WrongFieldMethodLinter.timePerChar = (end - start) / document.getText().length;
			// console.timeEnd("WrongFieldMethodLinter");
		}

		return errors;
	}

	private _getLintingErrors(document: vscode.TextDocument): Error[] {
		let errors: Error[] = [];

		const currentClassName = FileReader.getClassNameFromPath(document.fileName);
		if (currentClassName) {
			const UIClass = <CustomUIClass>UIClassFactory.getUIClass(currentClassName);
			const acornMethods = UIClass.acornMethodsAndFields.filter(fieldOrMethod => fieldOrMethod.value.type === "FunctionExpression").map((node: any) => node.value.body);

			acornMethods.forEach((method: any) => {
				if (method.body) {
					method.body.forEach((node: any) => {
						const validationErrors = this._getErrorsForExpression(node, UIClass);
						errors = errors.concat(validationErrors);
					});
				}
			});

		}

		return errors;
	}

	private _getErrorsForExpression(node: any, UIClass: CustomUIClass, errors: Error[] = [], droppedNodes: any[] = [], errorNodes: any[] = []) {
		if (droppedNodes.includes(node)) {
			return [];
		}

		const currentClassName = UIClass.className;

		if (node.type === "MemberExpression") {
			const strategy = new FieldsAndMethodForPositionBeforeCurrentStrategy();
			const nodeStack = strategy.getStackOfNodesForPosition(currentClassName, node.end);
			if (nodeStack.length > 0) {
				const nodes = [];
				while (nodeStack.length > 0) {
					let nextNode = nodeStack.shift();
					nodes.push(nextNode);
					nextNode = nodeStack[0];
					if (nextNode?.type === "CallExpression") {
						nextNode = nodeStack.shift();
						nodes.push(nextNode);
					}
					let className = AcornSyntaxAnalyzer.findClassNameForStack(nodes.concat([]), currentClassName, currentClassName, true);
					const isException = this._checkIfClassNameIsException(className);
					if (!className || isException || nextNode?.type === "Identifier" && nextNode?.name === "sap") {
						droppedNodes.push(...nodeStack);
						break;
					}

					const classNames = className.split("|");
					nextNode = nodeStack[0];
					if (!nextNode) {
						nextNode = node;
					}
					const nextNodeName = nextNode.property?.name;
					const nodeText = UIClass.classText.substring(nextNode.start, nextNode.end);
					if (!nodeText.endsWith("]") && !errorNodes.includes(nextNode)) {
						const isMethodException = ConfigHandler.checkIfMethodNameIsException(className, nextNodeName);

						if (nextNodeName && !isMethodException) {
							const fieldsAndMethods = classNames.map(className => strategy.destructueFieldsAndMethodsAccordingToMapParams(className));
							const singleFieldsAndMethods = fieldsAndMethods.find(fieldsAndMethods => {
								if (nextNode && fieldsAndMethods) {
									if (nextNodeName) {
										const method = fieldsAndMethods.methods.find(method => method.name === nextNodeName);
										const field = fieldsAndMethods.fields.find(field => field.name === nextNodeName);

										return method || field;
									}
								}

								return false;
							});

							if (!singleFieldsAndMethods) {
								if (className.includes("__map__")) {
									className = "map";
								}
								const isMethodException = ConfigHandler.checkIfMethodNameIsException(className, nextNodeName);
								if (!isMethodException) {
									const position = LineColumn(UIClass.classText).fromIndex(nextNode.property.start - 1);
									if (position) {
										errorNodes.push(nextNode);
										errors.push({
											message: `"${nextNodeName}" does not exist in "${className}"`,
											code: "UI5Plugin",
											source: "Field/Method Linter",
											range: new vscode.Range(
												new vscode.Position(position.line - 1, position.col),
												new vscode.Position(position.line - 1, position.col + nextNodeName.length)
											),
											acornNode: nextNode,
											type: CustomDiagnosticType.NonExistentMethod,
											methodName: nextNodeName,
											sourceClassName: className
										});
									}
									break;
								}
							}
						}
					} else if (nodeText.endsWith("]")) {
						droppedNodes.push(nextNode);
						if (nextNode.property) {
							droppedNodes.push(nextNode.property);
						}
						break;
					}
				}
			}
		}

		const innerNodes = AcornSyntaxAnalyzer.getContent(node);
		if (innerNodes) {
			innerNodes.forEach((node: any) => this._getErrorsForExpression(node, UIClass, errors, droppedNodes, errorNodes));
		}

		return errors;
	}

	private _checkIfClassNameIsException(className = "") {
		let isException = false;
		const exceptions = ["void", "any", "array"];
		if (className.split(".").length === 1) {
			isException = true;
		} else if (exceptions.includes(className)) {
			isException = true;
		}

		return isException;
	}
}