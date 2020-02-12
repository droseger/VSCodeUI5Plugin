import * as vscode from "vscode";
import { FileReader } from "./classes/Util/FileReader";
import { CommandRegistrator } from "./classes/Util/registrators/CommandRegistrator";
import { CompletionItemRegistrator } from "./classes/Util/registrators/CompletionItemRegistrator";
import { DefinitionProviderRegistrator } from "./classes/Util/registrators/DefinitionProviderRegistrator";
import { FileWatcher } from "./classes/Util/FileWatcher";
import { SignatureHelpRegistrator } from "./classes/Util/registrators/SignatureHelpRegistrator";
import { DiagnosticsRegistrator } from "./classes/Util/registrators/DiagnosticsRegistrator";
import { XMLCodeLensProvider } from "./classes/Util/XMLCodeLensProvider";
import { XMLResourceModelCodeLensRegistrator } from "./classes/Util/registrators/XMLResourceModelCodeLensRegistrator";

export async function activate(context: vscode.ExtensionContext) {
	FileReader.globalStoragePath = context.globalStoragePath;
	const manifests = FileReader.getAllManifests();

	if (manifests.length > 0) {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: "Loading Libs",
			cancellable: false
		}, (progress) => {

			progress.report({ increment: 0 });

			return new Promise(async resolve => {
				try {
					CommandRegistrator.register(context, false);
					await CompletionItemRegistrator.register(context, progress);
					FileWatcher.register();
					CommandRegistrator.register(context, true);
					DefinitionProviderRegistrator.register(context);
					SignatureHelpRegistrator.register(context);
					DiagnosticsRegistrator.register(context);
					XMLResourceModelCodeLensRegistrator.register(context);

					resolve();
				} catch (error) {
					console.log(error);
				}
			});
		});
	}
}

// export function deactivate() {

// }