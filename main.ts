import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, moment, SuggestModal, WorkspaceLeaf, TFile } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { SuggestionModal } from './src/modals';
import { monitorEventLoopDelay } from 'perf_hooks';
//import { loadNotifications } from './src/notification';

// automaticaly updates latest edit date

export function updateLastEditDate(editor: Editor, settings: TextPluginSettings) {
	let lineIndex = 0;
	while (editor.getLine(lineIndex)) {
		let line = editor.getLine(lineIndex);
		if (line.startsWith(settings.lastEditDateStr)) {
			if (editor.getCursor().line != lineIndex) {
				if (line.length > settings.lastEditDateStr.length + settings.dateFormat.length) {
					editor.replaceRange(
						moment().format(settings.dateFormat),
						{ line: lineIndex, ch: settings.lastEditDateStr.length + 1 },
						{ line: lineIndex, ch: settings.lastEditDateStr.length + settings.dateFormat.length + 1 }
					)
				} else {
					editor.replaceRange(
						moment().format(settings.dateFormat),
						{ line: lineIndex, ch: settings.lastEditDateStr.length + 1 },
						{ line: lineIndex, ch: line.length }
					)
				}
			}
		break;
		}
	lineIndex ++;	
	}
}

// generate name list and open modal

export async function openSuggestionModal(app: App, settings: TextPluginSettings, caseID: number) {
	const nameFile = app.vault.getMarkdownFiles().find((file) => file.path.localeCompare(settings.peopleListFileName + '.md') == 0);
	const nameSuggestionList: string[] = (await app.vault.read(nameFile!)).split(settings.suggestionSplitStr);
	new SuggestionModal(app.workspace.activeEditor!.editor!, settings, nameSuggestionList, caseID).open();
}

// show notifications and remove tag symbols from corresponding files

export async function showNotifications(app: App, settings: TextPluginSettings) {
	const files: TFile[] = this.app.vault.getMarkdownFiles();
	for (let index = 0; index < files.length; index++) {
		let oldContent: string= await this.app.vault.read(files[index]);
		if (oldContent.contains(settings.tagSymb + settings.username)) {
			new Notice('You have a new mention in ' + files[index].path);
			let newContent: string = oldContent.replace(new RegExp(settings.tagSymb + settings.username, 'gi'), settings.username);
			app.vault.modify(files[index], newContent);
		}
	}
}

//generate auto text (date + username)

export function generateAutoText(app: App, editor: Editor, settings: TextPluginSettings, lineNum: number) {
	editor.replaceRange(
		settings.separationLineStr + '\n\n\n\n' + settings.separationLineStr + '\n' + moment().format(settings.dateFormat) + ' ' + settings.username,
		{ line: lineNum, ch: 0 },
		{ line: lineNum, ch: settings.separationLineStr.length }
	)
}

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;

	
	async onload() {

		await this.loadSettings();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		/*
		const ribbonIconTest = this.addRibbonIcon('bell', 'Test Icon', (evt: MouseEvent) => {
			showNotifications(this.app, this.settings);
		});
		*/


		//------------------------------------------------------------------------------------------------ NOTIFICAITONS
		
		this.registerEvent(this.app.workspace.on('resize', () => {
			showNotifications(this.app, this.settings);
		}))

		//------------------------------------------------------------------------------------------------DATE INSERTION / UDDATES
		// updates last edit date upon any changes to the editor

		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => {
			updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings);
		})

		this.registerEvent(this.app.workspace.on('editor-paste', () => {
			updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings);
		}));

		// insert date at cursor place and replace latest edit date through ribbon icon

		const ribbonIconInsertDate = this.addRibbonIcon('calendar', 'Insert Date', (evt: MouseEvent) => {
			let editor = this.app.workspace.activeEditor!.editor!;
			editor.replaceRange(moment().format(this.settings.dateFormat), editor.getCursor());
			updateLastEditDate(editor, this.settings);
		});	

	//------------------------------------------------------------------------------------------ ADDING PEOPLE

		// adding first person to "people list"

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const editor = this.app.workspace.activeEditor!.editor!
			if (editor.getLine(editor.getCursor().line).startsWith(this.settings.peopleStr) &&
				editor.getLine(editor.getCursor().line).length <= this.settings.peopleStr.length + 1) {
					openSuggestionModal(this.app, this.settings, 0);
			}
		});

		// adding people through comma (in "people list" only) or tag symbol

		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			const key = editor.getLine(editor.getCursor().line).charAt(editor.getCursor().ch - 1);
			if (key.localeCompare(this.settings.tagSymb) == 0) {
				openSuggestionModal(this.app, this.settings, 1);
			} else if (editor.getLine(editor.getCursor().line).startsWith(this.settings.peopleStr) && key.localeCompare(',') == 0) {
				openSuggestionModal(this.app, this.settings, 0);
			}
		}));

		// adding people through ribbon icon

		const ribbonIconAddPeople = this.addRibbonIcon('user', 'Add People', (evt: MouseEvent) => {
			openSuggestionModal(this.app, this.settings, 2);
		});

		// cursor relocation

		this.registerInterval(window.setInterval(() => {
			let editor = this.app.workspace.activeEditor!.editor!
			if (editor.getLine(editor.getCursor().line + 1).startsWith(this.settings.peopleStr) && editor.getCursor().ch == 0) {
				editor.setCursor({ line: editor.getCursor().line + 1, ch: editor.getLine(editor.getCursor().line + 1).length })
			}
		}, 100));
		
		//------------------------------------------------------------------------------------------------------------ AUTO DATE & NAME INSERTION

		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => {
			let editor = this.app.workspace.activeEditor!.editor!
			let lineTrack = { count: 0, line: 0 }
			for (let index = 0; index < editor.getCursor().line; index ++) {
				if (editor.getLine(index).startsWith(this.settings.separationLineStr)) {
					lineTrack.count ++;
					lineTrack.line = index;
				}
			}
			if (lineTrack.count == 1) {
				generateAutoText(this.app, editor, this.settings, lineTrack.line);
			}
		});
	}
	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

