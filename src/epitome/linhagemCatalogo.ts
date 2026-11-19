import type { FacetaLinhagemKey, LinhagemDefinida } from './epitomeTypes';

export interface HabilidadeLinhagem {
  /** ID estável no ramo, independente do nome exibido. */
  id: string;
  nome: string;
  descricao: string;
}

export interface RegraLinhagem {
  titulo: string;
  texto?: string;
  tabela?: {
    colunas: readonly string[];
    linhas: readonly (readonly string[])[];
  };
}

export interface RamoLinhagem {
  descricao: string;
  habilidades: readonly HabilidadeLinhagem[];
}

interface FacetaCatalogo extends RamoLinhagem {
  nome: string;
  foco: string;
}

interface TriboCatalogo extends RamoLinhagem {
  nome: string;
  energia: string;
  regras: readonly RegraLinhagem[];
}

const habilidade = (id: string, nome: string, descricao: string): HabilidadeLinhagem =>
  ({ id, nome, descricao });

export const FACETAS: Readonly<Record<FacetaLinhagemKey, FacetaCatalogo>> = {
  material: {
    nome: 'Faceta Material',
    foco: 'Ancoragem e estrutura',
    descricao: 'Lida com estado, forma, densidade, permanência e interação física. É a energia agindo sobre a matéria ou assumindo propriedades como rigidez, volume e fluxo.',
    habilidades: [
      habilidade('contracao', 'Contração', 'Reduz o volume, tornando a energia mais densa e caótica.'),
      habilidade('condensacao', 'Condensação', 'Torna a energia extremamente densa, compacta e concentrada.'),
      habilidade('enrijecimento', 'Enrijecimento', 'Fortalece a estrutura energética para endurecer e resistir a impactos.'),
      habilidade('amolecimento', 'Amolecimento', 'Altera temporariamente a rigidez da energia, tornando-a flexível e maleável.'),
      habilidade('petrificacao', 'Petrificação', 'Solidifica e paralisa a energia de uma região inteira, tornando-a inerte.'),
      habilidade('fixar', 'Fixar', 'Ancora a energia espiritual de forma estática em um objeto ou local.'),
      habilidade('residual', 'Residual', 'Deixa marcas ou reservas de energia em objetos para garantir efeitos de longa duração.'),
      habilidade('substituicao', 'Substituição', 'Troca temporariamente a assinatura energética de um objeto por outra.'),
      habilidade('transformacao-temporaria', 'Transformação Temporária', 'Altera momentaneamente a forma da matéria física ou da estrutura espiritual.'),
    ],
  },
  efetiva: {
    nome: 'Faceta Efetiva',
    foco: 'Vetor e dinâmica',
    descricao: 'Lida com ação direta, força, impacto, movimento, efeito psicológico e trocas energéticas instantâneas. É a energia em estado de pulso, projeção e causa e efeito rápidos.',
    habilidades: [
      habilidade('repulsao', 'Repulsão', 'Cria um vetor de afastamento para gerar escudos e empurrar energias ou objetos.'),
      habilidade('atracao', 'Atração', 'Cria uma força gravitacional espiritual para puxar e vincular energias.'),
      habilidade('movimentacao', 'Movimentação', 'Dispara energia em linha reta ou na forma de projéteis rápidos contra alvos.'),
      habilidade('penetracao', 'Penetração', 'Projeta energia com uma frequência capaz de perfurar barreiras físicas ou energéticas.'),
      habilidade('telecinese', 'Telecinese', 'Aplica força física a objetos à distância usando o vetor espiritual.'),
      habilidade('expansao', 'Expansão', 'Amplia rapidamente a área de cobertura ou influência da energia no espaço.'),
      habilidade('separacao', 'Separação', 'Divide a energia em porções menores e autônomas.'),
      habilidade('juncao', 'Junção', 'Funde temporariamente energias de fontes diferentes em uma só.'),
      habilidade('equivalencia', 'Equivalência', 'Converte um tipo ou variação de energia em outro, mantendo a massa energética.'),
      habilidade('devorar', 'Devorar', 'Absorve e consome a energia de outros seres para si.'),
      habilidade('adaptacao', 'Adaptação', 'Reajusta a própria frequência para se harmonizar com outra fonte e mimetizá-la.'),
      habilidade('conexao', 'Conexão', 'Cria laços espirituais contínuos e duradouros entre indivíduos ou almas.'),
      habilidade('maldicao', 'Maldição', 'Imprime no alvo uma energia parasita que consome sua vitalidade.'),
      habilidade('bencao', 'Bênção', 'Concede aprimoramentos e benefícios contínuos ao alvo, geralmente sob um custo ou em troca de algo.'),
      habilidade('regeneracao', 'Regeneração', 'Acelera o fluxo vital para recuperar o corpo físico ou o tecido espiritual.'),
      habilidade('sensacao', 'Sensação', 'Sentido passivo que detecta presenças energéticas em movimento na área.'),
      habilidade('percepcao', 'Percepção', 'Consciência ativa e detalhada do que ocorre em uma zona irrigada pela própria energia.'),
      habilidade('impermeabilidade', 'Impermeabilidade', 'Isola o usuário ou um objeto contra influências e invasões espirituais.'),
      habilidade('invisibilidade-espiritual', 'Invisibilidade Espiritual', 'Apaga ou mimetiza a assinatura energética para desaparecer dos sentidos espirituais.'),
      habilidade('ilusoes', 'Ilusões', 'Dobra a percepção alheia criando projeções falsas no plano espiritual ou físico.'),
      habilidade('manipulacao', 'Manipulação', 'Habilidade motora básica de moldar a energia; não é um tipo específico de energia.'),
    ],
  },
};

export const TRIBOS: Readonly<Record<LinhagemDefinida, TriboCatalogo>> = {
  pungente: {
    nome: 'Pungente',
    energia: 'Energia emocional',
    descricao: 'Usa energia espiritual influenciada pelas emoções, com manifestações abstratas e complexas.',
    habilidades: [
      habilidade('controle-emocional', 'Controle Emocional', 'Controle as próprias emoções para manter a calma ou intensificar um sentimento. Role 1d10 para determinar o controle ou a intensificação. Ao intensificar, receba carga emocional.'),
      habilidade('aura-emocional', 'Aura Emocional', 'Influencia as emoções de quem está por perto e pode alterar características físicas do ambiente conforme as emoções atuais do personagem.'),
      habilidade('manifestacao-de-emocoes', 'Manifestação de Emoções', 'Gasta carga emocional para criar projeções tangíveis ou materializar objetos relacionados aos próprios sentimentos.'),
      habilidade('bonus-emocionais', 'Bônus Emocionais', 'Cada emoção confere um efeito específico, como um bônus de rolagem ou resistência a efeitos adversos. Consulte a tabela de emoções.'),
      habilidade('conversao-de-energia', 'Conversão de Energia', 'Converte energia emocional em energia espiritual, vital ou racional por tempo limitado.'),
      habilidade('empatia', 'Empatia', 'Desenvolve uma conexão empática que permite sentir as emoções alheias e reagir a elas.'),
      habilidade('potencial-ampliado', 'Potencial Ampliado', 'Libera temporariamente habilidades aprimoradas ou poderes únicos em momentos de emoção intensa. O potencial varia conforme a carga emocional e seu uso gasta toda a carga acumulada.'),
    ],
    regras: [
      {
        titulo: 'Carga Emocional',
        texto: 'Reservatório espiritual formado pelas emoções sentidas, acumuladas ou absorvidas.',
        tabela: {
          colunas: ['Carga', 'Faixa', 'Efeito'],
          linhas: [
            ['0 a 10', 'Faixa segura', 'Carga estável e sob controle. Nenhuma penalidade.'],
            ['11 a 20', 'Limite comum', 'Capacidade ideal de conservação sem esforço.'],
            ['21+', 'Sobrecarga', 'A cada +5 pontos acima de 20, −1 em testes.'],
            ['30+', 'Instabilidade mágica', 'A cada +5 pontos acima de 30, +1 Instabilidade Emocional.'],
          ],
        },
      },
      {
        titulo: 'Instabilidade Emocional — A Roleta das Emoções',
        texto: 'Cada nível de Instabilidade adiciona 1d4 a todos os testes. Role o d4 e um d2: o d2 determina se o valor do d4 é somado ou subtraído do resultado final.',
      },
      {
        titulo: 'Emoções: carga e efeitos',
        tabela: {
          colunas: ['Emoção', 'Carga', 'Bônus ou efeito'],
          linhas: [
            ['Amor', '+5', '+5 em rolagens para proteger alguém.'],
            ['Ódio', '+5', '+3 em rolagens de ataque.'],
            ['Alegria', '+3', '+2 em todas as rolagens.'],
            ['Tristeza', '+4', '−2 em todas as rolagens.'],
            ['Coragem', '+2', '+1 em todas as rolagens.'],
            ['Medo', '+3', '−1 em todas as rolagens.'],
            ['Paz', '+1', '+1 em todas as rolagens.'],
            ['Confiança', '+3', '+2 em todas as rolagens de ataque.'],
            ['Desespero', '+6', '+3 em rolagens de fuga.'],
            ['Orgulho', '+4', '+3 em rolagens de testes.'],
            ['Vergonha', '+6', '−3 em rolagens que chamem atenção.'],
            ['Empatia', '+7', '+3 em rolagens sociais.'],
            ['Euforia', '+10', 'Duplica outra emoção.'],
            ['Inveja', '+5', '+3 em rolagens opostas contra o alvo com os atributos mais altos na cena.'],
            ['Apatia / Calmaria', '+2', 'Imunidade ou +4 em testes para resistir a controle mental, ilusões e acúmulo de instabilidade.'],
            ['Surpresa / Espanto', '+4', '+3 em Iniciativa e em reações no primeiro turno de combate.'],
            ['Aversão / Nojo', '+4', '+3 em Defesa ou Resistência contra venenos, maldições e efeitos biológicos ou espirituais.'],
          ],
        },
      },
    ],
  },
  erudita: {
    nome: 'Erudita',
    energia: 'Energia mental',
    descricao: 'Investiga os mistérios do cosmos para invocar espíritos, projetar a consciência e manipular o conhecimento estelar.',
    habilidades: [
      habilidade('conexao-estelar', 'Conexão Estelar', 'Conecta-se a energias cósmicas e seres acima do nível mortal para acessar conhecimento comum ou universal. O sinal emitido pode ser detectado por entidades do Plano Estelar.'),
      habilidade('invocacao-espiritual', 'Invocação Espiritual', 'Invoca espíritos de outras dimensões para orientação, combate ou assistência. Quanto mais fraca a barreira dimensional do local, mais fácil o acesso; consulte a escala de invocação.'),
      habilidade('leitura-astral', 'Leitura Astral', 'Lê os astros para obter informações sobre a harmonia do universo e as linhas do destino. As mesclagens determinam o tempo e a precisão da leitura.'),
      habilidade('transferencia-de-conhecimento', 'Transferência de Conhecimento', 'Transfere conhecimento diretamente a outra mente, acelerando seu aprendizado. O usuário perde a memória correspondente, e o alvo recebe o bônus indicado pela escala.'),
      habilidade('projecao-mental', 'Projeção Mental', 'Manifesta a presença mental em um ponto distante para explorar o ambiente, mas não permite enxergar seres vivos. Cada mesclagem amplia a varredura em 10 metros.'),
      habilidade('iluminacao-espiritual', 'Iluminação Espiritual', 'Alcança um estado de clareza mental e intuição aguçada. Cada mesclagem concede +1d4 em testes para obter informações sutis.'),
      habilidade('manipulacao-psiquica', 'Manipulação Psíquica', 'Influencia mentes, controla ações ou cria ilusões mentais diretas. Cada mesclagem estende o efeito em 1 ação e concede +1d4 de força mental para superar a resistência do alvo.'),
      habilidade('interacao-espiritual', 'Interação Espiritual', 'Permite compreender e dialogar com entidades espirituais para estabelecer parcerias temporárias. Cada mesclagem estende a compreensão e o diálogo em 1 ação.'),
    ],
    regras: [
      {
        titulo: 'Invocação Espiritual — nível de barreira',
        texto: 'Legenda da rolagem de invocação: − negativo, * neutro, + positivo.',
        tabela: {
          colunas: ['Mesclagem', 'Nível', 'Rolagem de invocação'],
          linhas: [
            ['×1', '1', '−, −, −'],
            ['×2', '2', '−, −, *'],
            ['×3', '3', '−, *, *'],
            ['×4', '4', '*, *, +'],
            ['×5', '5', '*, +, +'],
          ],
        },
      },
      {
        titulo: 'Leitura Astral — alcance do destino',
        tabela: {
          colunas: ['Mesclagem', 'Alcance'],
          linhas: [
            ['×1', 'Passado em larga escala'],
            ['×2', 'Passado com precisão'],
            ['×3', 'Presente em larga escala'],
            ['×4', 'Presente com precisão'],
            ['×5', 'Futuro em larga escala'],
            ['×6', 'Futuro com precisão'],
          ],
        },
      },
      {
        titulo: 'Transferência de Conhecimento — bônus para o alvo',
        tabela: {
          colunas: ['Mesclagem', 'Bônus na rolagem do alvo'],
          linhas: [['×1', '+1'], ['×2', '+2'], ['×3', '+3'], ['×4', '+4']],
        },
      },
    ],
  },
  agraco: {
    nome: 'Agraço',
    energia: 'Energia ancorada',
    descricao: 'Ancora energia espiritual no plano físico para transmutar matéria, projetar formas tangíveis e manipular os quatro elementos naturais.',
    habilidades: [
      habilidade('projecao-fisica', 'Projeção Física', 'Converte energia espiritual pura em matéria tangível e resistente. Também pode dar tangibilidade a seres espirituais fora do controle do usuário.'),
      habilidade('manifestacao-elemental', 'Manifestação Elemental', 'Canaliza a espiritualidade para conjurar e controlar fogo, água, terra e ar.'),
      habilidade('manipulacao-celular', 'Manipulação Celular', 'Altera temporariamente a estrutura molecular do próprio corpo para acelerar a regeneração e ampliar atributos físicos.'),
      habilidade('energia-dupla', 'Energia Dupla', 'Manipula energia diretamente no Plano Espiritual para gerar reflexos automáticos no Plano Físico.'),
      habilidade('manifestacao-espiritual', 'Manifestação Espiritual', 'Projeta o próprio espírito para fora do corpo, mantendo visualmente a forma física.'),
      habilidade('integracao-elemental', 'Integração Elemental', 'Mescla o poder de um elemento à própria energia espiritual e ao organismo físico.'),
    ],
    regras: [
      { titulo: 'Dano em forma espiritual', texto: 'Em forma energética, o dano atingirá a estrutura espiritual e poderá causar danos permanentes na alma.' },
      { titulo: 'Rebote da Alteração Celular', texto: 'Alterar a forma física exige gasto contínuo de energia. Se a energia zerar ou a habilidade for anulada à força, o usuário sofre um rebote que reduz temporariamente sua Vida Máxima.' },
      { titulo: 'Rebote da Projeção Física', texto: 'Se uma projeção física for destruída em combate, o impacto gera um rebote traumático sobre a reserva máxima de energia espiritual.' },
      { titulo: 'Perigo da Integração Elemental', texto: 'Integrar um elemento ao organismo sem preparo ou treino causa dano físico direto ao usuário.' },
      { titulo: 'Energia Dupla e rompimento dimensional', texto: 'Atuar no Plano Espiritual pode atrair e alertar suas entidades. Se a barreira local for fraca, o uso incorreto pode causar rompimentos dimensionais com consequências imediatas.' },
    ],
  },
  desperta: {
    nome: 'Desperta',
    energia: 'Energia sensorial',
    descricao: 'Expande os sentidos físicos e espirituais para ler assinaturas energéticas, rastrear presenças e moldar a percepção alheia.',
    habilidades: [
      habilidade('amplificacao-sensorial', 'Amplificação Sensorial', 'Eleva a acuidade dos sentidos físicos para detectar estímulos sutis e microvariações no ambiente.'),
      habilidade('percepcao-multidimensional', 'Percepção Multidimensional', 'Expande os sentidos para além do plano físico, revelando auras, energias espirituais e dimensões invisíveis.'),
      habilidade('manipulacao-sensorial', 'Manipulação Sensorial', 'Ajusta e filtra os próprios sentidos à vontade, podendo anular dores, amplificar frequências ou ignorar cegueiras.'),
      habilidade('empatia-espiritual', 'Empatia Espiritual', 'Sintoniza a frequência espiritual e emocional de outros seres para compreender suas intenções e estados de espírito.'),
      habilidade('rastreamento-energetico', 'Rastreamento Energético', 'Segue rastros e assinaturas espirituais deixados por alvos, objetos ou eventos recentes.'),
      habilidade('sensacao-alargada', 'Sensação Alargada', 'Estende o alcance dos sentidos físicos para distâncias além dos limites humanos.'),
      habilidade('projecao-sensorial', 'Projeção Sensorial', 'Projeta visão, audição ou tato até um ponto distante sem mover o corpo físico.'),
      habilidade('criacao-sensorial', 'Criação Sensorial', 'Gera ilusões perceptivas completas com estímulos falsos para enganar ou desorientar alvos.'),
    ],
    regras: [
      { titulo: 'Alcance e varredura', texto: 'O alcance padrão da Sensação Alargada e da Projeção Sensorial escala com Percepção/Espiritualidade do personagem.' },
      { titulo: 'Resistência a ilusões', texto: 'Alvos sob Criação Sensorial fazem testes de resistência mental contra o valor de conjuração do Mestre Sensorial.' },
      { titulo: 'Sobrecarga sensorial', texto: 'Estímulos excessivos durante a Amplificação Sensorial, como grandes explosões espirituais, exigem um teste de Vontade para evitar atordoamento momentâneo.' },
    ],
  },
  espectro: {
    nome: 'Espectro',
    energia: 'Energia anímica',
    descricao: 'Domina o elo entre a alma e o corpo físico para suportar condições extremas e sustentar a vitalidade com Energia Anímica.',
    habilidades: [
      habilidade('adaptacao-ambiental', 'Adaptação Ambiental', 'Ajusta automaticamente o organismo e a aura a condições ambientais extremas: pressão, calor, frio, biomas tóxicos e vácuo.'),
      habilidade('equilibrio-vital', 'Equilíbrio Vital', 'Mantém a harmonia entre saúde física e espiritual, acelerando a autocura e reforçando a imunidade contra doenças e toxinas.'),
      habilidade('resistencia-a-ausencia', 'Resistência à Ausência', 'Tolera por mais tempo a privação de elementos vitais, como ar, água e oxigênio.'),
      habilidade('transcendencia-fisica', 'Transcendência Física', 'Separa temporariamente a consciência ou essência do corpo para transitar e interagir no Plano Espiritual.'),
      habilidade('protecao-da-essencia', 'Proteção da Essência', 'Cria uma barreira anímica inviolável para proteger o núcleo da alma de maldições, vampirismo energético ou danos espirituais diretos.'),
      habilidade('conexao-animica', 'Conexão Anímica', 'Estabelece um laço espiritual profundo para compartilhar energia, pensamentos e sustentação vital.'),
      habilidade('sustentacao-vital', 'Sustentação Vital', 'Substitui a necessidade de alimentos e nutrientes físicos pela canalização contínua de Energia Espiritual.'),
      habilidade('manifestacao-animica', 'Manifestação Anímica', 'Projeta temporariamente a essência anímica para observar e interagir de forma sutil, sem romper a ancoragem com o corpo.'),
    ],
    regras: [
      { titulo: 'O Elo de Junção', texto: 'O Espectro atua na ponte entre matéria e reflexo espiritual. Pode alimentar o corpo físico com energia espiritual sem o grande desperdício normalmente imposto pela diferença de densidade.' },
      { titulo: 'Sobrevivência Absoluta', texto: 'Sob Sustentação Vital e Resistência à Ausência, o personagem ignora testes de exaustão por fome, sede ou sufocamento enquanto houver energia para manter as habilidades.' },
      { titulo: 'Corpo inerte durante a Transcendência', texto: 'O corpo fica catatônico enquanto a alma está fora. Se sofrer dano, o elo é rompido abruptamente, causando Rebote Anímico.' },
      { titulo: 'Rede de Transferência', texto: 'Conexão Anímica permite transferir pontos de vida ou energia espiritual para aliados caídos. Se um aliado conectado sofrer dano espiritual direto, parte do choque é refletida no Espectro.' },
    ],
  },
};

export const ORDEM_TRIBOS = Object.keys(TRIBOS) as LinhagemDefinida[];

export function isLinhagemDefinida(valor: unknown): valor is LinhagemDefinida {
  return typeof valor === 'string' && Object.hasOwn(TRIBOS, valor);
}
