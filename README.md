# Brand Generator

Conversor open source de assets de marca, em TypeScript, compatível com **Node.js e Bun**.
Coloque seus PNG e SVG em `projetos/<nome>/` e gere versões de 1024 pixels,
favicons, ícones e imagens para compartilhamento.

Nesta versão, o projeto **converte arquivos existentes**. A geração de novas marcas fica para versões futuras.

## Começar

Requisitos: Node.js 22+ ou Bun 1.3+.

```bash
# Com Bun
bun install
bun run convert exemplo

# Ou com Node.js
npm install
npm run convert -- exemplo
```

Os comandos acima convertem o exemplo incluído no repositório. Para sua marca:

```bash
mkdir -p projetos/minha-marca
# Copie os originais PNG/SVG para essa pasta.
bun run convert minha-marca
```

Somente `projetos/exemplo/` é versionado. Os demais projetos e todas as pastas
de saída `1024/` e `web/` são ignorados pelo Git.

`bun run convert` ou `npm run convert` convertem todos os projetos.
Para executar TypeScript diretamente com Bun, use `bun src/cli.ts convert`.
O script `convert` usa `tsx` para executar TypeScript com Node.js; em instalações
sem Node.js, use o comando direto do Bun acima.

## Estrutura

```text
projetos/
└── projectname/
    ├── 1024/
    │   ├── projectname_banner_dark_1024.png
    │   ├── projectname_banner_light_1024.png
    │   ├── projectname_logo_hor_dark_1024.png
    │   ├── projectname_logo_hor_light_1024.png
    │   ├── projectname_logo_icon_1024.png
    │   ├── projectname_logo_square_1024.png
    │   ├── projectname_logo_square_black_1024.png
    │   └── projectname_logo_text_1024.png
    ├── web/
    │   ├── android-chrome-192x192.png
    │   ├── android-chrome-512x512.png
    │   ├── apple-touch-icon-precomposed.png
    │   ├── apple-touch-icon.png
    │   ├── favicon-16x16.png
    │   ├── favicon-32x32.png
    │   ├── favicon-96x96.png
    │   ├── favicon.ico
    │   ├── icons/
    │   │   ├── icon-48x48.png
    │   │   ├── icon-72x72.png
    │   │   ├── icon-96x96.png
    │   │   ├── icon-128x128.png
    │   │   ├── icon-192x192.png
    │   │   ├── icon-384x384.png
    │   │   └── icon-512x512.png
    │   ├── og-image-dark.webp
    │   └── og-image-light.webp
    ├── projectname_banner_dark.png
    ├── projectname_banner_light.png
    ├── projectname_logo_hor_dark.svg
    ├── projectname_logo_hor_light.svg
    ├── projectname_logo_icon.svg
    ├── projectname_logo_square.png
    ├── projectname_logo_square_black.png
    └── projectname_logo_text.svg
```

## Nomes dos originais

Cada original pode ser **PNG ou SVG**, independentemente das extensões no exemplo.
Use o nome da pasta como prefixo (`projectname_logo_icon.svg`) ou apenas o papel
(`logo_icon.svg`). Se existirem os dois, o nome com prefixo tem prioridade para web.

| Papel | Uso |
| --- | --- |
| `banner_dark`, `banner_light` | Imagens Open Graph por tema |
| `logo_hor_dark`, `logo_hor_light` | Alternativa ao banner do mesmo tema |
| `logo_icon` | Fonte preferencial dos ícones web |
| `logo_square` | Alternativa ao ícone |
| `logo_square_black` | Última alternativa ao ícone |
| `logo_text` | Versão de 1024 pixels |

Arquivos com **nomes livres** também são convertidos: `simbolo.svg` vira
`1024/simbolo_1024.png`. Eles não recebem um papel web automaticamente.
Se houver PNG e SVG com o mesmo nome-base, o SVG tem prioridade e a CLI avisa.
Extensões e identificação dos papéis não diferenciam maiúsculas de minúsculas.

## Dimensões e transparência

| Saída | Regra |
| --- | --- |
| `1024/*.png` | Maior lado de 1024 px, proporção e transparência preservadas |
| Android | 192×192 e 512×512 |
| Apple, incluindo `precomposed` | 180×180 |
| Favicon PNG | 16×16, 32×32 e 96×96 |
| `favicon.ico` | Frames PNG de 16×16, 32×32 e 48×48 em um contêiner ICO |
| `web/icons/*.png` | 48, 72, 96, 128, 192, 384 e 512 px, sempre quadrados |
| Open Graph | 1200×630, WebP com qualidade 90 |

As imagens nunca são esticadas ou cortadas. Um banner de 2400×800 vira
1024×341; um ícone quadrado vira 1024×1024. Fontes menores são ampliadas:
prefira SVG ou PNG de alta resolução para evitar perda de nitidez.

Ícones web recebem margens transparentes quando a fonte não é quadrada.
Open Graph centraliza a arte, preserva a proporção e preenche o fundo com
`#111827` no tema dark e `#ffffff` no light. A arte original não é recolorida.
Sem banner, usa o logo horizontal do mesmo tema e depois o ícone disponível.
Sem fonte compatível, a saída correspondente é omitida com um aviso.

Os SVGs são rasterizados na resolução de destino. Para resultados portáveis,
use vetores autocontidos, incorpore imagens e converta textos em curvas:
fontes instaladas na máquina podem alterar a renderização.
O processamento usa [Sharp](https://sharp.pixelplumbing.com/), com
[ajuste proporcional](https://sharp.pixelplumbing.com/api-resize/).

## CLI

```bash
# Todos os projetos
bun run convert

# Só um projeto
bun run convert projectname

# Só um conjunto de saídas
bun run convert projectname --only 1024
bun run convert projectname --only web

# Outra pasta de projetos (inclusive caminhos com espaços)
bun run convert --root "./outras marcas"

# Node.js: separe os argumentos com --
npm run convert -- projectname --only web

# Ajuda
bun src/cli.ts --help
```

As pastas de saída são criadas automaticamente. Reexecutar substitui os arquivos
gerados de mesmo nome. Originais permanecem intactos; arquivos antigos sem
correspondência nas entradas atuais não são removidos. Apenas arquivos diretamente
na pasta do projeto são lidos, sem seguir links simbólicos ou reprocessar saídas.

PNG/SVG inválidos fazem o projeto falhar e retornam código de saída 1; a conversão
dos demais projetos continua. Arquivos já gerados antes do erro são mantidos.
Pastas vazias e fontes web ausentes geram avisos, sem erro fatal.

## API

Após `npm run build` (ou `bun run build`), importe o módulo compilado:

```ts
import { convertProject, type ConvertOptions } from './dist/converter.js';

const options: ConvertOptions = { only: 'all' }; // all | 1024 | web
const { name, files, warnings } = await convertProject('projetos/projectname', options);
console.log(name, files, warnings);
```

## Desenvolvimento

```bash
npm run check  # Verificação de tipos, incluindo os testes
npm test       # Testes TypeScript no Node.js via tsx
bun test       # Testes TypeScript diretamente no Bun
npm run build  # JavaScript ESM e declarações .d.ts em dist/
```

O TypeScript usa modo estrito. O build gera a CLI `dist/cli.js`, executável com
`node dist/cli.js convert`, e os tipos públicos da API. `dist/` é ignorado pelo Git;
o empacotamento com `npm pack` compila automaticamente.

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Licença [MIT](LICENSE).
