# Grimório do Mestre — Spiritual Epitome & Tabuleiro Tático

Aplicação unificada que integra o **Grimório do Mestre (`Spiritual-Epitome`)** ao **Tabuleiro Tático de Combate em Grid**.

## Módulos Integrados

1. **Menu Principal (`Grimório do Mestre`)**:
   - **Glossário**, **Fichas**, **Sistema**, **Tabuleiro** *(substituindo Construção)*, **Salvar** e **Carregar** (com atalhos numéricos `1`–`6`).
   - **Salvar / Carregar Unificado**: Exporta e importa arquivos `grimorio-*.json` 100% compatíveis com o formato `grimorio_mestre` do `Spiritual-Epitome`, preservando também a partida atual do Tabuleiro Tático e retratos customizados.

2. **Sistema de Fichas (`Spiritual-Epitome`)**:
   - Fluxos completos de **Criar Ficha**, **Editar Ficha** (com exclusão em dupla confirmação e envio direto ao Tabuleiro) e **Jogar** (1 ficha solo ou **2 fichas lado a lado em tela dividida** com salvamento automático).
   - Sete abas: **Identidade**, **Linhagem**, **Perícias**, **Campos**, **Combate**, **Magia** e **Inventário**. Recursos:
     - 18 perícias organizadas em 6 Tríades (`6 + Nível × 3` pontos).
     - **Circulação Mágica 2×2** (`X` Estamina, `O` Mana em pares horizontais, `Q` Vida em pares verticais).
     - **Slots Internos e Externos de Mana** desbloqueados automaticamente por `Integração` e `Canalização`.
     - **Alcance Circular e Direcional** (`180°` até `15°`, ou `0°` em reta com largura configurável).

3. **Sinergia Fichas ↔ Tabuleiro Tático**:
   - Qualquer ficha pode ser invocada no **Tabuleiro** com 1 clique, convertendo automaticamente:
     - **Vida**, **Deslocamento** (`2 + Atletismo × 1.5`), **Dano Físico** e **Agilidade de Combate** (com ordenação automática de Iniciativa).
     - **Arma Equipada** (`Curta`, `Média`, `Longa`, `Mágica` ou `Combate Corporal`) escalada por `Dano Arma + Manualidade × 3`.
     - **Canalização Espiritual**: ataques de **Projeção Direcional** (cones/feixes conforme o ângulo da ficha que acompanham o cursor do mouse), **Domínio Circular** e técnicas nomeadas nos **Slots de Mana**.
   - Sincronização em tempo real de **Vida**, **Estamina**, **Raciocínio** e **Mana** entre o Tabuleiro e a Ficha, além de edição rápida da Ficha em modal sem sair do combate.
   - Mantém suporte integral a NPCs/criaturas livres (`1×1` a `4×4`+), terrenos, Linha de Visão (Bresenham), movimentação BFS, Undo/Redo, orientação seguindo o mouse e área persistente do último ataque executado.

## Árvore de Linhagem

Abra **Fichas → Criar Ficha** ou edite um personagem existente e acesse a aba **Linhagem**. A aba **Identidade** só exibe a linhagem; o campo de texto **Tribo** continua sendo o clã ou a facção do personagem.

- Escolha Pungente, Erudita, Agraço, Desperta ou Espectro. A árvore passa a mostrar a energia inata escolhida e três ramos: **Faceta Material**, **Energia herdada** e **Faceta Efetiva**.
- Há **3 pontos de habilidade por nível**, incluindo o primeiro: no nível 1 são 3 pontos no total, no nível 2 são 6, e assim por diante. Esses pontos são independentes dos pontos de Perícia; o painel da árvore mostra total, gastos e disponíveis.
- Clique nos nós para consultar uma habilidade. Aprender uma técnica própria ou das Facetas custa **1 ponto**. As regras específicas da tribo aparecem no ramo herdado. A árvore não aplica bônus nem rolagens automaticamente.
- Em **Outras energias**, vincule uma energia externa a uma perícia com aval do mestre. Mesmo com vários vínculos, só é possível aprender **uma habilidade externa por personagem**, por **3 pontos da árvore**. Criar ou editar o vínculo não gasta pontos.
- Desmarcar uma habilidade devolve seu custo. Desvincular a energia da habilidade externa também desmarca essa habilidade e libera seus 3 pontos. Ao trocar de linhagem, as habilidades da antiga raiz ficam arquivadas sem custo enquanto ela estiver inativa; se a habilidade externa passar a pertencer à nova raiz, ela passa a ser uma habilidade própria de 1 ponto.
- No editor, use **Salvar Ficha**. Em **Jogar** e **Ficha Rápida**, vale o salvamento automático. Os registros acompanham os backups do Grimório. Backups da primeira versão da árvore mantêm a primeira habilidade externa que estava vinculada; as demais ficam arquivadas. Se uma ficha antiga ou uma redução de nível deixar o gasto acima do limite, as escolhas são preservadas, mas novas compras ficam bloqueadas até haver saldo.

## Scripts

```bash
npm install
npm run dev      # Servidor de desenvolvimento em 0.0.0.0:5173
```
