import { App, Editor, moment, TFile, Notice } from 'obsidian'
import { TextPluginSettings } from './settings'
import { SuggestionModal } from './modals'

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

