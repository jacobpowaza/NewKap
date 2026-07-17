import test from 'ava';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

test('preload exposes the cropper bridge in Electron sandbox', t => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'main', 'preload.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019
    }
  }).outputText;

  let exposedApi: any;
  const sentMessages: any[][] = [];
  const electron = {
    contextBridge: {
      exposeInMainWorld: (_name: string, api: any) => {
        exposedApi = api;
      }
    },
    ipcRenderer: {
      invoke: () => undefined,
      on: () => undefined,
      off: () => undefined,
      once: () => undefined,
      send: (...args: any[]) => sentMessages.push(args),
      sendSync: () => 1
    }
  };
  const requiredModules: string[] = [];

  vm.runInNewContext(compiled, {
    exports: {},
    require: (moduleName: string) => {
      requiredModules.push(moduleName);
      if (moduleName === 'electron') {
        return electron;
      }

      throw new Error(`Sandboxed preload cannot require ${moduleName}`);
    }
  });

  exposedApi.cropper.rendererReady({sessionId: 7});

  t.deepEqual(requiredModules, ['electron']);
  t.deepEqual(sentMessages, [['cropper-renderer-ready', {sessionId: 7}]]);
});
