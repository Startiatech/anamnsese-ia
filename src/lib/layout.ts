/**
 * Larguras máximas de conteúdo padronizadas do projeto — fonte única.
 *
 * Use estes tokens em shells/containers novos em vez de `max-w-*` solto, para
 * evitar divergência de valores ao longo do tempo. São dois tiers intencionais
 * (não um valor único): a largura de leitura é menor que o shell do fluxo de
 * atendimento, que precisa acomodar sidebar + conteúdo largo.
 *
 * As classes precisam aparecer como string literal aqui para o Tailwind JIT
 * gerar o CSS correspondente.
 */
export const LAYOUT_MAX_W = {
  /**
   * Conteúdo do `<main>` do app/console — centralizado e **recuado** do shell,
   * com folga simétrica nos dois lados. `max-w-7xl` = 1280px.
   */
  content: 'max-w-7xl',
  /**
   * Shell full-screen — topbar autenticada (user/admin) e o fluxo de atendimento.
   * Mais largo que o conteúdo, então os controles da topbar ficam mais perto do
   * canto. `max-w-screen-2xl` = 1536px (breakpoint topo `2xl`).
   */
  shell: 'max-w-screen-2xl',
  /**
   * Marketing/público (navbar + seções de leitura). `max-w-5xl` = 1024px.
   */
  marketing: 'max-w-5xl',
} as const
