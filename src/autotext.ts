import { App, Editor, moment } from 'obsidian'
import { TextPluginSettings } from './settings'

// detect if cursor is currently in the dataview area

export function disabledArea(app: App, editor: Editor, settings: TextPluginSettings): boolean {
    let numTrack = 0;
    for (let index = 0; index < editor.getCursor().line - 1; index++) {
        if (editor.getLine(index).startsWith(settings.dataviewHeaderLine)) {
            numTrack ++;
        }
    }
    if (numTrack == 1) {
        return true;
    }
    if (numTrack == 0 && (editor.getLine(editor.getCursor().line).startsWith(settings.dataviewHeaderLine)
        || editor.getLine(editor.getCursor().line - 1).startsWith(settings.dataviewHeaderLine))) {
            return true;
    }
    return false;
}

// check if the cursor is currently in the newest date 

export function notNewestDate(app: App, editor: Editor, settings: TextPluginSettings): boolean {
    for (let index = 0; index < editor.getCursor().line; index++) {
        if (editor.getLine(index).startsWith(settings.separationLineStr)) {
            return true;
        }
    }
    return false;
}

//generate auto text (date + username)

export function generateAutoText(app: App, editor: Editor, settings: TextPluginSettings) {
    if (!disabledArea(app, editor, settings) && !notNewestDate(app, editor, settings)) {
        editor.replaceRange(
            '\n\n' + settings.separationLineStr + '\n' + moment().format(settings.dateFormat) + ' ' + settings.username,
            { line: editor.getCursor().line - 1, ch: 0 }
        )
    }
}