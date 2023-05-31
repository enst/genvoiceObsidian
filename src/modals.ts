import { SuggestModal, Editor, TFile } from 'obsidian';
import { updateLastEditDate } from './assets';
import { TextPluginSettings } from './settings';
// mentionModal 

/*****************************************************************************************************************
export class MentionModal extends Modal {

	editor: Editor;
	settings: TextPluginSettings;
	lineNum: number;

	constructor(lineNum: number, settings: TextPluginSettings) {
		super(app);
		this.editor = this.app.workspace.activeEditor!.editor!;
		this.settings = settings;
		this.lineNum = lineNum;
	}

	onOpen() {
		
		const mentionText = this.contentEl.createEl('h2', { text: `You have a new mention in line ${this.lineNum}`});
		const mentionResolveButton = new ButtonComponent(this.contentEl)
			.setButtonText('Resolved')
			.onClick(() => {
				this.editor
			}
		/*
		onOpen() {
			const notifyText = this.contentEl.createEl('h1', { text: 'Notify user?'});
			const notifyButton = new ButtonComponent(this.contentEl)
				.setButtonText('Yes')
				.onClick(() => {
					new Notice(this.name + ' will be notified');
					this.editor.replaceRange(
						this.settings.noticeSymb,
						{ line: this.editor.getCursor().line, ch: this.editor.getCursor().ch - this.name.length }
					)
					this.close();
				})
			}
			
	}
}


// ask to notify modal

export class NotifyModal extends Modal {

	editor: Editor;
	settings: TextPluginSettings;
	name: string;

	constructor(name: string, settings: TextPluginSettings) {
		super(app);
		this.editor = this.app.workspace.activeEditor!.editor!;
		this.settings = settings;
		this.name = name;
	}

	onOpen() {
		const notifyText = this.contentEl.createEl('h1', { text: 'Notify user?'});
		const notifyButton = new ButtonComponent(this.contentEl)
			.setButtonText('Yes')
			.onClick(() => {
				new Notice(this.name + ' will be notified');
				this.editor.replaceRange(
					this.settings.noticeSymb,
					{ line: this.editor.getCursor().line, ch: this.editor.getCursor().ch - this.name.length }
				)
				this.close();
			})
		}
}

***************************************************************************************************/

// suggestion modal

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
	async onChooseSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent) {
		let content: string = await this.app.vault.read(item);
		this.editor.replaceRange(content, { line: 0, ch: 0});
	}
}

export class PeopleSuggestionModal extends SuggestModal<string> {

	private editor: Editor;
	private settings: TextPluginSettings;
	private suggestionList: string[];
	private caseID: number;

	constructor(editor: Editor, settings: TextPluginSettings, suggestionList: string[], caseID: number) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.suggestionList = suggestionList;
		this.caseID = caseID;
	}

	getSuggestions(query: string): string[] {
		return this.suggestionList.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
	}
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}
	onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		switch (this.caseID) {
			case 0:
				let cursorPos = this.editor.getCursor();
				this.editor.setCursor({ line: this.editor.getCursor().line - 1, ch: 0 });
				this.editor.replaceRange(item, cursorPos);
				break;
			case 1:
				this.editor.replaceRange(
					this.settings.tagSymb + item,
					{ line: this.editor.getCursor().line, ch: this.editor.getCursor().ch - 1 },
					this.editor.getCursor()
				)
				break;
			case 2:
				this.editor.replaceRange(item, this.editor.getCursor());
				break;
		}
		updateLastEditDate(this.editor, this.settings);
	}
}
