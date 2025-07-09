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

		let oldContent = this.editor.getValue();
		let newContent = oldContent.replace(new RegExp('{{date}}', 'gi'), moment().format(this.settings.dateFormat))
			.replace('people: ', `people:\n  - ${this.settings.username}`)
			.replace('createdBy: ', `createdBy: ${this.settings.username}`);
		await this.app.vault.modify(this.app.workspace.getActiveFile()!, newContent);
		
		return;
		// 正确读取 peopleFolderPath 下的人名
		const peopleFiles: TFile[] = this.app.vault.getMarkdownFiles().filter(
			file => file.path.startsWith(this.settings.peopleFolderPath)
		);
		const people: string[] = peopleFiles.map(file => file.basename);

		// 查找 assignedTo: 行
		const lines = this.editor.getValue().split('\n');
		let assignedToLine = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('assignedTo:')) {
				assignedToLine = i;
				break;
			}
		}
		if (assignedToLine >= 0) {
			const modal = new PeopleSuggestionModal(
				this.editor,
				this.settings,
				people, // 用 people 而不是模板文件名
				{ line: assignedToLine, ch: lines[assignedToLine].length }
			);
			modal.open();
		}
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

	async onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		this.editor.replaceRange(
			'status: ' + item,
			{ line: this.lineNum, ch: 0 },
			{ line: this.lineNum, ch: this.editor.getLine(this.lineNum).length }
		)
		if (item == 'archived') {
			let path = this.app.workspace.getActiveFile()!.path;
			let dir: string[] = path.split('/');
			if (!await this.app.vault.adapter.exists(`${dir[0]}/_Archived/${moment().format('YYYY')}`)) {
				await this.app.vault.createFolder(`${dir[0]}/_Archived/${moment().format('YYYY')}`)
			}
			this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${dir[0]}/_Archived/${moment().format('YYYY')}/${dir[dir.length - 1]}`);
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
		this.setPlaceholder("Who are you assigning this to?");
	}

	getSuggestions(query: string): string[] {
		return (this.suggestionList.filter((item) => item.toLowerCase().includes(query.toLowerCase()))).sort();
	}
	renderSuggestion(item: string, el: HTMLElement) {
		el.createEl("div", { text: item });
	}
	async onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
		/*this.editor.replaceRange(
			item,
			{line: this.insertLocation.line, ch: this.insertLocation.ch - 1},
			{line: this.insertLocation.line, ch: this.insertLocation.ch}
		)*/

		const oldContent = this.editor.getValue();
		const newContent = oldContent.replace('assignedTo: ', `assignedTo:\n  - ${item}`);
		await this.app.vault.modify(this.app.workspace.getActiveFile()!, newContent);

		/*const lineNum = this.insertLocation.line;
		const lineText = this.editor.getLine(lineNum);
		console.log('people lineText: ' + lineText);

		const file = this.app.workspace.getActiveFile();
		if (file) {
			const content = await app.vault.read(file);
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].startsWith('assignedTo:')) {
					// lines[i] = `assignedTo:  ${item};`
					lines.splice(i + 1, 0, `  - ${item}`);
					break;
				}
			}
			await app.vault.modify(file, lines.join('\n'));
		}*/
		// if (lineText.startsWith('assignedTo:')) {
		// 	console.log(item);
		// 	this.editor.replaceRange(
		// 		`assignedTo: ${item}`,
		// 		{ line: lineNum, ch: 0 },
		// 		{ line: lineNum, ch: lineText.length }
		// 	);
		// }
		// updateLastEditDate(this.editor, this.settings);
		// setTimeout(() => {
		// 	this.editor.setCursor({
		// 		line: this.insertLocation.line,
		// 		ch: this.insertLocation.ch + item.length - 1
		// 	}, 100);
		// })
		// if (this.editor.getLine(this.insertLocation.line).startsWith('assignedTo: ')) {
		// 	assignedToUpdate(this.editor, this.settings, item);
		// }
	}
}
