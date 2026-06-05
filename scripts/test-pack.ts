import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { x } from 'tinyexec'

async function run(command: string, args: string[], cwd: string): Promise<string> {
  const result = await x(command, args, { nodeOptions: { cwd } })
  if (result.exitCode !== 0) {
    throw new Error([
      `$ ${command} ${args.join(' ')}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'))
  }
  return result.stdout
}

async function main(): Promise<void> {
  const root = process.cwd()
  const tmp = await mkdtemp(join(tmpdir(), 'kk-request-pack-'))

  try {
    const packOutput = await run('pnpm', ['pack', '--pack-destination', tmp], root)
    const tarballLine = packOutput
      .trim()
      .split('\n')
      .find(line => line.endsWith('.tgz'))

    if (!tarballLine) {
      throw new Error(`Unable to find packed tarball in pnpm pack output:\n${packOutput}`)
    }

    const tarball = tarballLine.startsWith('/')
      ? tarballLine
      : join(tmp, tarballLine)

    const contents = await run('tar', ['-tzf', tarball], root)
    for (const expected of [
      'package/dist/index.mjs',
      'package/dist/index.d.mts',
      'package/README.md',
      'package/LICENSE.md',
      'package/examples/basic.ts',
    ]) {
      if (!contents.includes(expected)) {
        throw new Error(`Packed tarball is missing ${expected}`)
      }
    }

    await writeFile(join(tmp, 'package.json'), JSON.stringify({
      type: 'module',
      dependencies: {
        '@kkfive/request': tarball,
        'typescript': '^6.0.3',
      },
      devDependencies: {
        '@types/node': '^24.12.3',
      },
    }, null, 2))

    await run('pnpm', ['install', '--ignore-scripts'], tmp)

    await writeFile(join(tmp, 'esm.mjs'), [
      'import { createClient, BusinessError, isHTTPError } from \'@kkfive/request\'',
      'if (typeof createClient !== \'function\') throw new Error(\'createClient export failed\')',
      'if (typeof BusinessError !== \'function\') throw new Error(\'BusinessError export failed\')',
      'if (typeof isHTTPError !== \'function\') throw new Error(\'ky guard export failed\')',
    ].join('\n'))

    await writeFile(join(tmp, 'types.ts'), [
      'import { createClient } from \'@kkfive/request\'',
      'const http = createClient({ prefix: \'https://api.example.com\' })',
      'const result: Promise<{ id: number }> = http.get<{ id: number }>(\'users/1\')',
      'void result',
    ].join('\n'))

    await writeFile(join(tmp, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['types.ts'],
    }, null, 2))

    await run('node', ['esm.mjs'], tmp)
    await run('pnpm', ['exec', 'tsc', '--noEmit'], tmp)
  }
  finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
