import { App, Editor, moment, TFile, Notice } from 'obsidian'
import { TextPluginSettings } from './settings'
import { PeopleSuggestionModal, TemplateSuggestionModal, ReminderModal, StatusSuggestionModal } from './modals'

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

export async function openReminderModal(app: App, settings: TextPluginSettings) {
	let editor = app.workspace.activeEditor!.editor!;
	const files: TFile[] = app.vault.getMarkdownFiles();
	for (let index = 0; index < files.length; index++) {
		let content = await app.vault.read(files[index]);
		if (content.contains('!!!')) {
			new ReminderModal(editor, settings, files[index]).open();
		}
	}
}

// generate name list and open modal

export async function openPeopleSuggestionModal(app: App, settings: TextPluginSettings) {
	let editor = app.workspace.activeEditor!.editor!;
	let location = editor.getCursor();
	
	const files: TFile[] = app.vault.getMarkdownFiles();
	const people: string[] = [];
	for (let index = 0; index < files.length; index++) {
		if (files[index].path.startsWith(settings.peopleFolderPath)) {
			people.push(files[index].basename);
		}
	}
	editor.setCursor({ line: editor.getCursor().line - 1, ch: 0 })
	new PeopleSuggestionModal(app.workspace.activeEditor!.editor!, settings, people, location).open();
}

// show notifications and remove tag symbols from corresponding files

export async function showNotifications(app: App, settings: TextPluginSettings) {
	const files: TFile[] = this.app.vault.getMarkdownFiles();
	for (let index = 0; index < files.length; index++) {
		let oldContent: string = await this.app.vault.read(files[index]);
		if (oldContent.contains(settings.tagSymb + settings.username)) {
			new Notice('You have a new mention in ' + files[index].path);
			let newContent: string = oldContent.replace(new RegExp(settings.tagSymb + settings.username, 'gi'), settings.username);
			app.vault.modify(files[index], newContent);
		}
	}
}

// open status suggestion modal

export async function openStatusSuggestionModal(app: App, settings: TextPluginSettings, lineNum: number) {
	const files: TFile[] = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith('All/status'));
	const statusFile = files[0];
	const statusOptions: string[] = (await app.vault.read(statusFile)).split('\n');
	new StatusSuggestionModal(app.workspace.activeEditor!.editor!, settings, statusOptions, lineNum).open();
}

// open template suggestion modal

export function openTemplateSuggestionModal(app: App, settings: TextPluginSettings) {
    const files: TFile[] = app.vault.getMarkdownFiles();
    const templateFiles: TFile[] = [];
    for (let index = 0; index < files.length; index++) {
        if (files[index].path.startsWith(settings.templateFolderPath)) {
            templateFiles.push(files[index]);
        }
    }
    new TemplateSuggestionModal(app.workspace.activeEditor!.editor!, settings, templateFiles).open();
}

export function initTemplatePpl (app: App, editor: Editor, settings: TextPluginSettings) {
	for (let index = 0; index < 20; index++) {
		if (editor.getLine(index).startsWith('people:')) {
			editor.replaceRange(
				`~${settings.username}`,
				{ line: index, ch: 8 }
			)
		}
		if (editor.getLine(index).startsWith('createdBy:')) {
			editor.replaceRange(
				`~${settings.username}`,
				{ line: index, ch: 11 }
			)
		}
	}
}

export function assignedToUpdate(editor: Editor, settings: TextPluginSettings, name: string) {
	let lineIndex = 0;
	while (editor.getLine(lineIndex)) {
		let line = editor.getLine(lineIndex)
		if (line.startsWith(settings.peopleStr) && !line.contains(name)) {
			editor.replaceRange(
				',~' + name,
				{ line: lineIndex, ch: editor.getLine(lineIndex).length }
			)
			break;
		}
		lineIndex ++;
	}
	
}