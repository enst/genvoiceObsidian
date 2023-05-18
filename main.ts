import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, moment, SuggestModal, WorkspaceLeaf, TFile } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { SuggestionModal } from './src/modals';
import { loadNotifications } from './src/notification';


//import { showSuggestions } from 'src/suggestion';

// automaticaly updates latest edit date

export function updateLastEditDate(editor: Editor, settings: TextPluginSettings) {
	let lineIndex = 0;
	while (editor.getLine(lineIndex)) {
		if (editor.getLine(lineIndex).startsWith(settings.lastEditDateStr)) {
			editor.replaceRange(
				moment().format(settings.dateFormat),
				{ line: lineIndex, ch: settings.lastEditDateStr.length + 1 },
				{ line: lineIndex, ch: settings.lastEditDateStr.length + settings.dateFormat.length + 1 },
			);
			break;
		}
		lineIndex ++;	
	}
}

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		/***********************************************************************
		// load notifications upon start or through ribbon icon

		this.registerDomEvent(document, 'load', (evt: Event) => {
			loadNotifications(this.settings);
		})
		
		const ribbonIconNotifications = this.addRibbonIcon('bell', 'Show Notifications', (evt: MouseEvent) => {
			loadNotifications(this.settings);
		})

		// display notification on current file upon opening file

		this.registerEvent(this.app.workspace.on('file-open', (file: TFile) => {
			new Notice('yes');
		}))
		******************************************************************/

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

		// adding/mentioning people anywhere on the editor through tag symbol

		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => {
			const key = editor.getLine(editor.getCursor().line).charAt(editor.getCursor().ch - 1);
			if (key.localeCompare(this.settings.tagSymb) == 0) {
				const files: TFile[] = this.app.vault.getMarkdownFiles();
				for (let index = 0; index < files.length; index++) {
					if (files[index].path.localeCompare(this.settings.peopleListFileName + '.md') == 0) {
						this.app.vault.read(files[index]).then((content) => {
							editor.replaceRange(
								this.settings.tagSymb + ' ',
								{ line: editor.getCursor().line, ch: editor.getCursor().ch - 1 },
								editor.getCursor()
							)
							let nameSuggestionList: string[] = content.split(this.settings.suggestionSplitStr);
							new SuggestionModal(editor, this.settings, nameSuggestionList, true).open();
						})
					}
				}
			}
		}));

		// adding people (opening suggestion modal) anywhere on the editor through ribbon icon

		const ribbonIconAddPeople = this.addRibbonIcon('user', 'Add People', (evt: MouseEvent) => {
			let editor = this.app.workspace.activeEditor!.editor!;
			const files: TFile[] = this.app.vault.getMarkdownFiles();
			for (let index = 0; index < files.length; index++) {
				if (files[index].path.localeCompare(this.settings.peopleListFileName + '.md') == 0) {
					this.app.vault.read(files[index]).then((content) => {
						let nameSuggestionList: string[] = content.split(this.settings.suggestionSplitStr);
						new SuggestionModal(editor, this.settings, nameSuggestionList, false).open();
					})
				}
			}
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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

