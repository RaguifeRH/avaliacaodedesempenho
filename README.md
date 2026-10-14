# Avaliação de Desempenho Raguife

Sistema web para o ciclo semestral de avaliação (junho e dezembro). Ele cobre todo o ciclo:

- base de funcionários e ocorrências;
- elegibilidade;
- avaliação online pelos líderes, liderados e pares;
- calibração 9-Box pelo N2;
- Comitê;
- cartas de feedback com PDI.

O arquivo `js/config.js` já está ligado ao projeto Firebase `avaliacao-de-desempenho-8fb11`.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `index.html` | Página do sistema |
| `css/app.css` | Identidade visual Raguife |
| `js/config.js` | Configuração do Firebase (já preenchida) |
| `js/store.js` | Conexão com o Firebase (e modo demonstração) |
| `js/app.js` | Login (matrícula ou CPF), menu e regras (níveis, faixas, 9-Box) |
| `js/rh.js` | Telas do RH: ciclo, funcionários, ocorrências, elegibilidade, avaliadores e líder direto, questionários, acessos, acompanhamento |
| `js/melhorias.js` | Orçamento, bloqueios de mérito, evolução, qualidade das respostas, cobrança e importação de ocorrências |
| `js/salarial.js` | Tabela salarial e projeção do ajuste por mérito |
| `js/aval.js` | Avaliação, painel, calibração, Comitê e cartas |
| `js/matriz.js` | Carga inicial dos questionários (Matriz de Competências 2026) |
| `js/cartas.js` | Textos das cartas por quadrante |
| `js/pdi.js` | Ações de PDI 70-20-10 por competência |
| `firestore.rules` | Regras de segurança do banco de dados (vai no painel do Firebase, não no site) |

## Instalação

### 1. Firebase

1. **Authentication → Método de login:** ative **E-mail/senha**.
2. **Firestore Database:** crie o banco em `southamerica-east1 (São Paulo)`, modo **produção**.
3. **Firestore → Regras:** apague o conteúdo, cole o arquivo `firestore.rules` inteiro e clique em **Publicar**.

A chave do `config.js` pode ficar visível no código. Quem protege os dados são as regras de segurança.

### 2. GitHub Pages

1. Envie todos os arquivos para o repositório, mantendo as pastas `css/` e `js/`.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`. Em 1 ou 2 minutos o endereço aparece, algo como `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
3. No Firebase, vá em **Authentication → Configurações → Domínios autorizados** e adicione `SEU-USUARIO.github.io`.

### 3. Primeiro acesso

Abra o endereço. Como o banco está vazio, aparece a tela **Criar acesso do RH**. Cadastre a sua matrícula, o nome e uma senha. Essa conta é a administradora; os demais acessos são gerados dentro do sistema.

## Roteiro de cada ciclo (RH)

1. **Ciclo:** abra Junho ou Dezembro. As datas são preenchidas pela regra:
   - junho: admissão até 31/12 do ano anterior; ocorrências contadas de janeiro a junho;
   - dezembro: admissão até 30/06; ocorrências contadas de julho a dezembro.
2. **Funcionários:** importe o relatório da folha (modelo FoRelaFunc, com as colunas **CPF** e **Escala Horário de Trab.**). O nível sai do cargo:
   - Supervisor, Coordenador e Gerente → **Gestor**;
   - Líder e Encarregado → **Liderança**;
   - Diretores ficam fora da avaliação;
   - os demais → **Operacional**.

   Aqui também se marcam os perfis **RH**, **N2** e **Diretoria** e se importam as **datas no cargo atual e do último reajuste**. Elas bloqueiam o mérito de quem tem menos de 6 meses no cargo ou desde o último reajuste.
3. **Ocorrências:** lance faltas, advertências, suspensões e afastamentos, sempre com data, ou importe o relatório da folha (PDF ou Excel). O sistema mostra uma prévia e não duplica o que já foi lançado.
4. **Elegibilidade:** confira a lista e os motivos, faça ajustes manuais com justificativa e **congele** a lista.
5. **Avaliadores:** para cada departamento, defina quem avalia os operacionais, a liderança e os gestores, e quem é o N2.
   - Onde há mais de um líder, use **Líder direto por pessoa (planilha)**: baixe o modelo, corrija a coluna **Chapa do líder** e importe. Chapa do líder em branco volta à regra do departamento.
   - O líder direto avalia a pessoa, e cada liderado avalia **só o próprio líder**.
6. **Ciclo:** defina o **prazo para respostas** e clique em **Gerar avaliações e abrir respostas**. Para comparar com ciclos anteriores ao sistema, importe o **histórico de 9-Box**.
7. **Acessos e senhas:**
   - **Por CPF:** operacionais sem perfil que não lideram ninguém. Usuário e senha são o CPF, só números.
   - **Por matrícula:** líderes, gestores e perfis RH, N2 e Diretoria. **Baixe a planilha de senhas na hora**; o sistema não mostra a senha depois. No primeiro acesso a pessoa cria a própria senha.
8. **Acompanhamento:** veja a adesão, gere a **mensagem de cobrança** para o WhatsApp e confira os **avaliadores fora da curva**. Notas 1 ou 5 exigem um exemplo escrito.
9. **Ciclo → Encerrar respostas e calcular resultados.**
   - nota de cada eixo: média simples de todas as respostas;
   - média dos liderados e dos pares só aparece com 3 respostas ou mais;
   - faixas: Abaixo até 3,00; Em linha de 3,01 a 4,00; Acima de 4,01 em diante.
10. **Tabela salarial:** importe a tabela atualizada (cargo × faixas A a F).
11. **Calibração:** cada N2 revisa a 9-Box da sua área, justifica os reposicionamentos, recomenda mérito e valida. O sistema projeta o ajuste da faixa atual para a seguinte (ou outra escolhida pelo N2).
12. **Comitê:** o RH informa o **orçamento mensal** e registra as decisões; o sistema mostra o valor usado e o saldo. A Diretoria consulta o resultado.
13. **Cartas de feedback:** registre os combinados e imprima ou salve em PDF.
14. **Encerrar ciclo.** Os aprovados recebem a data do último reajuste (1º de julho ou 1º de janeiro).

## Limites do plano gratuito do Firebase (Spark)

- **Criação de contas:** cerca de 100 por hora a partir do mesmo computador. O sistema para no limite, e você continua depois de onde parou.
- **Leituras do banco:** 50 mil por dia, suficiente para o uso normal.
- **Contas antigas:** reiniciar uma senha cria uma conta nova e desativa a anterior. As antigas podem ser apagadas em **Authentication → Usuários**.
