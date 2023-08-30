import { SuggestModal, Editor, TFile, EditorPosition, Modal, ButtonComponent, moment, Notice } from 'obsidian';
import { updateLastEditDate, initTemplatePpl, assignedToUpdate } from './assets';
import { TextPluginSettings } from './settings';

// template 选择弹出窗口

export class TemplateSuggestionModal extends SuggestModal<TFile> {

	private editor: Editor;
	private settings: TextPluginSettings;
	private suggestionList: TFile[];

	constructor(editor: Editor, settings: TextPluginSettings, suggestionList: TFile[]) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.suggestionList = suggestionList;
	}

	getSuggestions(query: string): TFile[] {
		return this.suggestionList.filter((item) => item.path.toLowerCase().includes(query.toLowerCase()));
	}
	renderSuggestion(item: TFile, el: HTMLElement) {
		el.createEl("div", { text: item.path.substring(this.settings.templateFolderPath.length, item.path.length - 3) })
	}

	// 选择时触发

	async onChooseSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent) {
		let content: string = await this.app.vault.read(item);
		this.editor.replaceRange(content, { line: 0, ch: 0 });
		setTimeout(async () => {
			let oldContent = this.editor.getValue();
			let newContent = oldContent.replace(new RegExp('{{date}}', 'gi'), moment().format(this.settings.dateFormat)); 
			await this.app.vault.modify(this.app.workspace.getActiveFile()!, newContent);
			initTemplatePpl(this.app, this.editor, this.settings);
		});
	}
}

// 文档 status 选择弹出窗口

export class StatusSuggestionModal extends SuggestModal<string> {
	private editor: Editor;
	private settings: TextPluginSettings;
	private suggestionList: string[]
	private lineNum: number;
	
	constructor(editor: Editor, settings: TextPluginSettings, suggestionList: string[], lineNum: number) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.suggestionList = suggestionList;
		this.lineNum = lineNum;
	}

	getSuggestions(query: string): string[] {
		return (this.suggestionList.filter((item) => item.toLowerCase().includes(query.toLowerCase()))).sort();
	}

	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}

	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.editor.replaceRange(
			'status: ' + item,
			{ line: this.lineNum, ch: 0 },
			{ line: this.lineNum, ch: this.editor.getLine(this.lineNum).length }
		)
		if (item == 'archived') {
			let path = this.app.workspace.getActiveFile()!.path;
			let dir: string[] = path.split('/');
			this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${dir[0]}/_Archived/${dir[dir.length - 1]}`);
		}
	}
}

// 人名选择弹出窗口

export class PeopleSuggestionModal extends SuggestModal<string> {

	private editor: Editor;
	private settings: TextPluginSettings;
	private suggestionList: string[];
	private insertLocation: EditorPosition;

	constructor(editor: Editor, settings: TextPluginSettings, suggestionList: string[], insertLocation: EditorPosition) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.suggestionList = suggestionList;
		this.insertLocation = insertLocation;
	}

	getSuggestions(query: string): string[] {
		return (this.suggestionList.filter((item) => item.toLowerCase().includes(query.toLowerCase()))).sort();
	}
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}
	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.editor.replaceRange(
			item,
			this.insertLocation
		)
		updateLastEditDate(this.editor, this.settings);
		setTimeout(() => {
			this.editor.setCursor({
				line: this.insertLocation.line,
				ch: this.insertLocation.ch + item.length
			}, 100);
		})
		if (this.editor.getLine(this.insertLocation.line).startsWith('assignedTo: ')) {
			assignedToUpdate(this.editor, this.settings, item);
		}
	}
}
