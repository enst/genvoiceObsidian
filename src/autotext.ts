import { App, Editor, moment, Notice } from 'obsidian'
import { TextPluginSettings } from './settings'

// check if auto text is allowed at current cursor location in current file

export function disableAutoText(app: App, editor: Editor, settings: TextPluginSettings): boolean {
    let dataviewLineTrack = 0;
    let isTemplate = false;
    if (!(editor.getLine(editor.getCursor().line) == "")) {
        return true;
    }
    for (let index = 1; index < editor.getCursor().line; index++) {
        let line = editor.getLine(index);
        if (dataviewLineTrack >= 2) {
            if (!(line == "")) {
                return true;
            }
        }
        if (line.startsWith(settings.dataviewHeaderLine)) {
            dataviewLineTrack ++;
        }
        if (line.startsWith(settings.templateDetectionStr)) {
            isTemplate = true;
        }
    }
    if (dataviewLineTrack <= 1 || !isTemplate) {
        return true;
    }
    return false;
}

//generate auto text (date + username)

export function generateAutoText(app: App, editor: Editor, settings: TextPluginSettings) {
    if (!disableAutoText(app, editor, settings)) {
        editor.replaceRange(
            '\n\n' + settings.separationLineStr + '\n' + moment().format(settings.dateFormat) + ' ' + settings.username,
            { line: editor.getCursor().line - 1, ch: editor.getLine(editor.getCursor().line - 1).length }
        )
        editor.replaceRange(
            '\n',
            { line: editor.getCursor().line + 1, ch: 0}
        )
    }
}