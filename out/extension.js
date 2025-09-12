"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    const disposable = vscode.commands.registerCommand('svelte5Crud.createCrudForm', async () => {
        const panel = vscode.window.createWebviewPanel('svelte5Crud', 'Create CRUD Form', vscode.ViewColumn.One, { enableScripts: true });
        // Provide the HTML for the webview
        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'create') {
                const { pageName, fieldNames, markup } = msg.payload;
                if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage('Open a workspace/folder first to create files.');
                    return;
                }
                const rootUri = vscode.workspace.workspaceFolders[0].uri;
                // Ensure directories exist: src/lib/components and src/routes
                const componentsFolder = vscode.Uri.joinPath(rootUri, 'src', 'lib', 'components');
                const routesFolder = vscode.Uri.joinPath(rootUri, 'src', 'routes');
                try {
                    await vscode.workspace.fs.createDirectory(componentsFolder);
                }
                catch (e) { /* ignore existing dir */ }
                try {
                    await vscode.workspace.fs.createDirectory(routesFolder);
                }
                catch (e) { /* ignore existing dir */ }
                const componentUri = vscode.Uri.joinPath(componentsFolder, `${pageName}.svelte`);
                const serverUri = vscode.Uri.joinPath(routesFolder, '+page.server.ts');
                // Write the Svelte component file (markup passed from webview)
                try {
                    await vscode.workspace.fs.writeFile(componentUri, Buffer.from(markup, 'utf8'));
                    // Write sample +page.server.ts only if not present - we will overwrite for simplicity
                    const serverContent = getSamplePageServerTs();
                    await vscode.workspace.fs.writeFile(serverUri, Buffer.from(serverContent, 'utf8'));
                    vscode.window.showInformationMessage(`Created ${vscode.workspace.asRelativePath(componentUri)} and updated src/routes/+page.server.ts`);
                    // Optionally open the created component in editor
                    const doc = await vscode.workspace.openTextDocument(componentUri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to create files: ${String(err)}`);
                }
            }
        });
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
/** A small helper that returns the webview HTML UI */
function getWebviewContent(webview, extensionUri) {
    // We send the svelte markup template prefilled for the webview to display and to write to disk.
    // The markup uses Svelte 5 runes mode and use:enhance (SvelteKit).
    const sampleMarkup = getSvelteComponentTemplate('__PAGE_NAME__', ['id', 'name']);
    // Escape for use in HTML string
    const escapedMarkup = sampleMarkup.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Create CRUD Form</title>
    <style>
      body { font-family: sans-serif; padding: 1rem; }
      label { display:block; margin-top: .6rem; }
      input[type="text"] { width: 100%; padding: .4rem; margin-top: .2rem; box-sizing: border-box; }
      button { margin-top: .6rem; margin-right: .4rem; padding: .4rem .8rem; }
      .fieldset { margin-top: .8rem; border: 1px solid #ddd; padding: .6rem; border-radius:6px; }
      pre { background:#f6f6f6; padding:.6rem; overflow:auto; max-height:240px; border-radius:4px; }
      input{
        width: 12rem;
      }
      ul{
        list-style-type: none;
        colorL navy;
      }
    </style>
  </head>
  <body>
    <h2>Create CRUD Form</h2>

    <label>CRUD Form Page Name
      <input id="pageName" type="text" />
    </label>

    <label>Prisma ORM Field Name
      <input id="fieldName" type="text" />
    </label>

    <div style="margin-top:.5rem">
      <button id="addFieldBtn" disabled>Add Field Name</button>
      <button id="createBtn" disabled>Create CRUD Form Page</button>
    </div>

    <div class="fieldset">
      <strong>Candidate Fields</strong>
      <ul id="fieldsList"></ul>
    </div>

    <div style="margin-top:1rem">
      <strong>Generated Svelte markup (preview)</strong>
      <pre id="generated">${escapedMarkup}</pre>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const pageNameEl = document.getElementById('pageName');
      const fieldNameEl = document.getElementById('fieldName');
      const addBtn = document.getElementById('addFieldBtn');
      const createBtn = document.getElementById('createBtn');
      const fieldsList = document.getElementById('fieldsList');
      const generated = document.getElementById('generated');

      const fields = [];

      function updateButtons() {
        addBtn.disabled = !fieldNameEl.value.trim();
        createBtn.disabled = !pageNameEl.value.trim();
      }

      pageNameEl.addEventListener('input', updateButtons);
      fieldNameEl.addEventListener('input', updateButtons);

      addBtn.addEventListener('click', () => {
        const v = fieldNameEl.value.trim();
        if (!v) return;
        fields.push(v);
        renderFields();
        fieldNameEl.value = '';
        updateButtons();
      });

      function renderFields() {
        fieldsList.innerHTML = '';
        for (const f of fields) {
          const li = document.createElement('li');
          li.textContent = f;
          fieldsList.appendChild(li);
        }
        // update generated preview to embed fields and pageName
        updateGenerated();
      }

      function updateGenerated() {
        const pageName = pageNameEl.value.trim() || '__PAGE_NAME__';
        const markup = \`${escapeBackticks(sampleMarkup)}\`.replace(/__PAGE_NAME__/g, pageName)
            .replace('__FIELDS_ARRAY__', JSON.stringify(fields, null, 2));
        generated.textContent = markup;
      }

      createBtn.addEventListener('click', () => {
        const pageName = pageNameEl.value.trim();
        if (!pageName) return;
        const payload = {
          pageName,
          fieldNames: fields,
          markup: generated.textContent
        };
        vscode.postMessage({ command: 'create', payload });
      });

      // helper to escape backticks and closing script markers
      function escapeBackticks(s) {
        return s.replace(/\`/g, '\\\`').replace(/<\\/script>/g, '<\\\\/script>');
      }

      // update initial state
      updateButtons();
      updateGenerated();
    </script>
  </body>
</html>`;
}
/** Template generator for the Svelte component to be written to disk */
function getSvelteComponentTemplate(pageName, sampleFields) {
    const fieldsArrayPlaceholder = '__FIELDS_ARRAY__';
    return `<svelte:options runes={true} />
<script lang="ts">
  // Svelte 5 runes / signals style
  import { enhance } from '@sveltejs/kit';

  // declare reactive state with $state (runes)
  let pageName = $state('${pageName}');
  let fieldName = $state('');
  let fieldNames = $state(${fieldsArrayPlaceholder || JSON.stringify(sampleFields)});

  function addFieldName() {
    if (fieldName) {
      fieldNames.push(fieldName);
      fieldName = '';
    }
  }

  async function createFormPage() {
    // This button is just a UI hook in the generated component.
    // The real creation of files is done by the extension in the workspace.
    // For runtime, you could post to endpoints or do other behavior here.
    // Here we just log.
    console.log('createFormPage called', pageName, fieldNames);
  }
</script>

<svelte:head>
  <title>CRUD Form: {pageName}</title>
</svelte:head>

<main>
  <h1>CRUD Form: {pageName}</h1>

  <label>
    CRUD Form Page Name
    <input type="text" bind:value={pageName} />
  </label>

  <label>
    Prisma ORM Field Name
    <input type="text" bind:value={fieldName} />
  </label>

  <div style="margin-top:.5rem;">
    <button onclick={addFieldName} disabled={!fieldName}>Add Field Name</button>
    <button onclick={createFormPage} disabled={!pageName}>Create CRUD Form Page</button>
  </div>

  <section class="candidate">
    <h2>Candidate Fields</h2>
    <ul>
      {#each fieldNames as fn}
        <li>{fn}</li>
      {/each}
    </ul>
  </section>

  <section style="margin-top:1rem">
    <form method="POST" use:enhance>
      <!-- basic example: generate inputs for candidate fields -->
      {#each fieldNames as fn (fn)}
        <label>
          {fn}
          <input name={fn} />
        </label>
      {/each}

      <div style="margin-top:.5rem;">
        <button type="submit">Save</button>
      </div>
    </form>
  </section>
</main>

<style>
  main { padding: 1rem; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
  label { display:block; margin-top:.6rem; }
  input { display:block; margin-top:.2rem; padding:.4rem; min-width:220px; }
  button[disabled] { opacity: .5; cursor: not-allowed; }
</style>
`;
}
/** Small helper that returns a new +page.server.ts with simple CRUD stubs */
function getSamplePageServerTs() {
    return `import type { Actions } from './$types';

/**
 * Sample CRUD actions. Replace with your prisma logic.
 * This file is placed at src/routes/+page.server.ts by the extension.
 */

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    // parse form values and call your Prisma client here
    // Example:
    // const data = Object.fromEntries(form);
    // await prisma.model.create({ data });
    return { success: true };
  },

  update: async ({ request }) => {
    const form = await request.formData();
    // update logic
    return { success: true };
  },

  delete: async ({ request }) => {
    const form = await request.formData();
    // delete logic
    return { success: true };
  }
};
`;
}
/** Helper to escape backticks for inline template usage */
function escapeBackticks(s) {
    return s.replace(/\`/g, '\\\`').replace(/<\/script>/g, '<\\/script>');
}
//# sourceMappingURL=extension.js.map