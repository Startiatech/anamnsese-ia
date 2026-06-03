# LP — corrige hydration mismatch no footer (Radix Tooltip → title nativo)

**Data:** 2026-06-02

## Problema

No console do navegador, a landing page (`/`) acusava:

```
Hydration failed because the server rendered HTML didn't match the client.
```

O diff do React apontava os `<a>` sociais do footer (Portfólio/LinkedIn/WhatsApp)
com `data-state="closed"` — atributos do Radix `Tooltip` que eu havia adicionado.

Causa: `LandingFooter` é um **Server Component estático** numa página pública, e o
Radix `Tooltip` (client) gera markup que descasa entre SSR e hidratação nesses
gatilhos. O tooltip ali era ainda **redundante** — o texto já existe no `aria-label`.

(Aviso separado e benigno: `theme-provider.tsx` "Encountered a script tag" é do
next-themes injetando o script anti-flash; conhecido no React 19, não é erro.)

## Correção

`src/components/landing/landing-footer.tsx`
- Remove o Radix `Tooltip`/`TooltipProvider` do footer.
- `SocialLink` usa `title={label}` nativo no `<a>` (dica no hover) + mantém
  `aria-label`. Footer volta a ser server component limpo, sem JS de client.

Os tooltips Radix do **app autenticado** (theme-toggle, sino de notificações)
**permanecem** — lá são client components, sem SSR, sem esse mismatch.

## TDD

- `landing-footer.test.tsx` — substitui os testes de "tooltip ao focar" por
  asserção de `title` nativo nos 3 links. 4/4 verdes.

## Aprendizado / regra

Radix Tooltip (e componentes Radix com estado/portal) em **server components
estáticos** podem causar hydration mismatch — preferir `title` nativo nesses casos.
Tooltip estilizado (Radix) só onde já há client component e interação real.
