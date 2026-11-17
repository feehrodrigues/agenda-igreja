# Programa de agendamento (festividades) — requisitos do dono do projeto

> Fonte: pedido original do Felipe. **Ler antes de mexer em `src/app/programas`, `src/app/dashboard/[slug]` e `src/lib/festividades`.**
> O site continua igual. O programa é uma **adição** que ajuda a agenda da sala (setor e congregações), com título configurável pelo setor.

## Princípios (não negociáveis)

1. É um **PROGRAMA**, não um formulário. Tem título próprio (ex.: "Programa de Festividade 2027"), definido pelo setor/ministério.
2. **Vive dentro da sala** (setor, ministério ou congregação), em uma aba/menu. Nunca como página solta do site.
3. **A grade é a tela principal** (dias × departamentos, referência: Trello). Em tempo real, para o setor **e** para as congregações (todas se veem para saber onde alocar).
4. **UX caprichada**: menus, navegação, sem cara de formulário corrido.
5. **De ponta a ponta**: cada etapa mostra a informação de que o papel precisa e ajuda a avançar (como o Mercado Livre).
6. Super inteligente: estatísticas de quem falta enviar, por congregação, departamento e região.

## Experiência (norte, não regra)

O setor pode ter 3 ou 15 departamentos. Muitos departamentos é caso comum, não exceção: o app precisa ficar bonito e eficiente nos dois casos, **sem engessar** e sem virar formulário.
- A grade aguenta volume: agrupamento, colunas fixas, filtros (região/departamento/status), busca e modo compacto — em vez de espremer colunas até ficarem ilegíveis.
- Acabamento de produto: nada de cara de painel de admin genérico; navegação e menus com cuidado de design.
- O setor personaliza tudo (título, regiões/categorias com nome livre, departamentos, formato); o app não impõe estrutura.
- O próximo passo fica sempre à mão: a tela mostra o que cada papel precisa e o que falta, sem precisar caçar em outra aba.

## Grade por mês (direção visual)

Hoje a grade é uma tabela única com **todos** os dias do programa (~60 linhas) — vira um paredão. A direção é separar em **seções por mês**, que é mais bonito e mais rápido de ler.
- Cada mês: cabeçalho com nome grande + contadores (festividades, aguardando, % enviado) e colapsável.
- Só entram os **dias liberados** (no formato fixo, sexta/sábado): fevereiro vira 8 linhas, não 28.
- Colunas = departamentos (contagem no cabeçalho); coluna "Dia" fixa à esquerda; cabeçalho do mês fixo ao rolar.
- Cartão: barra de status à esquerda, congregação em negrito, hora com números tabulares, chip de região. Célula vazia só mostra "+ Pedir" no hover — a grade fica calma.
- **Nenhum slot tem limite**: todas as festividades do dia/departamento aparecem na célula, sem "+N". Se encher, a linha cresce — visualização completa é decisão do setor.
- "Hoje" destacado; sábado com fundo levemente diferente.
- Densidades: Confortável / Compacto / Lista (a lista é o modo bom pra celular).
- Filtros por região, departamento e status + busca; impressão/PDF por mês.
- Protótipo navegável: `docs/prototipo-grade-mensal.html`.

### Visão de calendário
Além da grade, a mesma tela alterna para **Calendário**: o mês inteiro em 7 colunas. Serve para bater o olho e decidir rápido (congregações e setor), com:
- dias liberados em branco e os demais esmaecidos, "hoje" marcado;
- cada festividade no seu dia, com hora, sala, cor da região e aviso ⚠ de conflito;
- clique no cartão abre o mesmo detalhe da grade;
- é **somente leitura**: pedir continua sendo na grade, para não errar o alvo.

### Datas liberadas pelo setor (aba Datas)
O setor escolhe no calendário **quais dias** as congregações podem pedir; o critério é livre.
- Atalhos por mês: "sex + sáb", "1ª…5ª semana", "limpar mês"; e "limpar tudo" no topo.
- Dias com pedido aparecem com um ponto âmbar; remover um deles não apaga os pedidos existentes (só avisa).
- **Nenhuma data marcada** = volta a valer a regra do formato (fixo: sexta e sábado; livre: todos os dias).
- O servidor confere: com datas escolhidas, pedido fora delas é recusado.
- Tabela aditiva `ProgramReleasedDay` (programa + data), com cascata ao apagar o programa.

## Papéis e fluxo

### Setor (sala setor/ministério)
1. Cadastra a agenda do ministério (geralmente vem em **PDF**). Desejado: importar PDF/lista e preencher as datas automaticamente, gratuito.
2. Define as datas do setor e do ministério que envolvem todas as congregações (festividades, eventos, palestras, cultos, reuniões).
3. Cria o programa: título, regiões (A, B, C… nome livre), departamentos (Varões, UMADEB, CREIO, UFADEB, SEMAD…), formato e prazo (opcional).
4. **Libera as datas** em que as congregações podem solicitar (regra geral: sexta e sábado por departamento).
5. Compartilha o link de convite do programa.
6. Recebe solicitações e decide com **critérios próprios**: aceitar uma ou várias para a mesma data (ex.: regiões diferentes) ou quem pediu primeiro.
7. Acompanha o progresso: quais congregações ainda não enviaram, por departamento e por região.

### Congregação (sala filha do setor)
1. O secretário entra na sala da congregação e vê um aviso **elegante**, que chama atenção sem forçar (não bloqueia a tela), **ou** abre direto o link do programa.
2. Escolhe os departamentos que terão festividade (nem todas as igrejas têm os mesmos).
3. Escolhe o formato: **segunda–sábado** (festividade na semana, cada dia um departamento, a critério da igreja) ou **sexta e sábado**.
4. Preenche cada departamento nas datas disponíveis. Horário padrão **19h–21h**, editável; pode ter 2 festividades no mesmo dia.
5. Vê na grade as datas já pedidas, em solicitação e confirmadas por todas as congregações.
   - Mesma região no mesmo dia: **bloqueia** (deve mudar a data).
   - Outra região: **aceitável**, pode pedir (aviso, com boas chances de aprovação).
6. Depois de enviar, **sempre** vê suas datas no mesmo lugar, pode voltar quando quiser e pode alterar fazendo **nova solicitação** (o setor aprova ou não).

### Regras do negócio
- Congregação não marca festividade sozinha: é evento de interesse setorial e **só vale com aprovação do setor** (confirmar e alterar).
- Festividade aprovada tem **categoria diferenciada** (interesse setorial/intercongregacional), visível na agenda de **todas** as congregações; mais relevante para as da mesma região.
- Prazo para solicitar é opcional; serve para planejar cedo.
- **Confirmação avulsa**: lugar separado, **sem prazo e sem programa**, para qualquer evento que precise de confirmação do setor (inclusive de quem perdeu o prazo). É um canal de comunicação com o setor, não faz parte do programa.

## Estado atual (atualizar a cada entrega)

| Item | Estado |
| --- | --- |
| Modelo de dados, migração, regras de conflito (mesma região bloqueia, outra região avisa) | feito |
| Aba "Programas" dentro da sala (setor e congregação) | feito |
| Grade como tela principal (setor e congregação), com atualização automática | feito (pedido por clique ainda sem teste completo no navegador) |
| Abas do setor: Grade, Datas, Progresso, Pedidos, Congregações, Configurações | feito |
| Progresso por congregação, departamento e região + "próximo passo" | feito |
| Datas liberadas na grade (formato fixo = sexta/sábado) | feito |
| Setor escolhe datas liberadas no calendário (semanas, sex+sáb, dias soltos) — aba Datas | feito (`ProgramReleasedDay`; lista vazia volta à regra do formato; servidor recusa data não liberada) |
| Visão de calendário do mês na grade (alterna com Grade) | feito |
| Aviso elegante na sala da congregação (sem forçar) | feito (faixa discreta e dispensável, com link direto para a grade) |
| Congregação escolhe formato (seg–sáb ou sex–sáb) | **pendente** |
| Setor decide com critérios (ver concorrentes da mesma data, ordem de chegada, região) | feito (aba Pedidos mostra critérios, ordem de chegada, região e concorrentes do dia) |
| Caixa de entrada da confirmação avulsa para o setor | feito (seção na aba Programas do setor, com aprovar/recusar) |
| Festividade aprovada com categoria própria e visível a todas as congregações | feito (categoria roxa + evento repassado por `targetRooms`; correção de `EventBroadcast`, que não era lido) |
| Importar agenda do ministério (PDF/lista) | **pendente** |
| Bloqueio no servidor para dias não liberados | feito (quando há datas escolhidas, `enviarSolicitacao` recusa dia fora delas) |
| Pedido direto na célula da grade (19h–21h padrão, 1 clique, alerta de região) | feito |
| UX da grade com muitos departamentos (agrupamento, filtros, modo compacto) + acabamento profissional | feito (filtros por região/departamento/status, busca, densidades Confortável/Compacto/Lista, coluna Dia fixa) |
| Grade separada por mês (seções colapsáveis, dias liberados, hoje, densidades, slots sem limite) — ver `docs/prototipo-grade-mensal.html` | feito |

## Continuar em outro chat

Diga: "Continue o projeto Programas de festividade. Leia `docs/programa-festividades.md` e a branch `feehrodrigues-agenda-festividades-planejamento`." Este arquivo + a memória do repositório têm todo o contexto. Próximos passos: congregação escolher formato, impressão/PDF por mês e importação de agenda (PDF/lista).

## Regras de trabalho

- Responder em português, de forma breve.
- Não alterar o resto do site; não dar push/merge sem pedido.
- Nunca apagar arquivos sem commit antes.
- Commits com o trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
