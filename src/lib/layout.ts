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
   * Conteúdo reading/form-centric: app, console, topbars e navbar pública.
   * `max-w-5xl` = 1024px.
   */
  content: 'max-w-5xl',
  /**
   * Shell de fluxo full-screen (atendimento/wizard) — sidebar `w-64` +
   * conteúdo até `max-w-6xl`. `max-w-screen-2xl` = 1536px (breakpoint topo `2xl`).
   */
  shell: 'max-w-screen-2xl',
} as const
