import { App } from 'obsidian';
import { Permissions, canWrite, parsePermissions } from './logic';

// SyncHub（公司内部的同步服务）告诉这个库的两件事。Hub 会在库的 .synchub/ 文件夹里放两个文件：
//   client-config.json   其中 personal_dir 是这个人自己的文件夹，例如 “个人/mark”
//   permissions.json     这个人对各个文件夹是可写、只读还是看不到
// 不是用 SyncHub 同步的库里没有这两个文件，那就什么都不限制。

const CONFIG_FILE = '.synchub/client-config.json';
const PERMISSIONS_FILE = '.synchub/permissions.json';
const MAX_AGE_MS = 15_000;

export class SyncHubContext {
	personalDir: string | null = null;
	private permissions: Permissions | null = null;
	private loadedAt = 0;
	private loading: Promise<void> | null = null;

	constructor(private app: App) { }

	// 重新读这两个文件；刚读过（15 秒内）就不读
	refresh(force = false): Promise<void> {
		if (!force && Date.now() - this.loadedAt < MAX_AGE_MS) return Promise.resolve();
		if (this.loading === null) {
			this.loading = this.load().then(() => {
				this.loading = null;
			});
		}
		return this.loading;
	}

	// 这个路径本人能不能写。不在 SyncHub 里时都能写。
	canWrite(path: string): boolean {
		return canWrite(this.permissions, path);
	}

	private async load(): Promise<void> {
		const config = await this.readJson(CONFIG_FILE);
		const personal = (config as { personal_dir?: unknown } | null)?.personal_dir;
		this.personalDir = typeof personal === 'string' && personal !== '' ? personal : null;
		this.permissions = parsePermissions(await this.readJson(PERMISSIONS_FILE));
		this.loadedAt = Date.now();
	}

	private async readJson(path: string): Promise<unknown> {
		try {
			return JSON.parse(await this.app.vault.adapter.read(path));
		} catch (_) {
			return null; // 文件不存在，或者同步到一半还不完整
		}
	}
}
