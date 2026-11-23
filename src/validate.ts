import { App, TFile, Notice } from 'obsidian';
import { TextPluginSettings } from './settings';
import { asList, normalizePeople, sameMembers } from './logic';
import { tidyPeopleText } from './people';

// 按 change 改写一篇笔记：只在内容确实有变化时才写文件。返回有没有写。
// beforeWrite 在确定要写之前调用一次。
export async function editNote(app: App, file: TFile, change: (text: string) => string, beforeWrite?: () => void): Promise<boolean> {
	const current = await app.vault.read(file);
	if (change(current) === current) return false;
	if (beforeWrite) beforeWrite();
	let changed = false;
	// process 是 “读 - 改 - 写” 一步完成的：以写的那一刻文件里的内容为准，不会用旧内容盖掉新内容
	await app.vault.process(file, (text) => {
		const next = change(text);
		changed = next !== text;
		return next;
	});
	return changed;
}

// 整理一篇笔记的 people 和 assignedTo（规则见 src/people.ts）。返回有没有改。
export async function validatePeople(app: App, file: TFile, known: ReadonlySet<string>, beforeWrite?: () => void): Promise<boolean> {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter
		|| !Object.prototype.hasOwnProperty.call(frontmatter, 'people')
		|| !Object.prototype.hasOwnProperty.call(frontmatter, 'assignedTo')) {
		return false;
	}

	// 先看 Obsidian 的缓存：绝大多数时候不需要改，连文件都不用读
	const people = asList(frontmatter.people);
	const assignedTo = asList(frontmatter.assignedTo);
	const next = normalizePeople(people, assignedTo, known);
	if (sameMembers(people, next.people) && sameMembers(assignedTo, next.assignedTo)) return false;

	return editNote(app, file, (text) => tidyPeopleText(text, known), beforeWrite);
}

// 批量整理一个文件夹（含子文件夹）下所有笔记的 people 和 assignedTo
// mayEdit：这个路径本人能不能写。只读的笔记跳过。
export async function validatePeopleInFolder(
	app: App,
	settings: TextPluginSettings,
	folderPath: string,
	known: ReadonlySet<string>,
	mayEdit: (path: string) => boolean,
) {
	const folder = folderPath.replace(/^\/+|\/+$/g, '');
	if (folder === '') {
		// 库的根目录：不做全库的批量改写
		new Notice('Open a note inside a folder, then run this command again');
		return;
	}
	const prefix = folder + '/';
	const files = app.vault.getMarkdownFiles().filter((file) =>
		file.path.startsWith(prefix) && !file.path.startsWith(settings.templateFolderPath));

	if (files.length === 0) {
		new Notice('No markdown files found in this folder');
		return;
	}

	new Notice(`Validating ${files.length} files...`);
	let changed = 0;
	let skipped = 0;
	for (const file of files) {
		if (!mayEdit(file.path)) {
			skipped++;
			continue;
		}
		try {
			if (await validatePeople(app, file, known)) changed++;
		} catch (error) {
			console.error('Validate people failed:', file.path, error);
		}
	}
	const readOnly = skipped > 0 ? `, ${skipped} read-only skipped` : '';
	new Notice(`Validated ${files.length} files: ${changed} updated${readOnly}`);
}
