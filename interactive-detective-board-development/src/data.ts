export type ClueType = 'person' | 'location' | 'note' | 'document' | 'recording' | 'checklist';
export type Page = 'overview' | 'board' | 'timeline' | 'files';
export type ToolMode = 'select' | 'hand' | 'connect';

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Clue {
  id: string;
  type: ClueType;
  title: string;
  subtitle: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  image?: string;
  imagePosition?: string;
  color?: string;
  badge?: string;
  fileName?: string;
  fileData?: string;
  tags: string[];
  items?: ChecklistItem[];
  createdAt: string;
}
export interface Connection { id: string; from: string; to: string; label: string; color: string }
export interface TimelineEvent { id: string; title: string; description: string; date: string; clueId?: string }
export interface Investigation {
  id: string;
  name: string;
  number: string;
  description: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
  clues: Clue[];
  connections: Connection[];
  events: TimelineEvent[];
  tasks: ChecklistItem[];
}

export const typeLabels: Record<ClueType, string> = {
  person: 'Pessoa', location: 'Local', note: 'Anotação', document: 'Documento', recording: 'Registro', checklist: 'Lista de tarefas',
};
export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const date = '2024-10-15T15:42:00';

export const initialCases: Investigation[] = [
  {
    id: 'aurora', name: 'O caso Aurora', number: '0142', status: 'active',
    description: 'Na noite de abertura de sua exposição, a artista Elisa Monteiro desapareceu. Vinte e oito minutos depois, o alarme da Galeria Aurora disparou. Uma obra também sumiu. Coincidência ou parte do mesmo plano?',
    createdAt: '2024-10-14T23:06:00', updatedAt: date,
    clues: [
      {
        id: 'elisa', type: 'person', title: 'Elisa Monteiro', subtitle: 'ARTISTA · 28 ANOS',
        content: 'Artista responsável pela exposição “Entre o silêncio e a luz”. Foi vista pela última vez saindo pela lateral da Galeria Aurora. Seu celular está desligado desde as 22h03.',
        x: 120, y: 89, width: 224, height: 288, rotation: -4,
        image: '/images/elisa.jpg', imagePosition: '50% 32%', badge: 'DESAPARECIDA', tags: ['Pessoa central', 'Desaparecimento'], createdAt: date,
      },
      {
        id: 'galeria', type: 'location', title: 'Galeria Aurora', subtitle: 'RUA DO CARMO, 142 · CENTRO',
        content: 'Local do vernissage. A câmera 02 cobre a saída lateral. O alarme disparou às 22h15, mas a porta dos fundos não tinha sinais de arrombamento.',
        x: 503, y: 62, width: 282, height: 268, rotation: 2.5,
        image: '/images/galeria.jpg', badge: 'LOCAL DO DESAPARECIMENTO', tags: ['Cena do caso', 'Câmeras'], createdAt: date,
      },
      {
        id: 'intervalo', type: 'note', title: '28 minutos.', subtitle: 'UMA PEÇA QUE NÃO ENCAIXA',
        content: 'Elisa saiu às 21h47.\nO alarme tocou às 22h15.\n\nO que aconteceu nesse intervalo?',
        x: 959, y: 99, width: 237, height: 246, rotation: 4,
        color: 'yellow', tags: ['Hipótese', 'Prioridade'], createdAt: date,
      },
      {
        id: 'boletim', type: 'document', title: 'Relatório de ocorrência', subtitle: 'PROTOCOLO Nº 2024–0142',
        content: 'Uma chamada anônima relatou movimentação na saída dos fundos da Galeria Aurora.\n\nA porta não apresentava sinais de arrombamento. Nenhum objeto pessoal foi encontrado no local.',
        x: 124, y: 430, width: 276, height: 283, rotation: -2,
        badge: 'CONFIDENCIAL', fileName: 'BO_2024-0142.pdf', tags: ['Oficial', 'Depoimento'], createdAt: date,
      },
      {
        id: 'camera', type: 'recording', title: 'O último registro', subtitle: 'CÂMERA 02 · SAÍDA LATERAL',
        content: '21h47min08s. A imagem registra a última passagem de Elisa pela saída lateral. Há uma segunda silhueta próxima à porta, ainda não identificada.',
        x: 422, y: 356, width: 202, height: 145, rotation: -5,
        image: '/images/galeria.jpg', badge: '21:47:08', tags: ['Câmera 02', 'Evidência'], createdAt: date,
      },
      {
        id: 'marcos', type: 'person', title: 'Marcos Vale', subtitle: 'CURADOR DA GALERIA',
        content: 'Responsável pela organização da exposição. Foi a última pessoa a conversar com Elisa. Afirma ter deixado a galeria às 21h30, mas isso ainda não foi confirmado.',
        x: 616, y: 448, width: 220, height: 265, rotation: 3,
        image: '/images/marcos.jpg', imagePosition: '50% 34%', badge: 'PESSOA DE INTERESSE', tags: ['Depoimento pendente', 'Curador'], createdAt: date,
      },
      {
        id: 'perguntas', type: 'checklist', title: 'Pontas soltas', subtitle: 'NÃO DEIXAR PASSAR',
        content: 'O telefone ficou mudo às 22h03. Por quê?',
        x: 947, y: 434, width: 253, height: 277, rotation: -3,
        items: [
          { id: 't1', text: 'Ouvir Marcos Vale', done: false },
          { id: 't2', text: 'Revisar a câmera 02', done: false },
          { id: 't3', text: 'Rastrear o celular', done: false },
        ], tags: ['Próximos passos'], createdAt: date,
      },
    ],
    connections: [
      { id: 'c1', from: 'elisa', to: 'galeria', label: 'Vista pela última vez', color: '#a13d35' },
      { id: 'c2', from: 'galeria', to: 'intervalo', label: 'Intervalo não explicado', color: '#a13d35' },
      { id: 'c3', from: 'elisa', to: 'boletim', label: 'Desaparecimento registrado', color: '#a13d35' },
      { id: 'c4', from: 'galeria', to: 'marcos', label: 'Responsável pela galeria', color: '#a13d35' },
      { id: 'c5', from: 'elisa', to: 'camera', label: 'Última imagem', color: '#a13d35' },
      { id: 'c6', from: 'marcos', to: 'perguntas', label: 'Depoimento pendente', color: '#a13d35' },
      { id: 'c7', from: 'intervalo', to: 'perguntas', label: 'Investigar os 28 minutos', color: '#a13d35' },
    ],
    events: [
      { id: 'e1', title: 'A exposição abre as portas', description: 'Início do vernissage “Entre o silêncio e a luz”, na Galeria Aurora.', date: '2024-10-14T19:00:00', clueId: 'galeria' },
      { id: 'e2', title: 'A conversa com o curador', description: 'Uma testemunha vê Elisa e Marcos conversando perto da entrada.', date: '2024-10-14T21:30:00', clueId: 'marcos' },
      { id: 'e3', title: 'O último registro de Elisa', description: 'A câmera 02 registra Elisa saindo pela lateral da galeria.', date: '2024-10-14T21:47:08', clueId: 'camera' },
      { id: 'e4', title: 'O celular é desligado', description: 'Última conexão do aparelho à rede. A localização ainda não foi confirmada.', date: '2024-10-14T22:03:00', clueId: 'elisa' },
      { id: 'e5', title: 'O alarme dispara', description: 'A equipe de segurança encontra a porta dos fundos aberta e uma obra ausente.', date: '2024-10-14T22:15:00', clueId: 'intervalo' },
      { id: 'e6', title: 'A ocorrência é registrada', description: 'Uma ligação anônima dá origem ao protocolo nº 2024–0142.', date: '2024-10-14T23:06:00', clueId: 'boletim' },
    ],
    tasks: [
      { id: 'a1', text: 'Reunir as primeiras evidências', done: true },
      { id: 'a2', text: 'Confrontar os horários dos depoimentos', done: false },
      { id: 'a3', text: 'Identificar a segunda silhueta', done: false },
      { id: 'a4', text: 'Descobrir o paradeiro de Elisa', done: false },
    ],
  },
  {
    id: 'cais', name: 'O enigma do cais', number: '0139', status: 'closed',
    description: 'Uma correspondência sem remetente, encontrada no antigo cais, revelou uma história que estava esquecida havia décadas. A origem da carta foi identificada e o caso está encerrado.',
    createdAt: '2024-09-02T10:00:00', updatedAt: '2024-10-01T16:30:00',
    clues: [
      { id: 'carta', type: 'document', title: 'A carta do cais', subtitle: 'DOCUMENTO ENCONTRADO · 02 SET', content: '“Se você encontrou esta carta, a maré finalmente trouxe de volta o que levou.”\n\nA assinatura foi identificada como pertencente a Antônio Salles, antigo responsável pelo farol.', x: 330, y: 180, width: 276, height: 283, rotation: -3, tags: ['Correspondência'], createdAt: '2024-09-02T10:00:00' },
      { id: 'conclusao', type: 'note', title: 'Caso encerrado.', subtitle: 'A RESPOSTA ESTAVA NO FAROL', content: 'A carta chegou à família de Antônio.\n\nÀs vezes, resolver um mistério é devolver uma história.', x: 780, y: 260, width: 237, height: 246, rotation: 3, color: 'blue', tags: ['Conclusão'], createdAt: '2024-10-01T16:30:00' },
    ],
    connections: [{ id: 'cais-c1', from: 'carta', to: 'conclusao', label: 'Origem identificada', color: '#53716d' }],
    events: [{ id: 'ce1', title: 'A carta é encontrada', description: 'Documento recolhido no cais antigo.', date: '2024-09-02T10:00:00', clueId: 'carta' }, { id: 'ce2', title: 'Mistério resolvido', description: 'A correspondência é entregue à família.', date: '2024-10-01T16:30:00', clueId: 'conclusao' }],
    tasks: [{ id: 'ct1', text: 'Identificar a assinatura', done: true }, { id: 'ct2', text: 'Entregar a carta à família', done: true }],
  },
];

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value).toLocaleDateString('pt-BR', options || { day: '2-digit', month: 'short', year: 'numeric' });

export function createClue(type: ClueType): Clue {
  const sizes: Record<ClueType, [number, number]> = { person: [224, 288], location: [282, 268], note: [237, 246], document: [276, 283], recording: [202, 145], checklist: [253, 277] };
  return { id: newId(), type, title: '', subtitle: '', content: '', x: 510 + Math.random() * 70, y: 230 + Math.random() * 70, width: sizes[type][0], height: sizes[type][1], rotation: Math.random() * 6 - 3, color: 'yellow', tags: [], createdAt: new Date().toISOString(), ...(type === 'checklist' ? { items: [] } : {}) };
}
