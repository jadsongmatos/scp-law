# TODO — Murphy Law

Lista do que falta fazer no jogo. Cada item foi conferido no código, nos dados e
nos testes em 22 de outubro de 2026. As seções seguem a ordem de prioridade:
comece pelos bugs. Ao concluir um item que mexe em `src/game_data.json`, siga o
fluxo de edição de dados descrito no [AGENTS.md](AGENTS.md) (`fix:overlaps`,
auditoria de diálogos, `npm test`) e marque a caixa.

## Estado do repositório

A troca de arte de 22 de outubro de 2026 foi commitada em `826a04e`.

- [x] Commitar os 12 fundos novos (`src/assets/images/noir/bg_*.png`), o
      `src/game_data.json` reposicionado e as atualizações de `AGENTS.md` e
      `docs/plan-21-07-2026.md`.
- [x] Decidir o destino da folha original
      `src/assets/images/gpt-image-2.5-sunburst_a_Tem_muita_luz_elétri.png`.
      O jogo não a importa e ela não está no git. → **Decisão (22/10/2026):
      manter onde está, fora do git.**

## Bugs

Os dois problemas abaixo afetam o jogador ou destroem dados.

### P0: a investigação nunca chega a 100%

O percentual final divide por 14 itens (`INVESTIGATION_TOTAL`,
`src/App.tsx:45`): 5 depoimentos e 9 contatos. Dois contatos nunca entram na
agenda, então o máximo possível é 12/14 = 86%.

- `agente_scp` (Agente Stern) entrava na agenda no início do jogo até o commit
  `74fbb2c` (3 de outubro de 2026, migração para XState), que removeu o
  `useEffect` com `discoverContact('agente_scp')`.
- `wohltat` nunca teve código de descoberta.
- O campo `discoveredFrom` (`'auto'`, `'zeca_reveal'`, `'cartao_visita'`) não é
  lido por nenhum código.

Tarefas:

- [x] Escolher a correção → **implementado `discoveredFrom`** (revelar por
      diálogo): 'auto' entra na agenda no contexto inicial da máquina (com
      merge no `RESTORE_STATE` para saves antigos), `zeca_reveal` revela a
      Dra. Cunha no nó `zc_clue`, o item `cartao_visita` revela a diretora.
- [x] Adicionar um teste que falhe quando algum contato de `PHONE_CONTACTS` não
      tiver caminho de descobertura. → `src/lib/contactDiscovery.test.ts`

### P1: exportar no modo dev apaga dados

O botão de exportar do modo dev (`src/App.tsx:425-455`) grava só `ITEM_NAMES` e
`GAME_ROOMS`, com uma lista fixa de campos. Salvar o arquivo exportado por cima
de `src/game_data.json` apaga `PHONE_CONTACTS`, `_interviewClueMap`, `rain` e
`interviewGate`. Isso aconteceu em 22 de outubro de 2026.

- [x] Exportar a partir do `game_data.json` completo, trocando só as posições
      (ou exportar apenas um patch de posições). → `buildGameDataExport` em
      `src/lib/devExport.ts`
- [x] Extrair a montagem do export para uma função pura em `src/lib/` e testar
      que nenhum campo se perde. → `src/lib/devExport.test.ts`

## Arte

Em 22 de outubro de 2026 os 12 fundos passaram a ser os painéis da folha
`gpt-image-2.5-sunburst_a_Tem_muita_luz_elétri.png`. As hitboxes foram postas no
elemento mais plausível de cada cena, mas vários textos ainda descrevem a arte
antiga.

### Textos que não batem com a arte

Resolvido em 23/10/2026: decisão foi **reescrever os textos** (arte mantida);
descrições das 12 salas reescritas em `src/game_data.json`.

- [x] `escritorio`: o texto cita a placa "MURPHY LAW — PRIVATERMITTLER" na
      porta, um espelho no fichário (objeto já removido) e um telefone
      "escondido entre os papéis do fichário". A arte não tem porta (a saída
      `porta_rua` ficou no rodapé) e mostra três telefones sobre a mesa.
- [x] `rua_chuva`: o texto cita letreiro vermelho do Gasthof, porta azul na casa
      de Maria e poça vermelha. A arte mostra uma placa pendurada e uma porta de
      madeira, e a delegacia ficou na fachada da loja "Konsum".
- [x] `bar`: o texto cita toca-discos, barman, dois telefones de parede e porta
      dos fundos. Nada disso aparece: `toca_discos` está num armário cinza,
      `cabine_telefone` num quadro pequeno e `porta_armazem` num recuo da
      parede.
- [x] `diretoria`: o texto cita terminal de fósforo verde, armário de metal
      atrás de divisória e telefone. Nenhum aparece: o terminal ficou na pilha
      de papéis, o armário num móvel de madeira e o telefone num objeto preto da
      mesa.
- [x] `escola`: o texto diz que "a eletricidade foi cortada" e que "nenhuma
      lâmpada funciona", mas a arte tem uma lâmpada acesa no teto.
- [x] `delegacia`: não há mapa visível para `mapa_pinos`; a hitbox ficou nos
      papéis da borda direita.
- [x] `beco`: o texto de `grafite_parede` descreve uma criança numa gaiola com
      "ER KOMMT MIT SCHWARZEM WAGEN". A arte mostra o cartaz de propaganda
      "DAMALS JETZT IMMER DIE PARTEI" e um carro enferrujado sem interação.
- [x] `armazem`: o texto descreve um Lagerhaus urbano na Rua 14, com porta de
      aço com cadeado, terminal verde e carro preto pela fresta. A arte é um
      celeiro rural com feno, trator e portão aberto para o campo.
- [x] `casa_mae`: "Quarto de Helena" fala de cama, livro e gaveta, mas a cena é
      só a sala de estar; `quarto_helena` ficou na estante.
- [x] `igreja`: não há saída visível para a estrada de chão;
      `estrada_fazenda` ficou no canto dos bancos.
- [x] `fazenda`: o texto fala de propriedade abandonada, galinhas e celeiro com
      telhado caído. A arte mostra um casarão conservado, com janelas acesas;
      `anotacoes_caseiro` ficou na porta do casarão.
- [x] `hospital`: o texto diz "um corredor estreito", mas a arte é uma sala de
      espera com cadeiras.

### Qualidade e consistência

Estes itens não dependem dos textos.

- [ ] Gerar os fundos em alta resolução. Os painéis atuais têm cerca de
      480×280 px (os antigos tinham até 1672×941) e ficam borrados em telas
      grandes.
- [ ] Substituir os 3 mapas que ainda são o rato placeholder:
      `map_rua_chuva.png`, `map_bar.png` e `map_beco.png`
      (`src/assets/images/noir/maps/`). Os 12 mapas também misturam estilos
      (planta baixa, isométrico e 3D).
- [ ] Atualizar ou arquivar `docs/image-prompts-21-07-2026.md`, que cobre só 8
      salas e usa coordenadas da arte antiga.
- [ ] Refazer as hitboxes após qualquer nova troca de arte. Os scripts usados em
      22 de outubro de 2026 estão em `scratch/2026-10-22-fundos-gpt-image/`
      (fora do git); mova-os para `scripts/` se a arte mudar de novo.

## Plano de 21 de julho de 2026: encerrado (23/10/2026)

Todos os itens foram fechados — resoluções abaixo, detalhes em
`docs/plan-21-07-2026.md`.

- [x] `porta_armazem` (bar) ainda exige `fotografia` como `requiredItem` → **removida
      (23/10/2026, a536ded): a porta é travel livre; foto segue como prova.**
- [x] Contatos só via entrevista: Santos ainda entra na agenda pelo objeto
      `telefone_santos` (recado na delegacia). Ligado ao bug P0 → **superseded:
      P0 resolvido com descoberta orientada a dado (`discoveredFrom`), design
      aprovado — ver `contactDiscovery.ts` e o plano.**
- [x] `carta_jonas` deve exigir uma análise separada; hoje ela abre o diálogo
      direto → **feito (23/10/2026, 8b915be): carta é `terminal_read`; análise
      pela agenda (LER).**
- [x] `grafite_parede` como pista falsa: o texto atual aponta para o carro
      preto, que é pista verdadeira. Veja também o item `beco` em
      [Textos que não batem com a arte](#textos-que-não-batem-com-a-arte) →
      **feito (23/10/2026, 95aef40): grafite aponta para o carro enferrujado.**
- [x] Entrevista com Zeca de duas formas: na prática só existe a presencial. O
      contato entra na agenda ao interagir no bar, o que já inicia a conversa;
      ao encerrar, `END_PHONE_CALL` marca Zeca como ligado e a agenda só
      oferece "OUVIR FITA" → **feito (23/10/2026): telefone do bar é o recado
      (`terminal_read`); entrevista pelo encontro no balcão (`zeca_encontro`)
      ou pela agenda do escritório — uma entrevista por contato.**
- [x] `banco_cantos` deve virar pergunta na entrevista com Zeca; hoje ainda é um
      objeto `inspect` no bar → **feito (23/10/2026): objeto removido; pergunta
      no nó `zc_banco`; foto segue como pickup.**
- [x] Fechar no plano os itens obsoletos: os três sobre `puzzle_hint_*` e
      `puzzle_deduction_terminal` (removidos do jogo) e "montar prompts de
      geração de imagem" (substituído pela arte nova) → **fechados no
      `docs/plan-21-07-2026.md` (23/10/2026).**

## Áudio

As vozes ficam em `public/voice/` e tocam pelo id do objeto (`Audio.speak` em
`src/audio.ts`).

- [ ] Gerar voz para os 4 documentos sem MP3: `carta_maria_kraft`,
      `registro_paroquial`, `anotacoes_caseiro` e `arquivo_pacientes`
      (`npm run generate:voices`) → **1/4 feito (23/10/2026, 67f8a84):
      `arquivo_pacientes` ok. As 3 restantes dependem do backend do codec:
      com `--codec-cpu` o decode leva ~37 min por arquivo (RTF 77×) e o
      timeout de 600 s do script nunca fecha; avaliando `--codec-auto`
      (codec na GPU) antes de decidir.**
- [x] Decidir sobre os 21 MP3 órfãos (2,3 MB, que vão para o deploy) e as
      entradas correspondentes em `_metadata.json` e `_done.json` →
      **removidos (autorizado, commit 3065d9c)**; checkpoint `_done.json`
      reconstruído a partir dos 18 MP3s presentes.
- [x] Decidir o destino do campo `voice` (`feminine`/`masculine`) de
      `PHONE_CONTACTS`: nada o lê e os diálogos não têm voz → **mantido
      (23/10/2026): metadado para o TTS futuro dos diálogos — as vozes
      voltaram a ser pauta com os MP3s dos documentos.**

## Dívida técnica

Problemas internos que o jogador não vê.

- [x] `src/data.ts:84` importa `item_chave_armazem.png`, mas o item
      `chave_armazem` não existe em `ITEM_NAMES`. → import e entrada
      removidos (o png segue em `assets/`; scripts de geração ainda o usam).
- [x] `scripts/puzzle/noir_generator.py --merge` reinsere os `puzzle_hint_*`
      removidos. Só o AGENTS.md avisa; falta uma trava no próprio script.
      → **trava adicionada** (aborta em game_data pós-remoção sem
      `--reembed-hints`).
- [x] `KNOWN_ROOMS` em `scripts/vision/extract_positions.py` cobre só as 8 salas
      originais; faltam `casa_mae`, `igreja`, `fazenda` e `hospital`. → as 4
      salas adicionadas (12/12).
- [x] O chunk principal do build tem 815 kB, acima do limite de aviso de 750 kB
      (`vite.config.ts`). → **dividido**: index agora 108 kB; chunks separados
      para xterm (342), react-vendor (178), base-ui (124), game-data (82) e
      lazy `MuralOverlay` (31) + `DevInspector` (6, dev only).
