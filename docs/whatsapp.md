Adicionei os .env do UAZAPI. 
Preciso que você implemente a funcionalidade de envio pro whatsapp. 

O fluxo e a regra de negócio deve ser essa:
O número conectado na instância estará em um ou mais grupos de promoções de ofertas do ML. 
Baseado nas ofertas que estão listadas na página de ofertas, eu vou gerar mensagens aleatórias (baseado nas frases) e mandar essas ofertas 24hs por dia. A cada 1 hora enviar 1 ou 2 ofertas, isso deve ser configurável. 
Caso já tenha enviado todas as ofertas, deverá fazer uma busca novamente das ofertas no mercado livre, pra atualizar os preços, promoções e produtos. 
Feito a busca, deverá enviar novamente todos os produtos no mesmo fluxo definido nas configurações de envio automático pelo whatsapp. 

É importante que a API do whatsapp envie os links carregados, com o preview, bonitinho, e que consigamos editar ali durante o fluxo. 
Se precisar de um redis, me avise, que eu configuro e implemento no projeto. Mas basicamente quero esse fluxo ocorrendo diariamente. 

Claro que, ofertas ignoradas não vão ser enviadas, muito menos aquelas marcadas como "Já publicadas". 
Mas a função de envio no whatsapp não deve marcar a oferta como já publicada. Ela só deve re-pesquisar novamente as ofertas no ML, automático, sempre que terminar de enviar todas as ofertas. 

