import { Plugin, Editor, App } from 'obsidian';
import TextPlugin from '../main';
import { TextPluginSettings } from './settings';


export function showSuggestions(app: App, settings: TextPluginSettings, suggestions: string[]) {
    this.app = app;
    this.editor = app.workspace.activeEditor!.editor!;
    this.settings = settings;
    this.suggestions = suggestions;

    const suggester = this.app.workspace.createSuggester();
    suggester
        .setQuery(this.settings.tagSymb)
        .setSuggestions(suggestions)
        .setLabelMatch(true)
        .onChange((content: string) => {
            this.editor.replaceRange(
                content,
                { line: this.editor.getCursor().line, ch: this.editor.getCursor().ch }
            )})
        .onSelect((item: string) => {
            this.editor.replaceRange(
                item,
                { line: this.editor.getCursor().line, ch: this.editor.getCursor().ch }
            )});
    
    suggester.show();
}

