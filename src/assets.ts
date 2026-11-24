import { App, Editor, moment, TFile } from 'obsidian'
import { TextPluginSettings } from './settings'
import { ChoiceSuggestionModal, TemplateSuggestionModal } from './modals'
import { updatedDateLine } from './logic'

// 自动更新最近更改日期
//	- 只看文档开头到第一个空行之间的内容（也就是属性区），和以前一样
//	- 光标正停在日期那一行时不动它，这样可以手改
//	- 日期没变就不替换，免得每敲一个字都往撤销历史里塞一次没有变化的修改

export function updateLastEditDate(editor: Editor, settings: TextPluginSettings) {
	if (!settings.lastEditDateStr) return;
	const today = moment().format(settings.dateFormat);
	const lineCount = editor.lineCount();
	for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
		const line = editor.getLine(lineIndex);
		if (!line) break;
		if (!line.startsWith(settings.lastEditDateStr)) continue;
		if (editor.getCursor().line != lineIndex) {
			// 无论旧值格式如何，整行替换为标准格式，避免长度不一致导致截断或残留
			const newLine = updatedDateLine(line, settings.lastEditDateStr, today);
			if (newLine !== null) {
				editor.replaceRange(
					newLine,
					{ line: lineIndex, ch: 0 },
					{ line: lineIndex, ch: line.length }
				)
			}
		}
		break;
	}
}

// 从文件夹提取所有人名

export function collaboratorNames(app: App, settings: TextPluginSettings): string[] {
	return app.vault.getMarkdownFiles()
		.filter((file) => file.path.startsWith(settings.peopleFolderPath))
		.map((file) => file.basename);
}

// 整理 people / assignedTo 时认得的名字：协作者名单，加上自己

export function knownNames(app: App, settings: TextPluginSettings): Set<string> {
	const names = collaboratorNames(app, settings).map((name) => name.toLowerCase());
	if (settings.username) names.push(settings.username.toLowerCase());
	return new Set(names);
}

// 弹出人名选择窗口

export function openPeopleSuggestionModal(app: App, settings: TextPluginSettings, onChoose: (name: string) => void) {
	new ChoiceSuggestionModal(app, collaboratorNames(app, settings), 'Who are you assigning this to?', onChoose, true).open();
}

// 弹出状态选择窗口（顺序和状态词表里的一样）

export function openStatusSuggestionModal(app: App, statusOptions: string[], onChoose: (status: string) => void) {
	new ChoiceSuggestionModal(app, statusOptions, 'Set status to...', onChoose, false).open();
}

// 弹出文件 template 选择窗口，选中的模板写进 target（新建的那篇笔记）

export function openTemplateSuggestionModal(app: App, settings: TextPluginSettings, target: TFile, beforeInsert: () => void) {
	const templateFiles = app.vault.getMarkdownFiles().filter(file => file.path.startsWith(settings.templateFolderPath));
	new TemplateSuggestionModal(app, settings, templateFiles, target, beforeInsert).open();
}
