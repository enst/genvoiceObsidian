import { App, Editor, moment, TFile, Notice } from 'obsidian'
import { TextPluginSettings } from './settings'
import { PeopleSuggestionModal, TemplateSuggestionModal, StatusSuggestionModal } from './modals'

// 自动更新最近更改日期

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

// 从文件夹提取所有人名，并弹出人名选择窗口

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

// 弹出文件 status 选择窗口

export async function openStatusSuggestionModal(app: App, settings: TextPluginSettings, lineNum: number) {
	const files: TFile[] = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith('All/status'));
	const statusFile = files[0];
	const statusOptions: string[] = (await app.vault.read(statusFile)).split('\n');
	new StatusSuggestionModal(app.workspace.activeEditor!.editor!, settings, statusOptions, lineNum).open();
}

// 弹出文件 template 选择窗口

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

// 在插入 template 时，自动更改日期以及创建者等信息

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

// 在 assignedTo：前插入人名时，自动更新 people：前的名单

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