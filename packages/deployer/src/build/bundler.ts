import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { fileURLToPath } from 'node:url';
import { rollup, type InputOptions, type OutputOptions } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { optimizeLodashImports } from '@optimize-lodash/rollup-plugin';

import type { analyzeBundle } from './analyze';
import { removeDeployer } from './plugins/remove-deployer';
import { tsConfigPaths } from './plugins/tsconfig-paths';

export async function getInputOptions(
  entryFile: string,
  analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
  platform: 'node' | 'browser',
  env: Record<string, string> = { 'process.env.NODE_ENV': JSON.stringify('production') },
  { sourcemap = false }: { sourcemap?: boolean } = {},
): Promise<InputOptions> {
  let nodeResolvePlugin =
    platform === 'node'
      ? nodeResolve({
          preferBuiltins: true,
          exportConditions: ['node'],
        })
      : nodeResolve({
          preferBuiltins: false,
          browser: true,
        });

  const externalsCopy = new Set<string>();
  // make all nested imports external from the same package
  for (const external of analyzedBundleInfo.externalDependencies) {
    if (external.startsWith('@')) {
      const [scope, name] = external.split('/', 3);
      externalsCopy.add(`${scope}/${name}`);
      externalsCopy.add(`${scope}/${name}/*`);
    } else {
      externalsCopy.add(external);
      externalsCopy.add(`${external}/*`);
    }
  }

  const externals = Array.from(externalsCopy);

  const normalizedEntryFile = entryFile.replaceAll('\\', '/');
  return {
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    treeshake: 'smallest',
    preserveSymlinks: true,
    external: externals,
    plugins: [
      tsConfigPaths(),
      {
        name: 'alias-optimized-deps',
        // @ts-ignore
        resolveId(id) {
          if (!analyzedBundleInfo.dependencies.has(id)) {
            return null;
          }

          const isInvalidChunk = analyzedBundleInfo.invalidChunks.has(analyzedBundleInfo.dependencies.get(id)!);
          if (isInvalidChunk) {
            return {
              id,
              external: true,
            };
          }

          return {
            id: '.mastra/.build/' + analyzedBundleInfo.dependencies.get(id)!,
            external: false,
          };
        },
      },
      alias({
        entries: [
          {
            find: /^\#server$/,
            replacement: fileURLToPath(import.meta.resolve('@mastra/deployer/server')).replaceAll('\\', '/'),
          },
          {
            find: /^\@mastra\/server\/(.*)/,
            replacement: `@mastra/server/$1`,
            customResolver: id => {
              if (id.startsWith('@mastra/server')) {
                return {
                  id: fileURLToPath(import.meta.resolve(id)),
                };
              }
            },
          },
          { find: /^\#mastra$/, replacement: normalizedEntryFile },
        ],
      }),
      optimizeLodashImports(),
      {
        name: 'tools-rewriter',
        resolveId(id: string) {
          if (id === '#tools') {
            return {
              id: './tools.mjs',
              external: true,
            };
          }
        },
      },
      esbuild({
        target: 'node20',
        platform,
        minify: false,
        define: env,
      }),
      commonjs({
        extensions: ['.js', '.ts'],
        transformMixedEsModules: true,
        esmExternals(id) {
          return externals.includes(id);
        },
      }),
      nodeResolvePlugin,
      // for debugging
      // {
      //   name: 'logger',
      //   //@ts-ignore
      //   resolveId(id, ...args) {
      //     console.log({ id, args });
      //   },
      //   // @ts-ignore
      // transform(code, id) {
      //   if (code.includes('class Duplexify ')) {
      //     console.log({ duplex: id });
      //   }
      // },
      // },
      json(),
      removeDeployer(entryFile, { sourcemap }),
      // treeshake unused imports
      esbuild({
        include: entryFile,
        target: 'node20',
        platform,
        minify: false,
      }),
    ].filter(Boolean),
  } satisfies InputOptions;
}

export async function createBundler(
  inputOptions: InputOptions,
  outputOptions: Partial<OutputOptions> & { dir: string },
) {
  const bundler = await rollup(inputOptions);

  return {
    write: () => {
      return bundler.write({
        ...outputOptions,
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',
      });
    },
    close: () => {
      return bundler.close();
    },
  };
}
