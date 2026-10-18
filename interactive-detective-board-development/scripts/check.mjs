import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const report = [];
const check = (name, value) => { assert.ok(value, name); report.push(name); console.log(`✓ ${name}`); };
const saved = () => page.waitForTimeout(650);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexo-workspace-v1')));
const current = async () => { const s = await state(); return s.cases.find(c => c.id === s.activeId); };
const clue = id => page.locator(`[data-clue-id="${id}"]`);
const pin = title => page.getByRole('button', { name: `Puxar fio de ${title}`, exact: true });
const point = async locator => { const b = await locator.boundingBox(); assert.ok(b, 'Element has a visible position'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const closeThread = async () => { if (await page.locator('.thread-editor').count()) await page.getByRole('button', { name: 'Fechar edição do fio', exact: true }).click(); };
const openLastThread = async () => {
  const p = await page.locator('.thread-hit').last().evaluate(path => {
    for (const fraction of [.5, .35, .65, .2, .8]) {
      const q = path.getPointAtLength(path.getTotalLength() * fraction).matrixTransform(path.getScreenCTM());
      const el = document.elementFromPoint(q.x, q.y);
      if (el === path || el?.closest('.rope-label')) return { x: q.x, y: q.y };
    }
    const q = path.getPointAtLength(path.getTotalLength() * .5).matrixTransform(path.getScreenCTM());
    return { x: q.x, y: q.y };
  });
  await page.mouse.click(p.x, p.y);
};

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready); await saved();
  check('Board fills over 90% of the desktop width', (await page.locator('.board-viewport').boundingBox()).width > 1440 * .9);
  check('The investigation cabinet is closed and inert by default', await page.locator('.sidebar').evaluate(el => el.inert && el.getBoundingClientRect().right < 0));
  check('Seven clues have real interactive pin handles', await page.locator('.evidence-card').count() === 7 && await page.locator('.pin-handle').count() === 7);
  check('All photographs and local fonts load', await page.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0) && document.fonts.check('22px Caveat') && document.fonts.check('12px "DM Sans"')));
  await page.screenshot({ path: 'artifacts/board-final-desktop.png' });

  await clue('elisa').click();
  check('Selecting a clue keeps the board open and shows compact actions', await page.locator('.card-quick-actions').count() === 1 && await page.locator('.inspector').count() === 0);
  await page.getByRole('button', { name: 'Detalhes de Elisa Monteiro', exact: true }).click();
  check('Full details are available on demand', await page.locator('.inspector h2').textContent() === 'Elisa Monteiro');
  await page.getByRole('button', { name: 'Fechar detalhes', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Elisa Monteiro', exact: true }).click();
  await page.getByLabel('Título da pista').fill('Elisa — revisão');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click(); await saved();
  check('Editing a clue preserves local storage', (await current()).clues.find(c => c.id === 'elisa').title === 'Elisa — revisão');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click(); await saved();
  check('Undo restores the original clue', (await current()).clues.find(c => c.id === 'elisa').title === 'Elisa Monteiro');
  await page.keyboard.press('Escape');

  const before = (await current()).clues.find(c => c.id === 'boletim');
  const startCard = await point(clue('boletim'));
  await page.mouse.move(startCard.x, startCard.y); await page.mouse.down(); await page.mouse.move(startCard.x + 60, startCard.y - 20, { steps: 9 }); await page.mouse.up(); await saved();
  const moved = (await current()).clues.find(c => c.id === 'boletim');
  check('Dragging paper moves the clue, not a connection', moved.x > before.x + 45 && moved.y < before.y);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click(); await saved();

  const fromPin = await point(pin('Elisa Monteiro')), toCard = await point(clue('marcos'));
  await page.mouse.move(fromPin.x, fromPin.y); await page.mouse.down(); await page.mouse.move(toCard.x, toCard.y, { steps: 16 });
  check('Pulling a pin displays a live cord without a mode switch', await page.locator('.live-thread-layer').count() === 1);
  check('The destination clue is highlighted and magnetically snapped', await page.locator('.wire-target').getAttribute('data-clue-id') === 'marcos');
  await page.screenshot({ path: 'artifacts/board-live-connection.png' });
  await page.mouse.up(); await saved();
  check('Dropping anywhere on a clue instantly creates the link', (await current()).connections.length === 8);
  check('Relationship editing stays inside the board, not in a modal', await page.locator('.thread-editor').count() === 1 && await page.locator('.modal-overlay').count() === 0);
  await page.getByRole('textbox', { name: 'Nome da relação', exact: true }).fill('Última pessoa a vê-la');
  await page.locator('.thread-editor').getByRole('button', { name: 'Fio Azul', exact: true }).click();
  await page.getByRole('button', { name: 'Anotar', exact: true }).click(); await saved();
  check('Relationship name and thread color persist', (await current()).connections.at(-1).label === 'Última pessoa a vê-la' && (await current()).connections.at(-1).color === '#4c6679');
  await openLastThread();
  check('Existing cords can be reopened directly on the board', await page.locator('.thread-editor').count() === 1);
  await page.getByRole('button', { name: 'Cortar este fio', exact: true }).click(); await saved();
  check('Scissors remove only the chosen cord', (await current()).connections.length === 7 && (await current()).clues.length === 7);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click(); await saved();
  check('Undo restores a cut cord, its label and its color', (await current()).connections.length === 8 && (await current()).connections.at(-1).color === '#4c6679');

  await pin('Elisa Monteiro').click();
  await clue('perguntas').locator('h3').click(); await saved();
  check('Clicking a pin and then a clue also connects them', (await current()).connections.length === 9);
  await closeThread();
  await pin('Elisa Monteiro').click(); await clue('perguntas').locator('h3').click(); await saved();
  check('Duplicate links reopen the existing cord instead of duplicating it', (await current()).connections.length === 9 && await page.locator('.thread-editor').count() === 1);
  await closeThread();

  await page.getByRole('button', { name: 'Usar fio Verde', exact: true }).click();
  await page.getByRole('button', { name: 'Conectar pistas', exact: true }).click();
  await clue('galeria').click(); await clue('boletim').click(); await saved();
  check('The visible spool tool supports two-card linking', (await current()).connections.length === 10);
  check('The spool palette applies the chosen color to new cords', (await current()).connections.at(-1).color === '#49685d');
  await closeThread(); await page.keyboard.press('Escape');

  await pin('Marcos Vale').click(); await pin('Marcos Vale').click();
  check('Clicking the same pin cancels instead of creating a self-link', await page.locator('.live-thread-layer').count() === 0 && (await current()).connections.length === 10);
  const cancelPin = await point(pin('Marcos Vale'));
  await page.mouse.move(cancelPin.x, cancelPin.y); await page.mouse.down(); await page.mouse.move(cancelPin.x + 80, cancelPin.y + 40, { steps: 6 }); await page.keyboard.press('Escape'); await page.mouse.up();
  check('Escape cancels a dragged cord even after releasing the pointer', await page.locator('.live-thread-layer').count() === 0 && await page.locator('.connection-hint').count() === 0);

  await pin('Elisa Monteiro').click();
  const boardBox = await page.locator('.board-viewport').boundingBox();
  await page.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + 28); await page.mouse.down(); await page.mouse.move(boardBox.x + boardBox.width / 2 + 54, boardBox.y + 42, { steps: 8 }); await page.mouse.up();
  check('The board can be panned while choosing the second clue', await page.locator('.live-thread-layer').count() === 1);
  await clue('marcos').click(); await saved(); await closeThread();
  check('Panning with a pending cord does not create accidental links', (await current()).connections.length === 10);
  await page.getByRole('button', { name: 'Ajustar quadro à tela', exact: true }).click();

  await page.getByRole('button', { name: 'Mostrar nomes das relações', exact: true }).click();
  check('Relationship labels can be shown together', await page.locator('.rope-label').count() === 10);
  await page.screenshot({ path: 'artifacts/board-relationship-labels.png' });
  await page.getByRole('button', { name: 'Mostrar nomes das relações', exact: true }).click();
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await page.locator('.filter-dropdown').getByRole('button', { name: /Anotação/ }).click();
  check('Filtering keeps context while fading unrelated clues', await page.locator('.filtered-out').count() === 6);
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click(); await page.locator('.filter-dropdown').getByRole('button', { name: /Todas as pistas/ }).click();
  await page.getByRole('button', { name: 'Concluir Ouvir Marcos Vale', exact: true }).click(); await saved();
  check('The physical checklist remains interactive', (await current()).clues.find(c => c.id === 'perguntas').items[0].done);

  const normalHeight = (await page.locator('.board-viewport').boundingBox()).height;
  await page.getByRole('button', { name: 'Modo foco', exact: true }).click(); await page.waitForTimeout(350);
  check('Focus mode gives the mural extra vertical space', (await page.locator('.board-viewport').boundingBox()).height > normalHeight + 60);
  await page.screenshot({ path: 'artifacts/board-focus.png' });
  await page.getByRole('button', { name: 'Sair do modo foco', exact: true }).click();
  await page.getByRole('button', { name: 'Tela cheia', exact: true }).click(); await page.waitForTimeout(300);
  check('Fullscreen retains the wooden frame', await page.evaluate(() => document.fullscreenElement?.classList.contains('wooden-frame')));
  await page.getByRole('button', { name: 'Nova anotação', exact: true }).click();
  check('Paper forms remain visible and usable in fullscreen', await page.locator('.modal-card').isVisible() && await page.locator('.modal-overlay').evaluate(el => document.fullscreenElement.contains(el)));
  await page.getByLabel('Título da pista').fill('Nota em tela cheia'); await page.locator('.modal-card').getByRole('button', { name: 'Adicionar pista', exact: true }).click(); await saved();
  check('New notes can actually be saved in fullscreen', (await current()).clues.length === 8);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click(); await saved();
  await page.evaluate(() => document.exitFullscreen()); await page.waitForTimeout(300);

  await page.keyboard.press('Control+k'); await page.getByRole('textbox', { name: 'Buscar pistas no caso', exact: true }).fill('curador');
  await page.locator('.search-result').filter({ hasText: 'Marcos Vale' }).click();
  check('Search brings you back to the matching clue on the board', await clue('marcos').evaluate(el => el.classList.contains('selected')) && await page.locator('.inspector').count() === 0);
  await page.keyboard.press('Escape');
  await page.locator('.view-tabs').getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  check('The timeline remains available behind its folder tab', await page.locator('.timeline-event').count() === 6);
  await page.locator('.view-tabs').getByRole('button', { name: /^Arquivos/ }).click();
  check('All photographs and documents remain in the case archive', await page.locator('.file-card').count() === 5);
  await page.getByRole('button', { name: 'Abrir Relatório de ocorrência', exact: true }).click(); await page.getByRole('button', { name: 'Fechar detalhes', exact: true }).click();
  check('Archive detail sheets also close correctly', await page.locator('.inspector').count() === 0);
  await page.locator('.view-tabs').getByRole('button', { name: 'Quadro de pistas', exact: true }).click();

  await page.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  const shareLink = await page.getByRole('textbox', { name: 'Link para compartilhar o caso', exact: true }).inputValue();
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await page.getByRole('button', { name: 'Copiado!', exact: true }).waitFor();
  check('A board snapshot can be copied and shared', await page.evaluate(() => navigator.clipboard.readText()) === shareLink);
  const exportWait = page.waitForEvent('download'); await page.getByRole('button', { name: /^Exportar investigação/ }).click();
  const exported = await exportWait; const exportData = JSON.parse(await fs.readFile(await exported.path(), 'utf8'));
  check('Export preserves the newly linked cords and their annotations', exportData.cases[0].connections.length === 10 && exportData.cases[0].connections.some(c => c.label === 'Última pessoa a vê-la'));
  await page.getByRole('button', { name: 'Fechar janela', exact: true }).click();
  const sharedContext = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const shared = await sharedContext.newPage(); await shared.goto(shareLink, { waitUntil: 'networkidle' });
  check('Shared snapshots open as independent, fully linked boards', await shared.locator('.thread-hit').count() === 10 && await shared.locator('.pin-handle').count() === 7);
  await sharedContext.close();

  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  check('Other investigations live in a functional cabinet drawer', await page.locator('.sidebar.mobile-open').count() === 1);
  await page.getByRole('button', { name: 'Nova investigação', exact: true }).click(); await page.getByLabel('Nome da investigação').fill('O novo quadro'); await page.getByRole('button', { name: 'Criar investigação', exact: true }).click(); await saved();
  check('A new case starts with an empty physical board', await page.locator('.empty-board').count() === 1 && (await current()).name === 'O novo quadro');
  await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({ name: 'investigacao.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exportData)) }); await saved();
  await page.reload({ waitUntil: 'networkidle' }); await saved();
  check('Import and reload retain all board data', (await current()).connections.length === 10 && await page.locator('.evidence-card').count() === 7);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage(); mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto('http://localhost:5173', { waitUntil: 'networkidle' }); await mobile.evaluate(() => document.fonts.ready); await mobile.waitForTimeout(300); await mobile.screenshot({ path: 'artifacts/board-final-mobile.png' });
  check('Mobile keeps a readable, touch-friendly pin', (await mobile.getByRole('button', { name: 'Puxar fio de Elisa Monteiro', exact: true }).boundingBox()).width >= 30);
  await mobile.getByRole('button', { name: 'Nova anotação', exact: true }).tap(); await mobile.getByLabel('Título da pista').fill('Pista no celular'); await mobile.getByLabel('Sua anotação').fill('Uma nova hipótese.'); await mobile.locator('.modal-card').getByRole('button', { name: 'Adicionar pista', exact: true }).tap(); await mobile.waitForTimeout(650);
  const mobileState = () => mobile.evaluate(() => { const w = JSON.parse(localStorage.getItem('nexo-workspace-v1')); return w.cases.find(c => c.id === w.activeId); });
  const newClue = (await mobileState()).clues.at(-1);
  const touchPin = await point(mobile.getByRole('button', { name: 'Puxar fio de Elisa Monteiro', exact: true })); const touchTarget = await point(mobile.locator(`[data-clue-id="${newClue.id}"]`));
  const cdp = await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchPin.x, y: touchPin.y, id: 1 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchPin.x + (touchTarget.x - touchPin.x) * i / 8, y: touchPin.y + (touchTarget.y - touchPin.y) * i / 8, id: 1 }] });
  check('Touch dragging also previews the cord and destination', await mobile.locator('.live-thread-layer').count() === 1 && await mobile.locator('.wire-target').count() === 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await mobile.waitForTimeout(650);
  check('Touch dragging creates the connection on a real pointer event', (await mobileState()).connections.length === 8);
  await mobile.getByRole('button', { name: 'Fechar edição do fio', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Puxar fio de Pista no celular', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Ajustar quadro à tela', exact: true }).tap(); await mobile.waitForTimeout(200);
  await mobile.locator('[data-clue-id="galeria"]').tap(); await mobile.waitForTimeout(650);
  check('Two taps work after using the overview zoom on mobile', (await mobileState()).connections.length === 9);
  await mobile.getByRole('button', { name: 'Fechar edição do fio', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Abrir menu', exact: true }).tap(); await mobile.locator('.main-nav').getByRole('button', { name: 'Linha do tempo', exact: true }).tap();
  check('Secondary case views remain accessible through the mobile cabinet', await mobile.locator('.timeline-event').count() === 6 && await mobile.locator('.sidebar.mobile-open').count() === 0);
  await mobileContext.close();
  check('No runtime errors occur in desktop or touch workflows', errors.length === 0);
  console.log(`\n${report.length} checks passed.`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/board-test-failure.png', fullPage: true });
  console.error(error); console.error('Runtime errors:', errors); process.exitCode = 1;
} finally { await browser.close(); }
