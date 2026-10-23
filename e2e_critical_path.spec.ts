import { test, expect, type Page } from '@playwright/test';

// E2E do caminho crítico — UX atual:
//  - interactables invisíveis: clique na hitbox (button[aria-label]) abre o menu
//    de contexto → "▸ Interagir" ou usar um item do inventário;
//  - itens permanentes iniciais: isqueiro + gravador_cassete;
//  - objetos com `requiredItem` destravam ao selecionar o item certo no menu;
//  - escola exige cartão E visita prévia à casa de Maria (casa_mae);
//  - modais base-ui fecham com Escape; modal de documento fecha com FECHAR.

const BASE = 'http://localhost:3000';

const ROOM = {
  escritorio: 'Escritório de Murphy Law',
  rua: 'Rua Sieben',
  casaMae: 'Casa de Maria Kraft',
  escola: 'Volksschule Vila Nova',
  diretoria: 'Diretoria',
  delegacia: 'Volkspolizeistation 8º',
  beco: 'Beco da Rua Sieben',
  bar: 'Gasthof Vila Nova',
  armazem: 'Lagerhaus 7',
} as const;

const ITEM = {
  isqueiro: 'Isqueiro de Prata',
  gravador: 'Gravador de Fita Cassete',
  cartao: 'Cartão de Visita — Vila Nova',
  fita: 'Fita Magnética Recuperada',
  foto: 'Fotografia Amassada',
  cedula: 'Cédula de 500 Marks',
} as const;

async function startGame(page: Page) {
  await page.goto(BASE);
  const btn = page.getByRole('button', { name: 'ACEITAR O CASO' });
  await expect(btn).toBeVisible();
  await btn.click();
  await expectRoom(page, ROOM.escritorio);
}

async function expectRoom(page: Page, room: string) {
  await expect(page.locator('header')).toContainText(room, { timeout: 10_000 });
}

async function openObjMenu(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: '▸ Interagir' })).toBeVisible();
}

async function interact(page: Page, label: string) {
  await openObjMenu(page, label);
  await page.getByRole('button', { name: '▸ Interagir' }).click();
}

async function useItem(page: Page, label: string, item: string) {
  await openObjMenu(page, label);
  await page.getByRole('button', { name: item, exact: true }).click();
}

async function readDocument(page: Page, title: string) {
  const modal = page.locator('.bg-black\\/90');
  await expect(modal.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 5_000 });
  await modal.getByRole('button', { name: 'FECHAR' }).click();
  await expect(modal).toBeHidden();
}

async function expectEvidence(page: Page, item: string) {
  await expect(page.locator('.w-56.bg-black').getByText(item, { exact: true })).toBeVisible({ timeout: 5_000 });
}

test.describe('Murphy Law — caminho crítico E2E', () => {
  test.setTimeout(120_000);

  test('walkthrough: itens, portas trancadas e terminais até a resolução', async ({ page }) => {
    await startGame(page);

    // Itens permanentes já presentes; evidências vazias.
    await expectEvidence(page, ITEM.isqueiro);
    await expectEvidence(page, ITEM.gravador);
    await expect(page.locator('.w-56.bg-black').getByText('VAZIO')).toBeVisible();

    // Rua: cartão de visita.
    await interact(page, 'Sair para a Rua');
    await expectRoom(page, ROOM.rua);
    await interact(page, 'Cartão no Asfalto');
    await expectEvidence(page, ITEM.cartao);

    // Casa de Maria primeiro — a escola exige motivo (gate casa_mae).
    await interact(page, 'Casa de Maria Kraft');
    await expectRoom(page, ROOM.casaMae);
    await interact(page, 'Voltar para a Rua Sieben');
    await expectRoom(page, ROOM.rua);

    // Escola: fachada trancada por cartão — usar o item no menu destrava e viaja.
    await interact(page, 'Volksschule Vila Nova');
    await expectRoom(page, ROOM.rua); // negado: ainda na rua
    await useItem(page, 'Volksschule Vila Nova', ITEM.cartao);
    await expectRoom(page, ROOM.escola);

    // Fita magnética no chão da escola.
    await interact(page, 'Fita Magnética no Chão');
    await expectEvidence(page, ITEM.fita);

    // Diretoria: gaveta (isqueiro), terminal de fósforo (fita) e cédulas.
    await interact(page, 'Entrar na Diretoria');
    await expectRoom(page, ROOM.diretoria);

    await interact(page, 'Gaveta Trancada'); // negado: trancada
    await expect(page.locator('.bg-black\\/90')).toBeHidden();
    await useItem(page, 'Gaveta Trancada', ITEM.isqueiro);
    await readDocument(page, 'ENVELOPE — FOTOS DE VIGILÂNCIA');

    await useItem(page, 'Terminal de Fósforo Verde', ITEM.fita);
    await readDocument(page, 'MENSAGENS RECUPERADAS — DIE WOHLTAT');

    await interact(page, 'Cédulas no Armário');
    await expectEvidence(page, ITEM.cedula);

    // De volta à rua e ao Gasthof: fotografia (prova) e porta dos fundos (livre).
    await interact(page, 'Sair da Diretoria');
    await expectRoom(page, ROOM.escola);
    await interact(page, 'Sair da Volksschule');
    await expectRoom(page, ROOM.rua);
    await interact(page, 'Gasthof Vila Nova');
    await expectRoom(page, ROOM.bar);
    await interact(page, 'Fotografia Amassada');
    await expectEvidence(page, ITEM.foto);

    await interact(page, 'Sair pelos Fundos — Lagerhaus 7');
    await expectRoom(page, ROOM.armazem);

    // Lagerhaus: caixas, porta de aço, terminal final e envelope da solução.
    await interact(page, 'Caixas com Documentos');
    await readDocument(page, 'DOKUMENTE — DIE WOHLTAT');

    await useItem(page, 'Porta de Aço com Cadeado', ITEM.isqueiro);
    await readDocument(page, 'ATRÁS DA PORTA DE AÇO');

    await useItem(page, 'Terminal de Fósforo — A Verdade', ITEM.fita);
    await readDocument(page, 'A ÚLTIMA PISTA — CONTAINER 14-B');

    await interact(page, 'Envelope Lacrado — Resolução do Caso'); // negado sem cédula
    await expect(page.locator('.bg-black\\/90')).toBeHidden();
    await useItem(page, 'Envelope Lacrado — Resolução do Caso', ITEM.cedula);
    await readDocument(page, 'LÖSUNG VERTRAULICH');

    // Inventário final: 5 evidências.
    for (const item of [ITEM.cartao, ITEM.fita, ITEM.cedula, ITEM.foto]) {
      await expectEvidence(page, item);
    }
  });

  test('acesso negado: escola sem cartão (e item errado não destrava)', async ({ page }) => {
    await startGame(page);
    await interact(page, 'Sair para a Rua');
    await expectRoom(page, ROOM.rua);

    await interact(page, 'Volksschule Vila Nova');
    await expectRoom(page, ROOM.rua);

    // Item errado: "não serve aqui" — também não viaja.
    await useItem(page, 'Volksschule Vila Nova', ITEM.isqueiro);
    await expectRoom(page, ROOM.rua);
  });

  test('acesso negado: porta do armazém pelo beco sem fita', async ({ page }) => {
    await startGame(page);
    await interact(page, 'Sair para a Rua');
    await expectRoom(page, ROOM.rua);
    await interact(page, 'Entrar no Beco');
    await expectRoom(page, ROOM.beco);

    await interact(page, 'Porta dos Fundos do Lagerhaus');
    await expectRoom(page, ROOM.beco);
  });

  test('mapa: abre, conta locais visitados e fecha', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: 'MAPA DA CIDADE' }).click();
    await expect(page.getByRole('heading', { name: 'MAPA DA CIDADE' })).toBeVisible();
    await expect(page.getByText('LOCAIS: 1 / 12')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'MAPA DA CIDADE' })).toBeHidden();
  });

  test('mural: depoimento descoberto vira cartão sozinho (sem criação manual)', async ({ page }) => {
    await startGame(page);

    // Descobre o depoimento de Seu Jonas no beco (envelope invisível).
    await interact(page, 'Sair para a Rua');
    await interact(page, 'Entrar no Beco');
    await expectRoom(page, ROOM.beco);
    await interact(page, 'Pista de Jonas — Entrevista');
    await readDocument(page, 'ENTREVISTA: SEU JONAS');

    // Abre o quadro: o depoimento já está preso — não há botão de adicionar.
    await page.getByRole('button', { name: 'MAPA DA CIDADE' }).click();
    await page.getByRole('dialog').getByText(ROOM.escritorio, { exact: true }).click();
    await expectRoom(page, ROOM.escritorio);
    await interact(page, 'Quadro de Investigações');
    const overlay = page.locator('.mural-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.board-plaque')).toContainText('MURAL PRINCIPAL');
    await expect(overlay.locator('.evidence-card h3')).toHaveText('Pista de Jonas — Entrevista');
    await expect(overlay.locator('.board-plaque')).toContainText('1 PISTAS');
    await expect(overlay.getByText('1 PISTA', { exact: true })).toBeVisible(); // status do grafo
    // Uma pista sozinha não é decisão de conexão: a denúncia fica bloqueada.
    await expect(overlay.getByRole('button', { name: 'Fazer a denúncia e encerrar o caso' })).toBeDisabled();

    // Fechar e reabrir: cartão persiste no contexto da máquina.
    await page.getByRole('button', { name: 'Fechar o mural' }).click();
    await expect(overlay).toBeHidden();
    await interact(page, 'Quadro de Investigações');
    await expect(overlay.locator('.evidence-card h3')).toHaveText('Pista de Jonas — Entrevista');
    await page.getByRole('button', { name: 'Fechar o mural' }).click();
  });

  test('agenda: descobrir Santos na delegacia, ligar e reouvir a fita', async ({ page }) => {
    await startGame(page);

    // Agenda começa com os contatos automáticos (P0: Stern e Wohltat eram
    // inalcançáveis — agora têm caminho de descoberta desde o início).
    await interact(page, 'Telefone de Discagem');
    await expect(page.getByRole('heading', { name: 'AGENDA TELEFÔNICA' })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: 'Agente Stern' })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: 'Wohltat' })).toBeVisible();
    await expect(page.getByText('NENHUM CONTATO CONHECIDO')).toBeHidden();
    await page.keyboard.press('Escape');

    // Delegacia: telefone descobre Santos na agenda (sem ligar fora do escritório).
    await interact(page, 'Sair para a Rua');
    await interact(page, 'Volkspolizeistation 8º');
    await expectRoom(page, ROOM.delegacia);
    await interact(page, 'Telefone — Recado de Santos');
    await expectRoom(page, ROOM.delegacia); // continua na delegacia
    await expect(page.getByRole('button', { name: /AGENDA/ })).toContainText('5'); // 4 auto + Santos

    // Volta ao escritório pelo mapa e liga.
    await page.getByRole('button', { name: 'MAPA DA CIDADE' }).click();
    await page.getByRole('dialog').getByText(ROOM.escritorio, { exact: true }).click();
    await expectRoom(page, ROOM.escritorio);

    await interact(page, 'Telefone de Discagem');
    const santosBtn = page.getByRole('button').filter({ hasText: 'Polizist Santos' });
    await expect(santosBtn).toBeVisible();
    await santosBtn.click();
    await expect(page.getByRole('heading', { name: /314-0089/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('VERBUNDEN')).toBeVisible();
    await page.keyboard.press('Escape'); // desliga

    // Reabrir agenda: chamada já feita → OUVIR FITA (gravador é permanente).
    await interact(page, 'Telefone de Discagem');
    await expect(santosBtn).toContainText('OUVIR FITA');
    await page.keyboard.press('Escape');

    // Fita cassete: reouvir a gravação.
    await page.getByRole('button', { name: /FITA CASSETE/ }).click();
    await expect(page.getByRole('heading', { name: 'FITA CASSETE' })).toBeVisible();
    await santosBtn.click();
    await expect(page.getByText('ABGESPIELT')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('— FIM DA FITA —')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('P0: contatos automáticos ligáveis do início (Agente Stern)', async ({ page }) => {
    await startGame(page);
    await interact(page, 'Telefone de Discagem');
    const sternBtn = page.getByRole('button').filter({ hasText: 'Agente Stern' });
    await sternBtn.click();
    await expect(page.getByText('VERBUNDEN')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape'); // desliga
  });

  test('delegacia: arquivo negado sem cédula; pistas continuam legíveis', async ({ page }) => {
    await startGame(page);
    await interact(page, 'Sair para a Rua');
    await interact(page, 'Volkspolizeistation 8º');
    await expectRoom(page, ROOM.delegacia);

    await interact(page, 'Arquivo do Kommissar Mendes'); // negado sem cédula
    await expect(page.locator('.bg-black\\/90')).toBeHidden();
    await expectRoom(page, ROOM.delegacia);

    // O quadro de dedução 5×5 saiu do jogo: o depoimento de Santos abre
    // como documento comum (e vira cartão do mural ao ser lido).
    await interact(page, 'Pista de Santos — Entrevista');
    await readDocument(page, 'ENTREVISTA: POLIZIST SANTOS');
  });

  test('persistência: CONTINUAR restaura sala e depoimento no mural', async ({ page }) => {
    await startGame(page);

    // Descobre o depoimento de Seu Jonas no beco e fecha o documento.
    await interact(page, 'Sair para a Rua');
    await interact(page, 'Entrar no Beco');
    await expectRoom(page, ROOM.beco);
    await interact(page, 'Pista de Jonas — Entrevista');
    await readDocument(page, 'ENTREVISTA: SEU JONAS');

    // Recarrega: CONTINUAR deve restaurar sala + mural.
    await page.reload();
    await page.getByRole('button', { name: 'CONTINUAR' }).click();
    await expectRoom(page, ROOM.beco);

    await page.getByRole('button', { name: 'MAPA DA CIDADE' }).click();
    await page.getByRole('dialog').getByText(ROOM.escritorio, { exact: true }).click();
    await expectRoom(page, ROOM.escritorio);
    await interact(page, 'Quadro de Investigações');
    const overlay = page.locator('.mural-overlay');
    await expect(overlay.locator('.evidence-card h3')).toHaveText('Pista de Jonas — Entrevista');
    await page.getByRole('button', { name: 'Fechar o mural' }).click();
  });

  test('denúncia: exige conectar os depoimentos no quadro antes de encerrar', async ({ page }) => {
    await startGame(page);

    // Dois depoimentos: Seu Jonas (beco) e Zeca do Gasthof (bar).
    await interact(page, 'Sair para a Rua');
    await interact(page, 'Entrar no Beco');
    await expectRoom(page, ROOM.beco);
    await interact(page, 'Pista de Jonas — Entrevista');
    await readDocument(page, 'ENTREVISTA: SEU JONAS');
    await interact(page, 'Voltar para a Rua');
    await expectRoom(page, ROOM.rua);
    await interact(page, 'Gasthof Vila Nova');
    await expectRoom(page, ROOM.bar);
    await interact(page, 'Pista de Gasthof — Entrevista');
    await readDocument(page, 'ENTREVISTA: ZECA DO GASTHOF');

    await page.getByRole('button', { name: 'MAPA DA CIDADE' }).click();
    await page.getByRole('dialog').getByText(ROOM.escritorio, { exact: true }).click();
    await expectRoom(page, ROOM.escritorio);
    await interact(page, 'Quadro de Investigações');
    const overlay = page.locator('.mural-overlay');
    const accuse = overlay.getByRole('button', { name: 'Fazer a denúncia e encerrar o caso' });

    // Duas pistas soltas: o jogador ainda não decidiu as conexões.
    await expect(overlay.locator('.board-plaque')).toContainText('2 PISTAS · 0 FIOS');
    await expect(overlay.getByText('2 GRUPOS SOLTOS', { exact: true })).toBeVisible();
    await expect(accuse).toBeDisabled();

    // Conecta os dois depoimentos: alfinete de um, alfinete do outro.
    await overlay.getByRole('button', { name: 'Puxar fio de Pista de Jonas — Entrevista' }).click();
    await overlay.getByRole('button', { name: 'Puxar fio de Pista de Gasthof — Entrevista' }).click();
    await expect(overlay.locator('.board-plaque')).toContainText('2 PISTAS · 1 FIO');
    await expect(overlay.getByText('GRAFO CONEXO ✓ (+50)', { exact: true })).toBeVisible();
    await expect(accuse).toBeEnabled();
    await overlay.getByRole('button', { name: 'Fechar edição do fio' }).click();

    // Encerra o caso: 2 de 14 itens → 14%; 2×10 + 1×5 + 50 = 75 pontos.
    await accuse.click();
    await expect(overlay).toBeHidden();
    await expect(page.getByText('ARQUIVO FECHADO')).toBeVisible();
    await expect(page.getByText('CONCLUSÃO DO CASO')).toBeVisible();
    await expect(page.getByText('14%')).toBeVisible();
    await expect(page.getByText('PONTOS DO MURAL')).toBeVisible();
    await expect(page.getByText('75', { exact: true })).toBeVisible();
    await expect(page.getByText('2 × 10 = 20')).toBeVisible();
    await expect(page.getByText('1 × 5 = 5')).toBeVisible();
    await expect(page.getByText('Grafo conexo', { exact: true })).toBeVisible();
    await expect(page.getByText('+50', { exact: true })).toBeVisible();
  });
});
