# Site Knotide Bio: guia de gestão

Site estático, bilingue (PT por defeito em `/`, EN em `/en/`), sem servidor, sem base de dados e sem custos.
Tudo o que é texto está em ficheiros JSON dentro de `content/`; o resto é gerado automaticamente.

| O quê | Ferramenta | Custo |
|---|---|---|
| Alojamento e domínio `www.knotidebio.pt` | GitHub Pages (como até agora) | Gratuito |
| Editar textos, imagens e definições | Pages CMS (app.pagescms.org), com login GitHub | Gratuito |
| Publicação automática após cada alteração | GitHub Actions (`.github/workflows/deploy.yml`) | Gratuito |
| Formulário de contacto | Formspree (endereço atual `mwlpokjq`) | Gratuito até 50 mensagens/mês |
| Estatísticas de visitas, sem cookies | Cloudflare Web Analytics (token já existente) | Gratuito |

---

## 1. Testar primeiro, sem mexer no site atual

O site atual continua em `www.knotidebio.pt`. A versão nova fica num endereço de teste à parte:
`https://osramo-beep.github.io/knotide-site-v2/`

1. Em github.com, clique em **+ → New repository**. Nome: `knotide-site-v2`. Visibilidade: **Public**
   (no plano gratuito do GitHub, o Pages só funciona em repositórios públicos). Não adicione README. Clique em **Create repository**.
2. Na página do repositório vazio, clique em **uploading an existing file**. Descompacte o zip no computador,
   abra a pasta `knotide-site` e arraste **todo o conteúdo** dessa pasta (não a pasta em si) para a janela do browser.
   A pasta `dist/` pode ficar de fora.
   - A pasta `.github` e o ficheiro `.pages.yml` começam por ponto e podem estar escondidos.
     No Mac: no Finder, carregue em `Cmd + Shift + .`. No Windows: Explorador → Ver → Itens ocultos.
     **A pasta `.github` é indispensável**: é ela que publica o site.
   - Clique em **Commit changes**.
3. Vá a **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**.
4. Abra o separador **Actions**. Se aparecer um botão verde para ativar os workflows, clique nele.
   Depois abra "Build and publish site" e clique em **Run workflow**.
5. Ao fim de 1 a 2 minutos, o site de teste fica disponível em `https://osramo-beep.github.io/knotide-site-v2/`.

O site de teste fica marcado como `noindex`, por isso o Google não o indexa nem o confunde com o site oficial.
O formulário de teste envia mensagens reais para o mesmo Formspree. Se ativar "Restrict to domain" no Formspree,
acrescente também `osramo-beep.github.io` enquanto estiver a testar.

## 1.1 Passar a versão nova para www.knotidebio.pt (quando decidir)

Opção A, mais simples (troca de domínio entre repositórios):
1. No repositório antigo `knotide-site`: **Settings → Pages**, apague o *Custom domain* e guarde.
2. No repositório `knotide-site-v2`: **Settings → Pages → Custom domain**, escreva `www.knotidebio.pt`, guarde
   e ative **Enforce HTTPS** quando a opção ficar disponível (pode demorar alguns minutos).
3. O DNS não precisa de alterações se `www` já aponta para `osramo-beep.github.io` (é o caso quando o site atual funciona a partir do GitHub Pages desta conta).

O repositório antigo fica intacto como cópia de segurança: para voltar atrás, faz-se a troca inversa.

Opção B: substituir o conteúdo do repositório antigo `knotide-site` pelo desta pasta e escolher
**Settings → Pages → Source: GitHub Actions** nesse repositório.

O site deteta sozinho se está no domínio próprio ou num endereço de teste. Não há nada para configurar.

## 2. Editar textos sem tocar em código (Pages CMS)

1. Entre em **https://app.pagescms.org** com a sua conta GitHub e autorize o acesso ao repositório `knotide-site`.
2. No menu lateral aparecem:
   - **Textos em português (PT)** e **Textos em inglês (EN)**: todas as secções do site, campo a campo.
   - **Definições gerais**: email, morada, endereço do formulário, número de WhatsApp, mostrar/esconder o assistente.
   - **Assistente: perguntas e respostas**: palavras-chave e respostas do assistente.
3. Altere e carregue em **Save**. O site atualiza-se sozinho em cerca de 1 minuto.

Notas:
- Os textos aceitam HTML simples para itálico de nomes científicos: `<em>Vibrio parahaemolyticus</em>`.
- Mantenha a mesma estrutura nos dois idiomas (o mesmo número de cartões, passos, etc.).
- Se acrescentar campos novos aos JSON, corra `node src/gen-cms.mjs` para atualizar o `.pages.yml`.

Alternativa sem CMS: no GitHub, abra o ficheiro `content/pt.json` ou `content/en.json`, clique no lápis, edite e faça *Commit*.

## 3. Imagens

Ficheiros em `assets/img/`. Para trocar uma foto mantendo o layout, substitua o ficheiro **com o mesmo nome**
(ex. `researcher-handling-a-sample-in-the-laboratory-1600.webp` e a versão `-900.webp`). Formato recomendado: WebP, qualidade 75 a 80.
Os 48 fotogramas da molécula estão em `assets/img/molecule/` (fundo transparente, já centrados e recoloridos).

## 4. Formulário de contacto (Formspree)

O formulário envia para `https://formspree.io/f/mwlpokjq` (o mesmo do site anterior). Campos recebidos:
`name`, `organisation`, `email`, `country`, `enquiry_type`, `areas_of_interest`, `subject`, `message`,
`privacy_consent`, `language`, e o assunto do email `_subject` (ex. "[Knotide Bio] Licenciamento: Nome").
O campo invisível `_gotcha` trava robôs de spam.

No painel do Formspree (formspree.io → o seu formulário):
- **Settings → Restrict to domain**: indique `knotidebio.pt` para impedir abusos a partir de outros sites.
- **Destinatários (vários Gmails, sem custos)**: o plano gratuito envia cada formulário para um único endereço.
  Para chegar a várias pessoas, use um **Grupo Google** como destinatário:
  1. Em https://groups.google.com, clique em **Criar grupo**. Nome: `Knotide Contactos`. Email do grupo: por exemplo `knotide-contactos@googlegroups.com`.
  2. Em **Quem pode publicar**, escolha **Toda a Web** (para aceitar os emails do Formspree).
  3. Em **Membros → Adicionar membros**, junte os Gmails que devem receber os contactos (podem ser quantos quiser) e marque a opção para os adicionar diretamente.
  4. No Formspree: **Account → Linked emails → Add email**, e acrescente o email do grupo. O Formspree envia um email de confirmação; como chega a todos os membros, qualquer um pode clicar em "Verify".
  5. No formulário do Formspree: **Settings → Target email**, escolha o email do grupo e guarde.
  6. Envie uma mensagem de teste pelo site: deve chegar a todos os Gmails do grupo.
  Para acrescentar ou retirar pessoas no futuro, basta editar os membros do grupo; o site não precisa de alterações.
- **Histórico**: as mensagens ficam guardadas 30 dias no painel (exporte se precisar de as guardar por mais tempo).
- **Encaminhar por tipo de pedido** (ex. "Licenciamento" para uma pessoa, "Serviços laboratoriais" para outra):
  crie um segundo formulário no Formspree e, no email, use filtros/regras pelo assunto `[Knotide Bio] Licenciamento`.
  O assunto já inclui o tipo de pedido precisamente para permitir isto sem custos.

Se a resposta do Formspree falhar, o visitante vê uma mensagem com ligação direta para `info@knotidebio.pt`,
já preenchida com a mensagem que escreveu.

Mudar de fornecedor (ex. Web3Forms, 250/mês grátis): altere o "Endereço Formspree" nas Definições
**e** atualize as secções 4 e 5 da Política de Privacidade, que nomeiam o Formspree como subcontratante.

## 5. WhatsApp e assistente

- **WhatsApp**: em Definições, preencha o número com indicativo e sem espaços (ex. `351912345678`). Vazio = botão escondido.
  A mensagem pré-preenchida muda com o idioma e edita-se em "WhatsApp e assistente".
- **Assistente**: responde apenas com as respostas escritas em `content/chatbot-kb.json`; não usa IA externa nem inventa conteúdo.
  Quando não encontra resposta, remete para o formulário e para o email. Pode desligá-lo nas Definições.

## 6. Ver o site no seu computador (opcional)

Precisa do Node.js 18 ou superior.

```bash
node src/build.mjs          # gera a pasta dist/
npx serve dist              # abre em http://localhost:3000
```

## 7. Privacidade e cookies

O site não instala cookies. A preferência de idioma fica apenas no navegador do visitante (localStorage).
O mapa do Google só é carregado quando o visitante clica em "Mostrar mapa", por isso não é necessário banner de cookies.
As fontes estão alojadas no próprio site (sem pedidos ao Google Fonts).

## Estrutura

```
content/        textos PT e EN, definições e base do assistente (é aqui que se edita)
assets/         CSS, JavaScript, fontes e imagens
src/build.mjs   gerador do site (sem dependências)
src/gen-cms.mjs gera a configuração do Pages CMS
.pages.yml      configuração do Pages CMS
.github/        publicação automática no GitHub Pages
dist/           site gerado (não editar à mão)
```
