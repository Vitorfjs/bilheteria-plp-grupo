# Bilheteria concorrente

**Link do vídeo:** `https://www.youtube.com/watch?v=6Cyt0YPEu-A`

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

### Integrantes

| Nome | RGM | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- | :--- |
| Vitor Ferreira | 35287420 | [Vitorfjs](https://github.com/Vitorfjs) | `regras.ts` e `preco.ts`: meia-entrada e cálculo de preço funcional |
| Miguel Figueiredo | 35509449 | [miguel-ffo](https://github.com/miguel-ffo) | `dominio.ts`: hierarquia de erros e classe `Evento` (OO) |
| Rafael Queiroz | 35131608 | [rrafaum](https://github.com/rrafaum) | `bilheteria.ts`: venda concorrente, tempo limite e estorno |
| Kaike Garcia | 35843179 | [Kaikefgg7](https://github.com/Kaikefgg7) | `main.ts`, execução do bench e `README.md` |

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   O `await` perigoso é o da operadora de pagamento (`src/bilheteria.ts`, linha 67). Ele leva cerca de
   80 ms e, enquanto espera, o Node atende outros pedidos. Se o código fosse "verificar se a poltrona está
   livre → `await pagar(...)` → marcar como vendida", duas pessoas veriam a mesma poltrona livre, as duas
   seriam cobradas e a poltrona seria vendida duas vezes.

   Por isso invertemos a ordem: **primeiro reservamos, depois cobramos.** O `evento.reservar(poltronas)`
   (linha 57) é síncrono, sem nenhum `await` entre verificar e marcar. Como o JavaScript roda numa linha só,
   nenhum outro pedido consegue entrar no meio dessa verificação, então ela vale como uma operação única
   (atômica). Quem chega depois encontra a poltrona já marcada e recebe `PoltronaOcupadaErro` (409) na hora,
   sem ser cobrado. Só então o pedido aguarda a operadora, com um tempo limite feito com `Promise.race`
   (`comTempoLimite`, linha 22). Se o pagamento falhar ou passar do limite, o `catch` chama
   `evento.liberar(poltronas)` (linha 69), que devolve as poltronas à venda (compensação), e lança
   `PagamentoErro` (502). O teste "200 pedidos simultâneos disputando 50 poltronas" confirma o resultado:
   50 vendidos, 150 recusados com 409 e exatamente 50 cobranças aprovadas.

   Uma limitação: numa operadora real, uma cobrança que estourou o tempo limite ainda pode ser aprovada mais
   tarde. Em produção seria preciso cancelar ou estornar essa cobrança na operadora, além de liberar a
   poltrona.

2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   - **Encapsulamento:** o `Evento` guarda as poltronas vendidas em `#vendidas` (`src/dominio.ts`, linha 42),
     um campo privado de verdade do JavaScript (não só o `private` do TypeScript, que some depois de
     compilar). Para fora ele mostra apenas getters (`id`, `nome`, `preco`, `capacidade`, `disponivel`) e os
     métodos `reservar`, `liberar` e `info`. Assim, a regra "nenhuma poltrona é vendida duas vezes e toda
     poltrona está entre 1 e a capacidade" é garantida num lugar só. Ninguém consegue fazer
     `evento.vendidas.push(7)` nem `evento.disponivel = 999` e quebrar essa regra.
   - **Tudo ou nada:** o `reservar` (linha 72) trabalha em três passos. Primeiro valida todas as poltronas
     (inteiras, dentro da capacidade, sem repetição no mesmo pedido), depois confere se alguma já está
     ocupada e só no fim marca todas. Se uma poltrona de um grupo de três estiver ocupada, nenhuma é
     marcada. Sem isso, um pedido recusado deixaria poltronas presas sem pagamento, e a compensação ficaria
     difícil: o `liberar` desfaz exatamente o que o `reservar` marcou porque o `reservar` nunca faz metade do
     trabalho.
   - **Hierarquia de erros:** `ErroDeNegocio` é uma classe abstrata com `status`. `DadosInvalidosErro` (400),
     `NaoEncontradoErro` (404), `PoltronaOcupadaErro` (409) e `PagamentoErro` (502) herdam dela. O
     `servidor.ts` trata todos com um único `if (erro instanceof ErroDeNegocio)` que responde com
     `erro.status` (polimorfismo). Para criar um erro novo basta uma subclasse, sem mexer no servidor. A
     hierarquia também separa erro de negócio (resposta esperada para o cliente) de erro de programação,
     que cai no 500. O `this.name = new.target.name` faz cada erro mostrar o nome da própria subclasse.

3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   O `preco.ts` não tem `let`, `var`, laços, `push` nem estado. Ele usa `map` e `reduce` e funções que
   devolvem funções: `valorDoIngresso(precoBase)` calcula a meia uma vez e devolve uma closure, e
   `aplicarTaxa(0.1)` devolve a função que soma 10%. O `montarIngressos` recebe a regra de meia-entrada como
   parâmetro (`temDireitoAMeia`), então o cálculo de preço não depende do `regras.ts` e a regra pode ser
   trocada sem mexer nele.

   O que ganhamos: a mesma entrada sempre dá a mesma saída, sem efeito colateral. Com isso o código é
   seguro na concorrência (não há estado compartilhado para ser corrompido entre um `await` e outro), fácil
   de entender e de combinar com outras funções, e o arredondamento é sempre o mesmo.

   Para testar, basta importar as funções e chamá-las com valores fixos, sem Express, sem operadora e sem
   timers. Por exemplo, `assert.equal(aplicarTaxa(0.1)(100), 110)` e, com três pessoas que têm direito a
   meia, `assert.equal(calcularTotal(montarIngressos(100, pessoas, () => true)), 165)`. Para provar que nada é
   alterado, a entrada pode ser congelada com `Object.freeze`: se alguma função tentasse mudá-la, o teste
   quebraria. É assim que o `testes/projeto.ts` faz.

4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   Escolhemos o `Evento` no paradigma **funcional**. Em vez de uma classe com `#vendidas` mutável, ele seria
   um registro imutável `{ id, capacidade, vendidas: ReadonlySet<number> }` e uma função pura
   `reservar(evento, poltronas)` que devolve um **novo** evento ou um erro, sem alterar o original.

   - **Melhor:** fica fácil de testar, não existe mutação escondida e guardar o histórico ou desfazer uma
     reserva vem de graça: basta manter a versão anterior.
   - **Pior aqui:** o estado "quais poltronas estão vendidas agora" continua existindo e precisa morar em
     algum lugar. Alguém teria que guardar a versão atual e trocá-la a cada venda. Se dois pedidos
     lessem a mesma versão antes de um `await` e cada um gravasse o seu resultado, uma venda apagaria a
     outra (atualização perdida). Seria preciso voltar a ter uma única referência mutável, como um *atom* do
     Clojure ou um processo/ator do Elixir que recebe os pedidos em fila.

   Conclusão: para o `Evento`, a OO é a escolha melhor, porque o problema tem um estado mutável inevitável e
   a classe concentra esse estado e as regras dele num lugar só. O funcional serve melhor para o cálculo de
   preço, que não tem estado, e por isso usamos cada paradigma onde ele encaixa.

5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   Hoje a correção depende do event loop: o `evento.reservar` roda do começo ao fim sem ser interrompido,
   então "verificar e marcar" acontece de uma vez sem precisar de trava. Em vários núcleos ao mesmo tempo
   (threads em Java ou Go, ou `worker_threads` com memória compartilhada), dois núcleos poderiam rodar o
   `includes(poltrona)` no mesmo instante, os dois veriam a poltrona livre e os dois fariam `push`: uma
   condição de corrida (*race condition*) que venderia a mesma poltrona duas vezes. O mesmo vale para o
   `#proximoReservaId++` (linha 75), que poderia gerar números repetidos.

   Seria preciso sincronizar: um *mutex* por evento (ou por poltrona) em volta de verificar e marcar,
   operações atômicas (`Atomics.compareExchange` sobre um `SharedArrayBuffer`) ou um banco de dados com
   restrição `UNIQUE (evento_id, poltrona)` ou transação. Já com vários processos (`cluster` ou várias
   instâncias atrás de um balanceador), cada processo teria uma cópia própria da memória: o `#vendidas`
   nem seria compartilhado e cada processo venderia a mesma poltrona. O estado teria que ir para fora, num
   banco ou num Redis com `SET NX`.

   O ganho seria pequeno para este serviço: o trabalho é quase todo espera de I/O (os 80 ms da operadora),
   não cálculo. A concorrência numa linha só já atende os 200 pedidos em cerca de 100 ms, como mostra o
   bench. O paralelismo compensaria se a venda fizesse muito cálculo pesado.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 110 | 93 | 100 | 7 |
| Padrão (`main.ts`), 2ª execução | 200 | 104 | 80 | 100 | 20 |
| Padrão (`main.ts`), 3ª execução | 200 | 103 | 91 | 100 | 9 |

Configuração: evento 1 com 100 poltronas, `latenciaMs: 80`, `taxaDeFalha: 0.1` e `limitePagamentoMs: 500`.
O servidor foi reiniciado antes de cada execução. Medido com Node v25.9.0 no macOS. Os valores de tempo e
de falha mudam a cada rodada.

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram:

- **Nenhuma venda dupla.** O bench manda dois pedidos para cada poltrona (200 pedidos, 100 poltronas). Nas
  três execuções, exatamente 100 pedidos receberam 409. O primeiro a chegar reserva a poltrona na hora e o
  segundo é recusado sem passar pela operadora. Vendidos + falhas de pagamento = 100: cada poltrona teve
  exatamente uma tentativa de cobrança e nunca se vendeu mais que a capacidade.
- **O estorno funciona.** Ao fim de cada execução, o `disponivel` do evento 1 era igual ao número de falhas
  de pagamento (7, 20 e 9). As poltronas com pagamento recusado voltaram para a venda. Elas ficaram livres
  porque o outro interessado já tinha recebido 409 enquanto a primeira cobrança ainda estava em andamento.
- **Concorrência de verdade.** Os 200 pedidos terminaram em cerca de 100–110 ms (perto de 1.900 pedidos/s),
  pouco mais que os 80 ms de uma única cobrança. Se as 100 cobranças fossem feitas uma de cada vez, seriam
  pelo menos 100 × 80 ms = 8 s. Os pagamentos esperam ao mesmo tempo, mesmo com o JavaScript rodando numa
  linha só.
- **Falhas de acordo com a configuração.** A taxa de falha observada foi de 7%, 20% e 9% (média de 12%),
  próxima dos 10% configurados. A variação vem do sorteio aleatório sobre uma amostra pequena (100
  cobranças). Como a latência (80 ms) fica bem abaixo do limite (500 ms), nenhuma falha foi por tempo
  esgotado: todas foram recusas da operadora.
- **Eventos isolados.** Os eventos 2 e 3 continuaram com todas as poltronas livres: a disputa no evento 1
  não afeta os outros.
