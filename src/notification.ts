/************************************************************** 
import { Plugin, App, Editor, Notice, TFile } from 'obsidian';
import TextPlugin from '../main';
import { TextPluginSettings } from './settings';
import { MentionModal } from './modals';

export function loadNotifications(settings: TextPluginSettings) {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    for (let index = 0; index < files.length; index++) {
        this.app.vault.read(files[index]).then((content: string) => {
            let notifString: string = settings.tagSymb + settings.noticeSymb + settings.username;
            if (content.contains(notifString)) {
                new Notice('You have an unresolved notice in ' + files[index].path);
            }
        })
    }
}

export function loadMentionModal(settings: TextPluginSettings) {
    let editor = this.app.workspace.activeEditor!.editor!;
    let notifString: string = settings.tagSymb + settings.noticeSymb + settings.username;
    let lineIndex = 0;
    while(editor.getLine(lineIndex)) {
        if (editor.getLine(lineIndex).contains(notifString)) {
            
        }
    }
    
}

*********************************************************/
