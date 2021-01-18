import * as fs from "fs";
import * as vscode from "vscode";
import * as glob from "glob";
import { AcornSyntaxAnalyzer } from "../UI5Classes/JSParser/AcornSyntaxAnalyzer";
import * as path from "path";
const fileSeparator = path.sep;
const escapedFileSeparator = "\\" + path.sep;

const workspace = vscode.workspace;

export class FileReader {
	private static _manifests: UIManifest[] = [];
	private static readonly _viewCache: LooseObject = {};
	private static readonly _UI5Version: any = vscode.workspace.getConfiguration("ui5.plugin").get("ui5version");
	public static globalStoragePath: string | undefined;

	public static setNewViewContentToCache(viewContent: string, fsPath: string) {
		const controllerName = this.getControllerNameFromView(viewContent);
		if (controllerName) {
			this._viewCache[controllerName] = {
				content: viewContent,
				fsPath: fsPath
			};
		}
	}

	static getViewCache() {
		return this._viewCache;
	}

	public static getDocumentTextFromCustomClassName(className: string, isFragment?: boolean) {
		let documentText;
		const classPath = this.getClassPathFromClassName(className, isFragment);
		if (classPath) {
			documentText = fs.readFileSync(classPath, "utf8");
		}

		return documentText;
	}

	public static getClassPathFromClassName(className: string, isFragment?: boolean) {
		let classPath = this.convertClassNameToFSPath(className, false, isFragment);

		if (classPath) {
			const fileExists = fs.existsSync(classPath);
			if (!fileExists) {
				classPath = this.convertClassNameToFSPath(className, true);
				if (classPath && !fs.existsSync(classPath)) {
					classPath = undefined;
				}
			}
		}

		return classPath;
	}

	public static convertClassNameToFSPath(className: string, isController = false, isFragment = false, isView = false) {
		let FSPath;
		let extension = ".js";
		const manifest = this.getManifestForClass(className);
		if (manifest) {
			if (isController) {
				extension = ".controller.js";
			} else if (isFragment) {
				extension = ".fragment.xml";
			} else if (isView) {
				extension = ".view.xml";
			}

			const separator = path.sep;
			FSPath = `${manifest.fsPath}${className.replace(manifest.componentName, "").replace(/\./g, separator).trim()}${extension}`;
		}

		return FSPath;
	}

	public static getAllManifests() {
		if (this._manifests.length === 0) {
			this._fetchAllWorkspaceManifests();
		}

		return this._manifests;
	}

	public static rereadAllManifests() {
		this._manifests = [];
		this._fetchAllWorkspaceManifests();
	}

	public static getManifestForClass(className = "") {
		if (this._manifests.length === 0) {
			this._fetchAllWorkspaceManifests();
		}

		const returnManifest = this._manifests.find(UIManifest => className.startsWith(UIManifest.componentName + "."));

		return returnManifest;
	}

	private static _fetchAllWorkspaceManifests() {
		const wsFolders = workspace.workspaceFolders || [];
		for (const wsFolder of wsFolders) {
			const manifests = this.getManifestsInWorkspaceFolder(wsFolder);
			for (const manifest of manifests) {
				try {
					const UI5Manifest: any = JSON.parse(fs.readFileSync(manifest.fsPath, "utf8"));
					const manifestFsPath: string = manifest.fsPath.replace(`${fileSeparator}manifest.json`, "");
					const UIManifest = {
						componentName: UI5Manifest["sap.app"].id,
						fsPath: manifestFsPath,
						content: UI5Manifest
					};
					this._manifests.push(UIManifest);
				} catch (error) {
					vscode.window.showErrorMessage(`Couldn't read manifest.json. Error message: ${error?.message || ""}`);
					throw error;
				}
			}
		}
	}

	public static getManifestsInWorkspaceFolder(wsFolder: vscode.WorkspaceFolder) {
		const src = this.getSrcFolderName();
		const wsFolderFSPath = wsFolder.uri.fsPath.replace(new RegExp(`${escapedFileSeparator}`, "g"), "/");
		const manifestPaths = glob.sync(`${wsFolderFSPath}/${src}/manifest.json`);
		const manifests: manifestPaths[] = manifestPaths.map(manifestPath => {
			return {
				fsPath: manifestPath.replace(/\//g, fileSeparator)
			};
		});
		return manifests;
	}


	public static getClassNameFromView(controllerClassName: string, controlId: string) {
		let className: string | undefined;
		const documentText = this.getViewText(controllerClassName);
		if (documentText) {
			className = this._getClassOfControlIdFromView(documentText, controlId);
		}

		return className;
	}

	public static getViewText(controllerName: string) {
		if (!this._viewCache[controllerName]) {
			this._readAllViewsAndSaveInCache();
		}

		const viewText = this._viewCache[controllerName]?.content;

		return viewText;
	}

	private static _getClassOfControlIdFromView(documentText: string, controlId: string) {
		let controlClass = "";
		//TODO: move to XMLParser
		const controlResults = new RegExp(`(?=id="${controlId}")`).exec(documentText);
		if (controlResults) {
			let beginIndex = controlResults.index;
			while (beginIndex > 0 && documentText[beginIndex] !== "<") {
				beginIndex--;
			}
			beginIndex++;

			let endIndex = beginIndex;
			while (endIndex < documentText.length && !this._isSeparator(documentText[endIndex])) {
				endIndex++;
			}

			let regExpBase;
			const classTag = documentText.substring(beginIndex, endIndex);
			const classTagParts = classTag.split(":");
			let className;
			if (classTagParts.length === 1) {
				regExpBase = `(?<=xmlns=").*?(?=")`;
				className = classTagParts[0];
			} else {
				regExpBase = `(?<=xmlns(:${classTagParts[0]})=").*?(?=")`;
				className = classTagParts[1];
			}
			const rClassName = new RegExp(regExpBase);
			const classNameResult = rClassName.exec(documentText);
			if (classNameResult) {
				controlClass = [classNameResult[0], className.trim()].join(".");
			}
		}
		return controlClass;
	}

	private static _readAllViewsAndSaveInCache() {
		const wsFolders = workspace.workspaceFolders || [];
		const src = this.getSrcFolderName();
		for (const wsFolder of wsFolders) {
			const wsFolderFSPath = wsFolder.uri.fsPath.replace(new RegExp(`${escapedFileSeparator}`, "g"), "/");
			const viewPaths = glob.sync(`${wsFolderFSPath}/${src}/**/*/*.view.xml`);
			viewPaths.forEach(viewPath => {
				let viewContent = fs.readFileSync(viewPath, "utf8");
				viewContent = this.replaceFragments(viewContent);
				const controllerName = this.getControllerNameFromView(viewContent);
				if (controllerName) {
					this._viewCache[controllerName] = {
						content: viewContent,
						fsPath: viewPath.replace(/\//g, fileSeparator)
					};
				}
			});
		}
	}

	public static getAllJSClassNamesFromProject(wsFolder: vscode.WorkspaceFolder) {
		let classNames: string[] = [];
		const src = this.getSrcFolderName();
		const wsFolderFSPath = wsFolder.uri.fsPath.replace(new RegExp(`${escapedFileSeparator}`, "g"), "/");
		const viewPaths = glob.sync(`${wsFolderFSPath}/${src}/**/*/*.js`);
		classNames = viewPaths.reduce((accumulator: string[], viewPath) => {
			const path = this.getClassNameFromPath(viewPath);
			if (path) {
				accumulator.push(path);
			}

			return accumulator;
		}, []);

		return classNames;
	}

	static getControllerNameFromView(viewContent: string) {
		const controllerNameResult = /(?<=controllerName=").*?(?=")/.exec(viewContent);

		return controllerNameResult ? controllerNameResult[0] : undefined;
	}

	public static replaceFragments(documentText: string) {
		const fragments = this._getFragments(documentText);
		fragments.forEach(fragment => {
			const fragmentName = this._getFragmentName(fragment);
			if (fragmentName) {
				const fragmentText = this.getDocumentTextFromCustomClassName(fragmentName, true);
				if (fragmentText) {
					documentText = documentText.replace(fragment, fragmentText);
				}
			}
		});

		return documentText;
	}

	private static _getFragmentName(fragmentText: string) {
		let fragmentName;
		const fragmentNameResult = /(?<=fragmentName=").*?(?=")/.exec(fragmentText);
		if (fragmentNameResult) {
			fragmentName = fragmentNameResult[0];
		}
		return fragmentName;
	}

	private static _getFragments(documentText: string) {
		return documentText.match(/<.*?Fragment(.|\s)*?\/>/g) || [];
	}

	private static _isSeparator(char: string) {
		return char === " " || char === "	" || char === ";" || char === "\n" || char === "\t" || char === "\r";
	}

	public static getClassNameFromPath(fsPath: string) {
		fsPath = fsPath.replace(/\//g, fileSeparator);
		let className: string | undefined;
		const manifests = this.getAllManifests();
		const currentManifest = manifests.find(manifest => fsPath.indexOf(manifest.fsPath) > -1);
		if (currentManifest) {
			className =
				fsPath
					.replace(currentManifest.fsPath, currentManifest.componentName)
					.replace(".controller", "")
					.replace(".view.xml", "")
					.replace("fragment.xml", "")
					.replace(".xml", "")
					.replace(".js", "")
					.replace(new RegExp(`${escapedFileSeparator}`, "g"), ".");
		}

		return className;
	}

	static getCache(cacheType: FileReader.CacheType) {
		let cache;
		const cachePath =
			cacheType === FileReader.CacheType.Metadata ? this._getMetadataCachePath() :
				cacheType === FileReader.CacheType.APIIndex ? this._getAPIIndexCachePath() :
					cacheType === FileReader.CacheType.Icons ? this._getIconCachePath() :
						null;

		if (cachePath && fs.existsSync(cachePath)) {
			const fileText = fs.readFileSync(cachePath, "utf8");
			try {
				cache = JSON.parse(fileText);
			} catch (error) {
				console.log(error);
			}
		}

		return cache;
	}

	static setCache(cacheType: FileReader.CacheType, cache: string) {
		const cachePath =
			cacheType === FileReader.CacheType.Metadata ? this._getMetadataCachePath() :
				cacheType === FileReader.CacheType.APIIndex ? this._getAPIIndexCachePath() :
					cacheType === FileReader.CacheType.Icons ? this._getIconCachePath() :
						null;

		if (cachePath) {
			if (!fs.existsSync(cachePath)) {
				this._ensureThatPluginCacheFolderExists();
			}

			fs.writeFileSync(cachePath, cache, "utf8");
		}
	}

	static clearCache() {
		if (this.globalStoragePath) {
			if (fs.existsSync(this.globalStoragePath)) {
				const directory = this.globalStoragePath;
				fs.readdir(directory, (err, files) => {
					for (const file of files) {
						fs.unlinkSync(path.join(directory, file));
					}
				});
			}
		}
	}

	private static _ensureThatPluginCacheFolderExists() {
		if (this.globalStoragePath) {
			if (!fs.existsSync(this.globalStoragePath)) {
				fs.mkdirSync(this.globalStoragePath);
			}
		}
	}

	private static _getMetadataCachePath() {
		return `${this.globalStoragePath}${fileSeparator}cache_${this._UI5Version}.json`;
	}

	private static _getAPIIndexCachePath() {
		return `${this.globalStoragePath}${fileSeparator}cache_appindex_${this._UI5Version}.json`;
	}

	private static _getIconCachePath() {
		return `${this.globalStoragePath}${fileSeparator}cache_icons_${this._UI5Version}.json`;
	}

	public static getResourceModelFiles() {
		const manifests = this.getAllManifests();
		return manifests.map(manifest => {
			return {
				content: this.readResourceModelFile(manifest),
				componentName: manifest.componentName
			};
		});
	}

	public static readResourceModelFile(manifest: UIManifest) {
		let resourceModelFileContent = "";
		const resourceModelFilePath = this.getResourceModelUriForManifest(manifest);
		try {
			resourceModelFileContent = fs.readFileSync(resourceModelFilePath, "utf8");
		} catch {
			resourceModelFileContent = "";
		}

		return resourceModelFileContent;
	}

	public static getResourceModelUriForManifest(manifest: UIManifest) {
		const i18nRelativePath = manifest.content["sap.app"].i18n || `i18n${fileSeparator}i18n.properties`;
		const i18nPath = i18nRelativePath.replace(/\//g, fileSeparator);
		return `${manifest.fsPath}${fileSeparator}${i18nPath}`;
	}

	public static getComponentNameOfAppInCurrentWorkspaceFolder() {
		return this.getCurrentWorkspaceFoldersManifest()?.componentName;
	}

	public static getCurrentWorkspaceFoldersManifest() {
		const currentClassName = AcornSyntaxAnalyzer.getClassNameOfTheCurrentDocument();
		if (currentClassName) {
			return this.getManifestForClass(currentClassName);
		}
	}

	public static getSrcFolderName() {
		const wsFolders = workspace.workspaceFolders || [];
		let src = vscode.workspace.getConfiguration("ui5.plugin").get("src");
		for (const wsFolder of wsFolders) {
			const srcPath = `${wsFolder.uri.fsPath}${fileSeparator}${src}`;
			if (!fs.existsSync(srcPath)) {
				const webappPath = `${wsFolder.uri.fsPath}${fileSeparator}webapp`;
				if (fs.existsSync(webappPath)) {
					src = "webapp";
				}
			}
		}

		return src;
	}
}

export namespace FileReader {
	export enum CacheType {
		Metadata = "1",
		APIIndex = "2",
		Icons = "3"
	}
}

interface UIManifest {
	fsPath: string;
	componentName: string;
	content: any;
}

interface manifestPaths {
	fsPath: string;
}

interface LooseObject {
	[key: string]: {
		fsPath: string;
		content: string;
	};
}
