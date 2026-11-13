# Grimório do Mestre — Spiritual Epitome & Tabuleiro Tático

Aplicação unificada que integra o **Grimório do Mestre (`Spiritual-Epitome`)** ao **Tabuleiro Tático de Combate em Grid**.

## Módulos Integrados

1. **Menu Principal (`Grimório do Mestre`)**:
   - **Glossário**, **Fichas**, **Sistema**, **Tabuleiro** *(substituindo Construção)*, **Salvar** e **Carregar** (com atalhos numéricos `1`–`6`).
   - **Salvar / Carregar Unificado**: Exporta e importa arquivos `grimorio-*.json` 100% compatíveis com o formato `grimorio_mestre` do `Spiritual-Epitome`, preservando também a partida atual do Tabuleiro Tático e retratos customizados.

2. **Sistema de Fichas (`Spiritual-Epitome`)**:
   - Fluxos completos de **Criar Ficha**, **Editar Ficha** (com exclusão em dupla confirmação e envio direto ao Tabuleiro) e **Jogar** (1 ficha solo ou **2 fichas lado a lado em tela dividida** com salvamento automático).
   - Todas as 6 abas originais (**Identidade**, **Perícias**, **Campos**, **Combate**, **Magia** e **Inventário**), incluindo:
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

## Scripts

```bash
npm install
npm run dev      # Servidor de desenvolvimento em 0.0.0.0:5173
npm test         # Testes unitários (Vitest)
npm run build    # Build de produção
```
