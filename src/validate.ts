import { App, TFile, Notice } from 'obsidian';
import * as yaml from 'js-yaml';
import { TextPluginSettings } from './settings';

function arrayEqual(a: string[], b: string[]) {
	if (!Array.isArray(a) || !Array.isArray(b)) return false;
	if (a.length !== b.length) return false;
	const sa = [...a].sort().join(',');
	const sb = [...b].sort().join(',');
	return sa === sb;
}

export async function validatePeople(file: TFile) {
	// console.log('Validating people and assignedTo in frontmatter for file:', file.path);
	const cache = this.app.metadataCache.getFileCache(file);
	let people: string[] = [];
	let assignedTo: string[] = [];

	const metadata = cache?.frontmatter;
	if (!metadata || !metadata.hasOwnProperty('people') || !metadata.hasOwnProperty('assignedTo')) {
		return;
	}

	if (cache?.frontmatter?.people) {
		if (Array.isArray(cache.frontmatter.people)) {
			people = cache.frontmatter.people;
		} else if (typeof cache.frontmatter.people === 'string') {
			people = [cache.frontmatter.people];
		}
	}

	if (cache?.frontmatter?.assignedTo) {
		if (Array.isArray(cache.frontmatter.assignedTo)) {
			assignedTo = cache.frontmatter.assignedTo;
		} else if (typeof cache.frontmatter.assignedTo === 'string') {
			assignedTo = [cache.frontmatter.assignedTo];
		}
	}

	// console.log('people:', people);
	// console.log('assignedTo:', assignedTo);

	// 用正则分割每个元素，过滤空字符串
	const splitAndClean = (arr: string[]) =>
		arr.flatMap(s =>
			s.split(/[^a-zA-Z]+/)
				.filter(Boolean)
				.map(str => str.toLowerCase())
		);

	const peopleClean = splitAndClean(people);
	const assignedToClean = splitAndClean(assignedTo);

	// 用 Set 去重合并
	const allPeopleSet = new Set([...peopleClean, ...assignedToClean]);
	const allPeople = Array.from(allPeopleSet);

	const allAssignedToSet = new Set(assignedToClean);
	const allAssignedTo = Array.from(allAssignedToSet);

	// console.log('allPeople:', allPeople);
	// console.log('allAssignedTo:', allAssignedTo);

	if (arrayEqual(people, allPeople) && arrayEqual(assignedTo, allAssignedTo)) {
		// 如果没有变化，直接返回
		// console.log('No changes in people or assignedTo fields, skipping update.');
		return;
	}

	await updateFrontmatterFields(this.app, file, {
		people: allPeople,
		assignedTo: allAssignedTo
	});
}

/**
 * 批量修改 frontmatter 字段
 * @param app Obsidian App
 * @param file 目标 TFile
 * @param fields 要修改的字段对象，如 { people: ['a','b'], assignedTo: ['c'] }
 */
export async function updateFrontmatterFields(app: App, file: TFile, fields: Record<string, any>) {
	console.log('Updating frontmatter fields for file:', file.path);
	const content = await app.vault.read(file);
	const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(content);
	if (!match) return;

	let data: any = yaml.load(match[1]) || {};
	for (const key in fields) {
		data[key] = fields[key];
	}

	const newYaml = yaml.dump(data, { lineWidth: 1000 }).trim();
	const newContent = `---\n${newYaml}\n---\n${match[2]}`;
	await app.vault.modify(file, newContent);
	// const leaf = app.workspace.activeLeaf;
	// if (leaf) {
	// 	await leaf.openFile(file);
	// }
}

/**
 * 批量验证文件夹下的所有.md文件的people和assignedTo字段
 * @param app Obsidian App
 * @param settings 插件设置
 * @param folderPath 文件夹路径
 * @param validateFn 验证函数（默认为validatePeople）
 */
export async function validatePeopleInFolder(
	app: App,
	settings: TextPluginSettings,
	folderPath: string,
	validateFn: (this: { app: App }, file: TFile) => Promise<void>
) {
	const files = app.vault.getFiles();
	const mdFiles = files.filter(file => 
		file.path.startsWith(folderPath) && 
		file.extension === 'md' &&
		!file.path.startsWith(settings.templateFolderPath)
	);

	if (mdFiles.length === 0) {
		new Notice('No markdown files found in this folder');
		return;
	}

	new Notice(`Validating ${mdFiles.length} files...`);
	
	for (const file of mdFiles) {
		await validateFn.call({ app }, file);
	}

	new Notice(`Validated ${mdFiles.length} files`);
}