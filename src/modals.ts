import { App, SuggestModal, TFile, moment, Notice } from 'obsidian';
import { TextPluginSettings } from './settings';
import { fillTemplate } from './logic';

// template 选择弹出窗口

export class TemplateSuggestionModal extends SuggestModal<TFile> {

	private settings: TextPluginSettings;
	private suggestionList: TFile[];
	// 新建的那篇笔记。模板只写进它，不管选的那一刻 “当前打开的是哪篇”：
	// 以前写进的是当前文件，弹窗开着时如果当前文件换了，那篇笔记的内容就被模板盖掉了。
	private target: TFile;
	private beforeInsert: () => void;

	constructor(app: App, settings: TextPluginSettings, suggestionList: TFile[], target: TFile, beforeInsert: () => void) {
		super(app);
		this.settings = settings;
		this.suggestionList = suggestionList;
		this.target = target;
		this.beforeInsert = beforeInsert;
	}

	getSuggestions(query: string): TFile[] {
		return this.suggestionList.filter((item) => item.path.toLowerCase().includes(query.toLowerCase()));
	}
	renderSuggestion(item: TFile, el: HTMLElement) {
		el.createEl("div", { text: item.path.substring(this.settings.templateFolderPath.length, item.path.length - 3) })
	}

	// 选择时触发

	async onChooseSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent) {
		if (!(this.app.vault.getAbstractFileByPath(this.target.path) instanceof TFile)) {
			new Notice('The new note no longer exists, template not inserted');
			return;
		}
		const template: string = await this.app.vault.read(item);
		const today = moment().format(this.settings.dateFormat);
		this.beforeInsert();
		// 模板放在最前面；弹窗开着时如果已经往新笔记里写了内容，留在模板后面
		await this.app.vault.process(this.target, (current) => fillTemplate(template + current, today, this.settings.username));
	}
}

// 人名选择弹出窗口

export class PeopleSuggestionModal extends SuggestModal<string> {

	private suggestionList: string[];
	private onChoose: (name: string) => void;

	constructor(app: App, suggestionList: string[], onChoose: (name: string) => void) {
		super(app);
		this.suggestionList = suggestionList;
		this.onChoose = onChoose;
		this.setPlaceholder("Who are you assigning this to?");
	}

	getSuggestions(query: string): string[] {
		return (this.suggestionList.filter((item) => item.toLowerCase().includes(query.toLowerCase()))).sort();
	}
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}
	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(item);
	}
}
