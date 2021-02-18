import { IPropertyGenerator } from "./property/interfaces/IPropertyGenerator";
import { XMLPropertyGenerator } from "./property/XMLPropertyGenerator";
import { XMLAggregationGenerator } from "./aggregation/XMLAggregationGenerator";
import { IAggregationGenerator } from "./aggregation/interfaces/IAggregationGenerator";
import { UIDefineCompletionItemGenerator } from "./define/UIDefineCompletionItemGenerator";

export class GeneratorFactory {
	private static readonly _generatorMap = {
		aggregation: {
			"js": XMLAggregationGenerator //TODO: add js aggregation generator
		},
		property: {
			"js": XMLPropertyGenerator //TODO: add js property generator
		},
		define: {
			"js": UIDefineCompletionItemGenerator
		}
	};

	static getPropertyGenerator(language: GeneratorFactory.language) {
		const propertyGenerator: IPropertyGenerator = new GeneratorFactory._generatorMap[GeneratorFactory.type.property][language];

		return propertyGenerator;
	}

	static getAggregationGenerator(language: GeneratorFactory.language) {
		const aggregationGenerator: IAggregationGenerator = new GeneratorFactory._generatorMap[GeneratorFactory.type.aggregation][language];

		return aggregationGenerator;
	}

	static getDefineGenerator() {
		return new GeneratorFactory._generatorMap[GeneratorFactory.type.define][GeneratorFactory.language.js];
	}
}

export namespace GeneratorFactory {
	export enum language {
		js = "js"
	}
	export enum type {
		property = "property",
		aggregation = "aggregation",
		define = "define"
	}
}