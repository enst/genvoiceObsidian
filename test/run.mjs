// 跑测试：node test/run.mjs（也就是 npm test）
//
// 先用 esbuild 把要测的代码打包到 test/.build/，再用 Node 自带的测试框架跑 test/*.test.mjs。
//   - src/frontmatter.ts、src/logic.ts、src/people.ts 是纯逻辑，直接测
//   - 整个插件（main.ts）接到一个假的 Obsidian 上测，见 test/fake-obsidian.mjs
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.build');
rmSync(out, { recursive: true, force: true });

const common = { bundle: true, format: 'esm', platform: 'node', target: 'es2018', logLevel: 'warning' };

await esbuild.build({
	...common,
	entryPoints: ['frontmatter', 'logic', 'people'].map((name) => join(here, '..', 'src', `${name}.ts`)),
	outdir: out,
	outExtension: { '.js': '.mjs' },
});

await esbuild.build({
	...common,
	entryPoints: [join(here, 'plugin-entry.mjs')],
	outfile: join(out, 'plugin.mjs'),
	alias: { obsidian: join(here, 'fake-obsidian.mjs') },
	external: ['moment'],
});

const tests = readdirSync(here).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => join(here, name));
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
