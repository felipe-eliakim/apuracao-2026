// Configuração dos anúncios (Google AdSense).
// Enquanto `client` estiver vazio, nenhum script de anúncio é carregado e os
// espaços ficam escondidos — o site funciona igual, só sem propaganda.
// Depois que o Google aprovar o site, preencha com o seu ID ("ca-pub-...")
// e os IDs dos blocos criados no painel do AdSense. Ver README, seção Anúncios.
window.ADS_CONFIG = {
  client: '',
  slots: {
    top: '',     // abaixo do placar
    middle: '',  // entre os gráficos
    bottom: '',  // antes do rodapé
  },
};
