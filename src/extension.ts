import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('svelte5Crud.createCrudForm', async () => {
    // webView will have one column and show 'Create CRUD Form' in Command Palette
    // and on selection will call createCrudForm command on svelte5Crud.createCrudForm
    // the webView will have permission to execute scripts
    const panel = vscode.window.createWebviewPanel(
      'svelte5Crud',
      'Create CRUD Form',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    // Provide the HTML for the webview
    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(async (msg) => {
      // ----------------  COMMANDS ----------------
      if (msg.command === 'create') {
        const { componentName, fieldNames, routeName, markup } = msg.payload as { componentName: string, fieldNames: string[], routeName:string, markup: string };
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
        } catch (e) { /* ignore existing dir */ }

        try {
          await vscode.workspace.fs.createDirectory(routesFolder);
        } catch (e) { /* ignore existing dir */ }

        const componentUri = vscode.Uri.joinPath(componentsFolder, `${componentName}.svelte`);
        const pageUri = vscode.Uri.joinPath(routesFolder, `${routeName}/+page.svelte`);
        const serverUri = vscode.Uri.joinPath(routesFolder, `${routeName}/+page.server.ts`);

        // Write the Svelte component file (markup passed from webview)
        try {
          await vscode.workspace.fs.writeFile(componentUri, Buffer.from(markup, 'utf8'));
          // Write sample +page.server.ts only if not present - we will overwrite for simplicity
          const pageContent = getPageUIContent(`${componentName}`, );
          const serverContent = getSamplePageServerTs();
          await vscode.workspace.fs.writeFile(pageUri, Buffer.from(pageContent, 'utf8'));
          await vscode.workspace.fs.writeFile(serverUri, Buffer.from(serverContent, 'utf8'));

          vscode.window.showInformationMessage(`Created ${vscode.workspace.asRelativePath(componentUri)} and updated src/routes/+page.server.ts`);
          // Optionally open the created component in editor
          const doc = await vscode.workspace.openTextDocument(componentUri);
          await vscode.window.showTextDocument(doc, { preview: false });
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to create files: ${String(err)}`);
        }
      }
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

/** A helper that returns the webview HTML UI */
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
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
      label { display:inline-block; margin-top: .6rem; width:12rem;}
      input[type="text"] { width: 100%; padding: .4rem; margin-top: .2rem; box-sizing: border-box; }
      button { margin-top: .6rem; margin-right: .4rem; padding: .4rem .8rem; }
      .fieldset { margin-top: .8rem; border: 1px solid #ddd; padding: .6rem; border-radius:6px; }
      pre { background:#f6f6f6; padding:.6rem; overflow:auto; max-height:240px; border-radius:4px; }
      input{
        width: 12rem !important;
      }
      ul{
        list-style-type: none;
      }
      li{
        color: yellow !important;
      }
    </style>
  </head>
  <body>
    <h2>Create CRUD Form</h2>

    <label>CRUD Form Page Name
      <input id="componentName" type="text" />
    </label>

    <label>Route Folder Name
      <input id="routeName" type="text" />
    </label>

    <label>Prisma ORM Field Name
      <input id="fieldName" type="text"/>
    </label>

    <div style="margin-top:.5rem">
      <button id="addFieldBtn" disabled>Add Field Name</button>
      <button id="createBtn" disabled>Create CRUD Form Page</button>
    </div>

    <div class="fieldset">
      <strong>Candidate Fields</strong>
      <ul id="fieldsList"></ul>
    </div>


    <script>
      const vscode = acquireVsCodeApi();
      const componentNameEl = document.getElementById('componentName');
      const routeNameEl = document.getElementById('routeName');
      const fieldNameEl = document.getElementById('fieldName');
      const addBtn = document.getElementById('addFieldBtn');
      const createBtn = document.getElementById('createBtn');
      const fieldsList = document.getElementById('fieldsList');
      let markup = ''

      const fields = [];

      function updateButtons() {
        addBtn.disabled = !fieldNameEl.value.trim();
        createBtn.disabled = !componentNameEl.value.trim();
      }

      componentNameEl.addEventListener('input', updateButtons);
      routeNameEl.addEventListener('input', updateButtons);
      fieldNameEl.addEventListener('input', updateButtons);

      addBtn.addEventListener('click', () => {
        const v = fieldNameEl.value.trim();
        if (!v) return;
        fields.push(v);
        renderFields();
        fieldNameEl.value = '';
        updateButtons();
      });

      fieldNameEl.addEventListener('keydown', (event) => {
        alert('keydown');
        if (event.key !== 'Enter') return;
        // const v = fieldNameEl.value.trim();
        const v = event.target.value.trim()
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
      }

      function updateGenerated() {
        const componentName = componentNameEl.value.trim() || '__PAGE_NAME__';
        markup = \`${escapeBackticks(sampleMarkup)}\`.replace(/__PAGE_NAME__/g, componentName)
            .replace('__FIELDS_ARRAY__', JSON.stringify(fields, null, 2));
      }

      createBtn.addEventListener('click', () => {
        const componentName = componentNameEl.value.trim();
        const routeName = routeNameEl.value.trim();
        if (!componentName) return;
        const payload = {
          componentName,
          fieldNames: fields,
          routeName,
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
function getSvelteComponentTemplate(componentName: string, sampleFields: string[]): string {
  const fields = sampleFields.map(f => `    <input bind:value={form.${f.toLowerCase()}} placeholder="${f}" />`).join('\n');
  return `<script lang="ts">
  import { enhance } from '$app/forms';

  type TSampleFields = {
    ${sampleFields.map(f => `    ${f.toLowerCase()}: string;`).join('\n')}
  };

  const sampleFields = [${sampleFields.map(f => `'${f.toLowerCase()}'`).join(', ')}] as const;
  const form: TSampleFields = Object.fromEntries(sampleFields.map(key => [key, ''])) as TSampleFields;
</script>
<main>
  <form method="POST" use:enhance>
  ${fields}
    <button type="submit">Submit CRUD</button>
  </form>;
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
function getPageUIContent(compName:string):string{
  return `<script lang='ts'>
  import \`\${compName}\` from \`$lib/components/\${compName}.svelte';
  </script>
    <p>The Login Page</p>
    <\`\${compName}\`></\`\${compName}\`>
  `
}
function getSamplePageServerTs(): string {
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
function escapeBackticks(s: string) {
  return s.replace(/\`/g, '\\\`').replace(/<\/script>/g, '<\\/script>');
}
