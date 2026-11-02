var GrimorioArquivo = (function () {
  'use strict';

  /* ========================================
     EXPORTAR PARA ARQUIVO JSON
     ======================================== */

  function exportar() {
    return GrimorioDB.exportarTudo().then(function (dados) {
      var texto = JSON.stringify(dados, null, 2);
      var blob = new Blob([texto], { type: 'application/json' });

      var dataFormatada = new Date()
        .toISOString()
        .replace(/[T:]/g, '-')
        .substring(0, 19);

      var nomeArquivo = 'grimorio-' + dataFormatada + '.json';

      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivo;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      setTimeout(function () {
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
      }, 100);

      console.log('[Arquivo] Exportado:', nomeArquivo);
      return nomeArquivo;
    });
  }

  /* ========================================
     CARREGAR DE ARQUIVO JSON
     ======================================== */

  function carregar() {
    return new Promise(function (resolver, rejeitar) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';

      input.addEventListener('change', function () {
        var arquivo = input.files[0];

        if (!arquivo) {
          rejeitar(new Error('Nenhum arquivo selecionado.'));
          return;
        }

        var leitor = new FileReader();

        leitor.onload = function () {
          try {
            var dados = JSON.parse(leitor.result);

            GrimorioDB.importarTudo(dados).then(function () {
              console.log('[Arquivo] Importado com sucesso.');
              resolver(dados);
            }).catch(function (erro) {
              rejeitar(erro);
            });

          } catch (erro) {
            rejeitar(new Error('Arquivo corrompido ou formato invalido.'));
          }
        };

        leitor.onerror = function () {
          rejeitar(new Error('Erro ao ler o arquivo.'));
        };

        leitor.readAsText(arquivo);
      });

      document.body.appendChild(input);
      input.click();

      setTimeout(function () {
        document.body.removeChild(input);
      }, 60000);
    });
  }

  /* ========================================
     API PUBLICA
     ======================================== */

  return {
    exportar: exportar,
    carregar: carregar
  };

})();