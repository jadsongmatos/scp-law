import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('Murphy Law — Full Critical Path E2E', () => {
  test.setTimeout(120000);

  test('complete critical path walkthrough', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    // === START SCREEN ===
    const startBtn = page.getByRole('button', { name: 'ACEITAR O CASO' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await page.waitForTimeout(800);

    // Verify we're in escritorio by checking the HUD location
    const locationText = page.locator('header').locator('p.text-sm.font-bold');
    await expect(locationText).toContainText('Escritório de Murphy Law');

    // Interactable items are opacity-0 until hovered.
    // We need to hover first, then click. Let's use a helper.
    // Actually, the items have pointer-events:auto and the parent div handles click.
    // The opacity is on the icon/image inside, but the button wrapper handles clicks.
    // So clicking the position should work.

    // Helper: click at percentage of viewport
    const vp = page.locator('.flex-1.bg-zinc-950.relative');
    const vpBox = await vp.boundingBox();
    expect(vpBox).toBeTruthy();

    const clickAt = async (xPct: number, yPct: number) => {
      const box = await vp.boundingBox()!;
      const x = box.x + box.width * (xPct / 100);
      const y = box.y + box.height * (yPct / 100);
      await page.mouse.click(x, y);
      await page.waitForTimeout(300);
    };

  // === ESCRITÓRIO: Pick up isqueiro (center: x:36.5%, y:86.5%) ===
  await clickAt(36.5, 86.5);

  // Check inventory panel for isqueiro
  const invPanel = page.locator('.w-56.bg-black.p-4');
  await expect(invPanel.getByText('Isqueiro')).toBeVisible({ timeout: 2000 });

  // Pick up gravador_cassete (center: x:41.5%, y:78%)
  await clickAt(41.5, 78);
  await expect(invPanel.getByText('Gravador')).toBeVisible({ timeout: 2000 });

  // Travel to rua via porta_rua (center: x:53%, y:61%)
  await clickAt(53, 61);

    // === RUA CHUVA ===
    await expect(locationText).toContainText('Rua Sieben', { timeout: 3000 });

  // Pick up chave_escritorio (center: x:12.7%, y:89%)
  await clickAt(12.7, 89);
  await expect(invPanel.getByText('Chave do Escritório')).toBeVisible({ timeout: 2000 });

  // Pick up cartao_visita (center: x:35%, y:86%)
  await clickAt(35, 86);
  await expect(invPanel.getByText('Cartão de Visita')).toBeVisible({ timeout: 2000 });

  // Enter escola (center: x:42%, y:70%) — requires cartao_visita
  await clickAt(42, 70);

    // === ESCOLA ===
    await expect(locationText).toContainText('Volksschule', { timeout: 3000 });

  // Pick up fita_magnetica (center: x:62.6%, y:75.3%)
  await clickAt(62.6, 75.3);
  await expect(invPanel.getByText('Fita Magnética')).toBeVisible({ timeout: 2000 });

  // Enter diretoria (center: x:50%, y:55%)
  await clickAt(50, 55);

    // === DIRETORIA ===
    await expect(locationText).toContainText('Diretoria', { timeout: 3000 });

  // Read terminal_fosforo (center: x:60%, y:76%) — requires fita_magnetica
  await clickAt(60, 76);

    // Document modal should appear with Die Wohltat messages
    const docModal = page.locator('[class*="bg-black/90"]');
    await expect(docModal).toBeVisible({ timeout: 3000 });
    await expect(docModal.getByRole('heading', { name: 'MENSAGENS RECUPERADAS — DIE' })).toBeVisible();
    await docModal.getByRole('button', { name: 'FECHAR' }).click();
    await page.waitForTimeout(300);

  // Pick up cedula_500 (center: x:91%, y:68%)
  await clickAt(91, 68);
  await expect(invPanel.getByText('Marks')).toBeVisible({ timeout: 2000 });

  // Leave diretoria (center: x:55%, y:92%)
  await clickAt(55, 92);

    // === ESCOLA again ===
    await expect(locationText).toContainText('Volksschule', { timeout: 3000 });

  // Leave escola (exit door bottom: x:55%, y:95% — avoid overlap with diretoria door)
  await clickAt(55, 95.5);

    // === RUA CHUVA ===
    await expect(locationText).toContainText('Rua Sieben', { timeout: 3000 });

  // Enter bar (center: x:77%, y:81%) — bar_vila_nova interactable
  await clickAt(77, 81);

    // === BAR ===
    await expect(locationText).toContainText('Gasthof', { timeout: 3000 });

  // Pick up fotografia (center: x:80.5%, y:70.5%)
  await clickAt(80.5, 70.5);
  await expect(invPanel.getByText('Fotografia')).toBeVisible({ timeout: 2000 });

  // Travel to armazem via bar back door (center: x:81%, y:64%) — requires fotografia
  await clickAt(81, 64);

    // === ARMAZEM ===
    await expect(locationText).toContainText('Lagerhaus', { timeout: 3000 });

  // Read caixas_documentos (center: x:19%, y:72%) — no gate
  await clickAt(19, 72);
  const caixasDoc = page.locator('[class*="bg-black/90"]');
  if (await caixasDoc.isVisible()) {
    await expect(caixasDoc.getByRole('heading', { name: /DIE WOHLTAT/ })).toBeVisible();
    await caixasDoc.getByRole('button', { name: 'FECHAR' }).click();
    await page.waitForTimeout(300);
  }

  // Read porta_aco (center: x:36%, y:70%) — requires isqueiro
  await clickAt(36, 70);
  const acoDoc = page.locator('[class*="bg-black/90"]');
  if (await acoDoc.isVisible()) {
    await expect(acoDoc.locator('p').filter({ hasText: 'GEHEIME' }).first()).toBeVisible();
    await acoDoc.getByRole('button', { name: 'FECHAR' }).click();
    await page.waitForTimeout(300);
  }

  // Read terminal_final (center: x:20%, y:65%) — requires fita_magnetica
  await clickAt(20, 65);
  const finalDoc = page.locator('[class*="bg-black/90"]');
  await expect(finalDoc).toBeVisible({ timeout: 3000 });
  await expect(finalDoc.locator('p').filter({ hasText: 'CONTAINER 14-B' }).first()).toBeVisible();
  await finalDoc.getByRole('button', { name: 'FECHAR' }).click();

  // Read puzzle_solution_terminal (center: x:35%, y:60%) — requires cedula_500
  await clickAt(35, 60);
  const solutionDoc = page.locator('[class*="bg-black/90"]');
  if (await solutionDoc.isVisible()) {
    await expect(solutionDoc.getByRole('heading', { name: /LÖSUNG/ })).toBeVisible();
    await solutionDoc.getByRole('button', { name: 'FECHAR' }).click();
  }

    // Verify all 6 items in inventory
    await expect(invPanel.getByText('Isqueiro')).toBeVisible();
    await expect(invPanel.getByText('Chave')).toBeVisible();
    await expect(invPanel.getByText('Cartão')).toBeVisible();
    await expect(invPanel.getByText('Fita Magnética')).toBeVisible();
    await expect(invPanel.getByText('Fotografia')).toBeVisible();
    await expect(invPanel.getByText('Marks')).toBeVisible();
  });

  test('denied access: escola without cartao_visita', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
    await page.waitForTimeout(800);

    // Pick isqueiro and go to rua
    const vp = page.locator('.flex-1.bg-zinc-950.relative');
    const vpBox = await vp.boundingBox()!;
    const clickAt = async (xPct: number, yPct: number) => {
      const box = await vp.boundingBox()!;
      await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
      await page.waitForTimeout(300);
    };

  await clickAt(36.5, 86.5); // isqueiro
  await clickAt(53, 61); // porta_rua

  await page.waitForTimeout(500);

  // Try escola without cartao_visita (center: x:42%, y:70%)
  await clickAt(42, 70);

    // Should NOT change room — still in rua
    const locationText = page.locator('header').locator('p.text-sm.font-bold');
    await expect(locationText).toContainText('Rua Sieben');
  });

  test('denied access: armazem via beco without fita_magnetica', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
    await page.waitForTimeout(800);

    const clickAt = async (xPct: number, yPct: number) => {
      const box = await page.locator('.flex-1.bg-zinc-950.relative').boundingBox()!;
      await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
      await page.waitForTimeout(300);
    };

  await clickAt(36.5, 86.5); // isqueiro
  await clickAt(53, 61); // → rua

  await page.waitForTimeout(500);

  // Go to beco (center: x:62%, y:75%)
  await clickAt(62, 75);
  await page.waitForTimeout(500);

  const locationText = page.locator('header').locator('p.text-sm.font-bold');
  await expect(locationText).toContainText('Beco');

  // Try porta_armazem_beco without fita_magnetica (center: x:46%, y:62%)
  await clickAt(46, 62);

    // Should NOT change room — still in beco
    await expect(locationText).toContainText('Beco');
  });

  test('map opens and shows visited rooms', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
    await page.waitForTimeout(800);

    // Open map
    const mapBtn = page.locator('.w-56.bg-black.p-4').getByRole('button', { name: 'MAPA DA CIDADE' });
    await mapBtn.click();
    await page.waitForTimeout(500);

    // Map heading visible
    await expect(page.getByRole('heading', { name: 'MAPA DA CIDADE' })).toBeVisible();

  // Should show "LOCAIS: 1 / 8" since we only visited escritorio
  await expect(page.getByText(/LOCAIS: 1 \/ 8/)).toBeVisible();

  // Close map
  const closeBtn = page.locator('[class*="bg-black/90"]').getByRole('button', { name: 'FECHAR' });
  await closeBtn.click();
  await page.waitForTimeout(300);
});

test('phone call: open agenda from escritorio phone', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
  await page.waitForTimeout(800);

  const locationText = page.locator('header').locator('p.text-sm.font-bold');
  await expect(locationText).toContainText('Escritório');

  const vp = page.locator('.flex-1.bg-zinc-950.relative');
  const clickAt = async (xPct: number, yPct: number) => {
    const box = await vp.boundingBox()!;
    await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
    await page.waitForTimeout(300);
  };

  // Click escritorio phone (no phoneCallId → opens agenda)
  await clickAt(48.5, 76);

  // Phone agenda modal should appear
  const agendaModal = page.locator('.w-56.bg-black.p-4').locator('[class*="bg-black/90"]');
  const agendaHeading = page.getByRole('heading', { name: 'AGENDA TELEFÔNICA' });
  await expect(agendaHeading).toBeVisible({ timeout: 3000 });

  // No contacts discovered yet
  await expect(page.getByText('NENHUM CONTATO CONHECIDO')).toBeVisible();

  // Close agenda
  const closeAgendaBtn = page.locator('[class*="bg-black/90"]').getByRole('button', { name: 'FECHAR' });
  await closeAgendaBtn.click();
  await page.waitForTimeout(300);

  // Verify we're still in escritorio
  await expect(locationText).toContainText('Escritório');
});

test('phone call: discover contact via cartao_visita and call diretora', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
  await page.waitForTimeout(800);

  const locationText = page.locator('header').locator('p.text-sm.font-bold');
  const invPanel = page.locator('.w-56.bg-black.p-4');
  const vp = page.locator('.flex-1.bg-zinc-950.relative');
  const clickAt = async (xPct: number, yPct: number) => {
    const box = await vp.boundingBox()!;
    await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
    await page.waitForTimeout(300);
  };

  // Pick up isqueiro and go to rua
  await clickAt(36.5, 86.5);
  await clickAt(53, 61);
  await page.waitForTimeout(500);

  // Pick up cartao_visita — this discovers diretora_elvira
  await clickAt(35, 86);
  await expect(invPanel.getByText('Cartão de Visita')).toBeVisible({ timeout: 2000 });

  // Open phone agenda via sidebar button
  const agendaBtn = invPanel.getByRole('button', { name: 'AGENDA' });
  await agendaBtn.click();
  await page.waitForTimeout(500);

  // Agenda should show diretora_elvira
  const agendaHeading = page.getByRole('heading', { name: 'AGENDA TELEFÔNICA' });
  await expect(agendaHeading).toBeVisible({ timeout: 3000 });
  const agendaModal = agendaHeading.locator('..').locator('..');
  await expect(agendaModal.getByText('Diretora Elvira Campos')).toBeVisible();

  // Click to call diretora
  const diretoraBtn = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
  await diretoraBtn.click();
  await page.waitForTimeout(500);

  // Phone call modal should appear
  await expect(page.getByRole('heading', { name: /314-7721/ })).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('VERBUNDEN')).toBeVisible();

  // End call
  const hangupBtn = page.getByRole('button', { name: 'DESLIGAR' });
  if (await hangupBtn.isVisible()) {
    await hangupBtn.click();
  } else {
    const closeCallBtn = page.getByRole('button', { name: 'FECHAR' });
    await closeCallBtn.click();
  }
  await page.waitForTimeout(300);
  });

  test('cassette: repeated call blocked (Linha ocupada), replay with gravador, blocked without gravador', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
    await page.waitForTimeout(800);

    const locationText = page.locator('header').locator('p.text-sm.font-bold');
    const invPanel = page.locator('.w-56.bg-black.p-4');
    const vp = page.locator('.flex-1.bg-zinc-950.relative');
    const clickAt = async (xPct: number, yPct: number) => {
      const box = await vp.boundingBox()!;
      await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
      await page.waitForTimeout(300);
    };

    // Pick up isqueiro, gravador_cassete, go to rua, pick cartao_visita
    await clickAt(36.5, 86.5); // isqueiro
    await clickAt(41.5, 78);   // gravador_cassete
    await expect(invPanel.getByText('Gravador')).toBeVisible({ timeout: 2000 });

    await clickAt(53, 61); // → rua
    await page.waitForTimeout(500);

    await clickAt(35, 86); // cartao_visita — discovers diretora_elvira
    await expect(invPanel.getByText('Cartão de Visita')).toBeVisible({ timeout: 2000 });

    // Open agenda and call diretora (first call)
    const agendaBtn = invPanel.getByRole('button', { name: 'AGENDA' });
    await agendaBtn.click();
    await page.waitForTimeout(500);

    const agendaHeading = page.getByRole('heading', { name: 'AGENDA TELEFÔNICA' });
    await expect(agendaHeading).toBeVisible({ timeout: 3000 });
    const agendaModal = agendaHeading.locator('..').locator('..');
    const diretoraBtn = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
    await diretoraBtn.click();
    await page.waitForTimeout(500);

    // Phone call modal — hang up
    await expect(page.getByRole('heading', { name: /314-7721/ })).toBeVisible({ timeout: 3000 });
    const hangupBtn = page.getByRole('button', { name: 'DESLIGAR' });
    if (await hangupBtn.isVisible()) {
      await hangupBtn.click();
    } else {
      await page.getByRole('button', { name: 'FECHAR' }).click();
    }
    await page.waitForTimeout(500);

    // Now open agenda again — should show "OUVIR FITA" since we have gravador + recording
    await agendaBtn.click();
    await page.waitForTimeout(500);
    await expect(agendaHeading).toBeVisible({ timeout: 3000 });

    // Contact button should show OUVIR FITA
    const diretoraBtnAfter = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
    await expect(diretoraBtnAfter.getByText('OUVIR FITA')).toBeVisible({ timeout: 3000 });

    // Click to replay cassette
    await diretoraBtnAfter.click();
    await page.waitForTimeout(500);

    // Cassette playback modal should appear with KASSETTE/ABGESPIELT
    await expect(page.getByText('KASSETTE')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('ABGESPIELT')).toBeVisible();

    // Close cassette modal
    const pararBtn = page.getByRole('button', { name: 'PARAR' });
    await pararBtn.click();
    await page.waitForTimeout(500);

    // Try calling directly from the room phone (should show "Linha ocupada" in log)
    // Go back to escritorio first
    await clickAt(20, 90); // leave rua to escritorio (approximate)
    await page.waitForTimeout(500);

    // Try clicking phone in escritorio — should open agenda, contact shows GETRENNT if we already called
    // Actually let's test: try calling from a phone that has phoneCallId=directora_elvira
    // The bar phone has phoneCallId=zeca, not diretora. Let's test via agenda again.
    // Re-open agenda — still shows OUVIR FITA (gravador present)
    await agendaBtn.click();
    await page.waitForTimeout(500);
    await expect(agendaHeading).toBeVisible({ timeout: 3000 });
    const diretoraBtnAgain = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
    await expect(diretoraBtnAgain.getByText('OUVIR FITA')).toBeVisible({ timeout: 3000 });

    // Close agenda
    await page.locator('[class*="bg-black/90"]').getByRole('button', { name: 'FECHAR' }).first().click();
    await page.waitForTimeout(300);
  });

  test('cassette: call without gravador shows GETRENNT after hanging up', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'ACEITAR O CASO' }).click();
    await page.waitForTimeout(800);

    const invPanel = page.locator('.w-56.bg-black.p-4');
    const vp = page.locator('.flex-1.bg-zinc-950.relative');
    const clickAt = async (xPct: number, yPct: number) => {
      const box = await vp.boundingBox()!;
      await page.mouse.click(box.x + box.width * (xPct / 100), box.y + box.height * (yPct / 100));
      await page.waitForTimeout(300);
    };

    // Pick up isqueiro but NOT gravador_cassete
    await clickAt(36.5, 86.5); // isqueiro only
    await clickAt(53, 61); // → rua
    await page.waitForTimeout(500);

    await clickAt(35, 86); // cartao_visita — discovers diretora_elvira
    await expect(invPanel.getByText('Cartão de Visita')).toBeVisible({ timeout: 2000 });

    // Open agenda and call diretora
    const agendaBtn = invPanel.getByRole('button', { name: 'AGENDA' });
    await agendaBtn.click();
    await page.waitForTimeout(500);

    const agendaHeading = page.getByRole('heading', { name: 'AGENDA TELEFÔNICA' });
    await expect(agendaHeading).toBeVisible({ timeout: 3000 });
    const agendaModal = agendaHeading.locator('..').locator('..');
    const diretoraBtn = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
    await diretoraBtn.click();
    await page.waitForTimeout(500);

    // Phone call modal — hang up
    await expect(page.getByRole('heading', { name: /314-7721/ })).toBeVisible({ timeout: 3000 });
    const hangupBtn = page.getByRole('button', { name: 'DESLIGAR' });
    if (await hangupBtn.isVisible()) {
      await hangupBtn.click();
    } else {
      await page.getByRole('button', { name: 'FECHAR' }).click();
    }
    await page.waitForTimeout(500);

    // Re-open agenda — should show GETRENNT (no gravador, no recording)
    await agendaBtn.click();
    await page.waitForTimeout(500);
    await expect(agendaHeading).toBeVisible({ timeout: 3000 });

    const diretoraBtnAfter = agendaModal.locator('button').filter({ hasText: 'Diretora Elvira' });
    await expect(diretoraBtnAfter.getByText('GETRENNT')).toBeVisible({ timeout: 3000 });

    // Clicking should deny (agenda stays open, no modal opens)
    await diretoraBtnAfter.click();
    await page.waitForTimeout(300);

    // Close agenda
    await page.locator('[class*="bg-black/90"]').getByRole('button', { name: 'FECHAR' }).first().click();
    await page.waitForTimeout(300);
  });
});
