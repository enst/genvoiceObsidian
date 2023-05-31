import { App, Editor, Notice, Plugin, moment} from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { updateLastEditDate, openSuggestionModal, showNotifications, generateAutoText } from './src/assets'
import { monitorEventLoopDelay } from 'perf_hooks';

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

