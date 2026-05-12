export type ActionType = 'inspect' | 'pickup' | 'travel' | 'terminal_read' | 'phone_call';

export interface Interactable {
  id: string;
  icon: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  hideIcon?: boolean;
  type: ActionType;
  label: string;
  description?: string;
  requiredItem?: string;
  failedMessage?: string;
  successMessage?: string;
  targetRoom?: string;
  pickupItem?: string;
  phoneCallId?: string;
  documentData?: { title: string; content: string[] };
  hideAfterInteract?: boolean;
}

export interface PhoneContact {
  name: string;
  number: string;
  discoveredFrom: string;
  voice: string;
  greeting: string;
  dialogue: Record<string, {
    speaker: string;
    lines: string[];
    choices: { text: string; goto: string; hint: boolean }[];
  }>;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  bgImage?: string;
  mapImage?: string;
  interactables: Interactable[];
}

import imgEscritorio from './assets/images/noir/bg_escritorio.png';
import imgRuaChuva from './assets/images/noir/bg_rua_chuva.png';
import imgBar from './assets/images/noir/bg_bar.png';
import imgEscola from './assets/images/noir/bg_escola.png';
import imgDiretoria from './assets/images/noir/bg_diretoria.png';
import imgDelegacia from './assets/images/noir/bg_delegacia.png';
import imgBeco from './assets/images/noir/bg_beco.png';
import imgArmazem from './assets/images/noir/bg_armazem.png';

import mapEscritorio from './assets/images/noir/maps/map_escritorio.png';
import mapRuaChuva from './assets/images/noir/maps/map_rua_chuva.png';
import mapBar from './assets/images/noir/maps/map_bar.png';
import mapEscola from './assets/images/noir/maps/map_escola.png';
import mapDiretoria from './assets/images/noir/maps/map_diretoria.png';
import mapDelegacia from './assets/images/noir/maps/map_delegacia.png';
import mapBeco from './assets/images/noir/maps/map_beco.png';
import mapArmazem from './assets/images/noir/maps/map_armazem.png';

import gameData from './game_data.json';

import imgChaveEscritorio from './assets/images/noir/items/item_chave_escritorio.png';
import imgCartaoVisita from './assets/images/noir/items/item_cartao_visita.png';
import imgFotografia from './assets/images/noir/items/item_fotografia.png';
import imgIsqueiro from './assets/images/noir/items/item_isqueiro.png';
import imgFitaMagnetica from './assets/images/noir/items/item_fita_magnetica.png';
import imgCedula500 from './assets/images/noir/items/item_cedula_500.png';
import imgGravadorCassete from './assets/images/noir/items/item_gravador_cassete.png';

export const ITEM_IMAGES: Record<string, string> = {
  chave_escritorio: imgChaveEscritorio,
  cartao_visita: imgCartaoVisita,
  fotografia: imgFotografia,
  isqueiro: imgIsqueiro,
  fita_magnetica: imgFitaMagnetica,
  cedula_500: imgCedula500,
  gravador_cassete: imgGravadorCassete,
};

export const ITEM_NAMES: Record<string, string> = gameData.ITEM_NAMES;

export const PHONE_CONTACTS: Record<string, PhoneContact> = gameData.PHONE_CONTACTS;

const BG_MAP: Record<string, string> = {
  escritorio: imgEscritorio,
  rua_chuva: imgRuaChuva,
  bar: imgBar,
  escola: imgEscola,
  diretoria: imgDiretoria,
  delegacia: imgDelegacia,
  beco: imgBeco,
  armazem: imgArmazem,
};

const MAP_IMG: Record<string, string> = {
  escritorio: mapEscritorio,
  rua_chuva: mapRuaChuva,
  bar: mapBar,
  escola: mapEscola,
  diretoria: mapDiretoria,
  delegacia: mapDelegacia,
  beco: mapBeco,
  armazem: mapArmazem,
};

const rawRooms = gameData.GAME_ROOMS as Record<string, Room>;

Object.keys(rawRooms).forEach(key => {
  if (BG_MAP[key]) rawRooms[key].bgImage = BG_MAP[key];
  if (MAP_IMG[key]) rawRooms[key].mapImage = MAP_IMG[key];
});

export const GAME_ROOMS = rawRooms;
