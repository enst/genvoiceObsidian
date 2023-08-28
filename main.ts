import { App, Editor, Notice, Plugin, moment, TFile, Command } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { openReminderModal, updateLastEditDate, openPeopleSuggestionModal, showNotifications, openTemplateSuggestionModal, openStatusSuggestionModal } from './src/assets'
import { generateAutoText } from './src/autotext'
import { getFiles } from './src/notifAsset'
import { ReminderModal } from './src/modals'

import { monitorEventLoopDelay } from 'perf_hooks';

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;

	
	async onload() {


		const notifTest = this.addRibbonIcon('leaf', 'trigger notif', async (evt: MouseEvent) => {
		})

		








		await this.loadSettings();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		//------------------------------------------------------------------------------------------------ NOTIFICAITONS
		
		this.registerEvent(this.app.workspace.on('resize', () => {
			//const notifFiles = 
		}))

		//------------------------------------------------------------------------------------------------DATE INSERTION / UDDATES
		
		// updates last edit date upon any changes to the editor

		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => {
			if (!this.app.workspace.getActiveFile()!.path.startsWith(this.settings.templateFolderPath)) {
				updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings);
			}
		});

		this.registerEvent(this.app.workspace.on('editor-paste', () => {
			if (!this.app.workspace.getActiveFile()!.path.startsWith(this.settings.templateFolderPath)) {
				updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings);
			}
		}));

		// insert date at cursor place and replace latest edit date through ribbon icon

		const ribbonIconInsertDate = this.addRibbonIcon('calendar', 'Insert Date', (evt: MouseEvent) => {
			let editor = this.app.workspace.activeEditor!.editor!;
			editor.replaceRange(moment().format(this.settings.dateFormat), editor.getCursor());
			updateLastEditDate(editor, this.settings);
		});	

	//------------------------------------------------------------------------------------------ ADDING PEOPLE

		// adding people through comma (in "people list" only) or tag symbol

		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			const key = editor.getLine(editor.getCursor().line).charAt(editor.getCursor().ch - 1);
			if (key.localeCompare(this.settings.tagSymb) == 0) {
				openPeopleSuggestionModal(this.app, this.settings);
			} 
		}));
		
		//------------------------------------------------------------------------------------------------------------ AUTO DATE & NAME INSERTION

		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => {
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		});
	
		this.registerEvent(this.app.workspace.on('editor-paste', () => {
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		}));

		//-------------------------------------------------------------------------------------------------------------- INSERT TEMPLATE

		setTimeout(() => {
			this.registerEvent(this.app.vault.on('create', (file: TFile) => {
				setTimeout(async () => {
					let content = await this.app.vault.read(file);
					if (file.path.endsWith('.md') && content == "") {
						openTemplateSuggestionModal(this.app, this.settings);
					}
				}, 100);
			}));
		}, 100);

		// ------------------------------------------------------------------------------------------------ STATUS MODAL


		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
			const editor = this.app.workspace.activeEditor!.editor!;
			if (editor.getLine(editor.getCursor().line).contains('status:')) {
				await openStatusSuggestionModal(this.app, this.settings, editor.getCursor().line);
				editor.setCursor({ line: editor.getCursor().line - 1, ch: 0 });
			}
		});

		//-------------------------------------------------- create new notification

		/*
		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			const names = getDocPeople(editor, this.settings);
			new Notice(names[1])
		}));
		*/
		
		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			const key = editor.getLine(editor.getCursor().line).charAt(editor.getCursor().ch - 1);
			if (key.localeCompare(this.settings.tagSymb) == 0) {
				openPeopleSuggestionModal(this.app, this.settings);
			} 
		}));
		
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

