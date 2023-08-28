
import notifDate from './notifDate.json'
import { App, Notice, TFile, Editor, moment } from 'obsidian';
import { TextPluginSettings } from './settings';
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { modifyJsonFile } from 'modify-json-file'


export async function getFiles(app: App, editor: Editor, settings: TextPluginSettings) {
    const files: TFile[] = app.vault.getMarkdownFiles();
    let notifFiles: TFile[] = [];
    for (let index = 0; index < files.length; index++) {
        if (
            await peopleCond(app, files[index], settings) && dateCond(app, files[index], settings)
        ) {
            notifFiles.push(files[index]);
            changeDate(settings);
        }
    }
    return notifFiles;
}

async function peopleCond(app: App, file: TFile, settings: TextPluginSettings): Promise<boolean> {
    const content: String = await app.vault.read(file);
    if (content.contains(`assignedTo: ~${settings.username}`) || content.contains(`assignedTo:~${settings.username}`)) {
        return true;
    }
    return false;
}

function dateCond(app: App, file: TFile, settings: TextPluginSettings): boolean {
    if (moment(moment().format(settings.dateFormat)).isAfter(notifDate[settings.username as keyof typeof notifDate])) {
        changeDate(settings);
        return true;
    } else {
        return false;
    }
}

async function changeDate(settings: TextPluginSettings) {
    let name: string = settings.username
    modifyJsonFile(
        './notifDate.json',
        {
            [name]: moment().format(settings.dateFormat)
        }
    )
}