import { Board, TerrainType } from '../types';
import { GameMap, MapCatalog } from '../maps/mapTypes';
import {
  criarMapaEmBranco,
  criarPasta,
  gerarStairId,
  mapaAPartirDoTabuleiro,
} from '../maps/mapEngine';

/**
 * Mapas de exemplo criados na primeira execução:
 * a "Ruína" adota o tabuleiro atual e tem uma escada de descida ligada a uma
 * cripta subterrânea, que por sua vez tem a escada de subida de retorno.
 * Serve para o mestre ver o sistema de escadas a funcionar de imediato.
 */
export function createDefaultMapCatalog(baseBoard?: Board, baseName?: string): MapCatalog {
  const principal = baseBoard
    ? mapaAPartirDoTabuleiro(baseBoard, baseName || 'Ruínas Superiores')
    : criarMapaEmBranco('Ruínas Superiores', 20, 15);

  const cripta = criarMapaEmBranco('Cripta Subterrânea', 16, 12);

  // Corredores e salas da cripta
  const terrain: Record<string, TerrainType> = {};
  for (let x = 0; x < cripta.largura; x++) {
    terrain[`${x},0`] = 'impassable';
    terrain[`${x},${cripta.altura - 1}`] = 'impassable';
  }
  for (let y = 0; y < cripta.altura; y++) {
    terrain[`0,${y}`] = 'impassable';
    terrain[`${cripta.largura - 1},${y}`] = 'impassable';
  }
  // Paredes internas com passagens
  for (let y = 2; y <= 9; y++) {
    if (y === 6) continue;
    terrain[`6,${y}`] = 'impassable';
  }
  // Poças de terreno difícil (água/entulho)
  [
    [3, 8],
    [4, 8],
    [3, 9],
    [11, 3],
    [12, 3],
    [11, 4],
  ].forEach(([x, y]) => {
    terrain[`${x},${y}`] = 'difficult';
  });
  cripta.terrain = terrain;

  // No jogo a cripta é escura: exploração com visão de 6 quadrados, trancada.
  cripta.fog = { mode: 'exploration', range: 6, locked: true };

  const stairCripta = gerarStairId();
  const stairRuina = gerarStairId();

  cripta.stairs = [
    {
      id: stairCripta,
      x: 2,
      y: 2,
      direction: 'up',
      label: 'Escada de subida para as ruínas',
      targetMapId: principal.id,
      targetStairId: stairRuina,
    },
  ];

  principal.stairs = [
    {
      id: stairRuina,
      x: Math.max(0, Math.min(principal.largura - 1, 17)),
      y: Math.max(0, Math.min(principal.altura - 1, 13)),
      direction: 'down',
      label: 'Escada de descida para a cripta',
      targetMapId: cripta.id,
      targetStairId: stairCripta,
    },
  ];

  // As ruínas e a cripta ficam na mesma pasta (andares ligados entre si)
  const pasta = criarPasta('Ruínas & Cripta', 'Andares ligados por escadas');
  principal.folderId = pasta.id;
  cripta.folderId = pasta.id;

  return {
    maps: { [principal.id]: principal, [cripta.id]: cripta },
    folders: { [pasta.id]: pasta },
    defaultMapId: principal.id,
  };
}

/** Mapa único adotado a partir do tabuleiro (sem exemplos). */
export function createSingleMapCatalog(board: Board, nome: string): MapCatalog {
  const mapa: GameMap = mapaAPartirDoTabuleiro(board, nome);
  return { maps: { [mapa.id]: mapa }, folders: {}, defaultMapId: mapa.id };
}
