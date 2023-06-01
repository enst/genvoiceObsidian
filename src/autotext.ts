import { App, Editor, moment } from 'obsidian'
import { TextPluginSettings } from './settings'

// detect if cursor is currently in the dataview area

export function disabledArea(app: App, editor: Editor, settings: TextPluginSettings): boolean {
    let lineTrack = 0;
    for (let index = 0; index < editor.getCursor().line - 1; index++) {
        if (editor.getLine(index).startsWith(settings.dataviewHeaderLine)) {
            lineTrack ++;
        }
    }
    if (lineTrack <= 1) {
        return true;
    }
    return false;
}

//generate auto text (date + username)

export function generateAutoText(app: App, editor: Editor, settings: TextPluginSettings) {
    if (!disabledArea(app, editor, settings)) {
        let lineTrack = true;
        for (let index = 0; index < editor.getCursor().line; index ++) {
            if (editor.getLine(index).startsWith(settings.separationLineStr)) {
                lineTrack = false;
                break;
            }
        }
        if (lineTrack) {
            editor.replaceRange(
                '\n\n' + settings.separationLineStr + '\n' + moment().format(settings.dateFormat) + ' ' + settings.username,
                { line: editor.getCursor().line - 1, ch: 0 }
            )
        }
    }
}