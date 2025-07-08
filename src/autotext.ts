import { App, Editor, moment, Notice } from 'obsidian'
import { TextPluginSettings } from './settings'

// 检测当前文档是否符合 header 插入的要求

function disableAutoText(app: App, editor: Editor, settings: TextPluginSettings): boolean {
    let dataviewLineTrack = 0;
    let topLevelLineTrack = 0;
    let isTemplate = false;
    const metadata = app.metadataCache.getFileCache(this.app.workspace.getActiveFile()!)?.frontmatter;
    // if (typeof metadata.people === 'string' || ( metadata.people instanceof Array && metadata.people.length) ) {
    if (metadata && metadata.hasOwnProperty('people')) {
        isTemplate = true;
    }

    if (editor.getLine(editor.getCursor().line).length === 0) {
        return true;
    }
    // console.log("disableAutoText: " + line.length + " " + line);

    for (let index = 0; index < editor.getCursor().line; index++) {
        const line = editor.getLine(index);
        // console.log("disableAutoText: " + line.length + " " + line);
        // console.log("disableAutoText: " + dataviewLineTrack + " " + topLevelLineTrack);
        if (dataviewLineTrack >= 2 && topLevelLineTrack == 1) {
            if (!(line == "")) {
                return true;
            }
        }
        if (line.startsWith(settings.topLevelLine)) {
            topLevelLineTrack ++;
        }
        if (line.startsWith(settings.dataviewHeaderLine)) {
            dataviewLineTrack ++;
        }
        // if (line.startsWith(settings.templateDetectionStr)) {
        //     isTemplate = true;
        // }
    }
    if (dataviewLineTrack <= 1 || !isTemplate || (topLevelLineTrack == 0)) {
        return true;
    }
    return false;
}

// 自动插入 header 以及更改人信息

export function generateAutoText(app: App, editor: Editor, settings: TextPluginSettings) {
    if (!disableAutoText(app, editor, settings)) {
        editor.replaceRange(
            '\n\n' + settings.separationLineStr + '\n' + moment().format(settings.dateFormat) + ' ' + settings.username,
            { line: editor.getCursor().line - 1, ch: editor.getLine(editor.getCursor().line - 1).length }
        )
        editor.replaceRange(
            '\n',
            { line: editor.getCursor().line + 1, ch: 0 }
        )
    }
}