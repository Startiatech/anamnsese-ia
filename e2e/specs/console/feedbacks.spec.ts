import { test, expect, type Page } from '@playwright/test'
import { loginAsMasterViaCookie } from '../../fixtures/session'
import { createTestUser, makeE2eId } from '../../fixtures/auth'
import { getTestSupabase } from '../../fixtures/supabase'

/**
 * Console / Feedbacks (`/console/feedbacks`):
 *
 * Page server (src/app/(admin)/console/feedbacks/page.tsx) restringe acesso
 * a `role === 'admin' | 'master'`, busca `FeedbackRepository.getMetrics()` e
 * `FeedbackRepository.listAll({ page: 0, pageSize: 20 })` e renderiza
 * `FeedbacksClient`.
 *
 * Client (src/app/(admin)/console/feedbacks/feedbacks-client.tsx):
 *  - PageHeader "Feedback Intelligence"
 *  - Grid de 4 metricas (Satisfacao, Conversao, Upgrades, Churn)
 *  - Lista "Depoimentos Recentes" com:
 *      - StarRow (rating 1-5)
 *      - Badge de action_taken (UPGRADE / CANCELADO / PENDENTE)
 *      - data formatada pt-BR
 *      - link mailto:email
 *      - link wa.me/55<phone> (somente se userPhone)
 *      - mensagem entre aspas (somente se message)
 *      - linha com userName e userEmail
 *  - Estado vazio: Empty com botao Atualizar (router.refresh)
 *
 * Nao ha filtros, modal de detalhe ou acoes admin na UI atual — cobrimos
 * apenas o que esta exposto. sentiment_score nao eh renderizado.
 *
 * Estrategia de isolamento: usuarios de teste criados via `createTestUser`
 * (prefixo e2e-*@test.com) e feedbacks vinculados ao user_id. Cleanup global
 * remove feedbacks por user_id em globalTeardown (ver e2e/fixtures/seed.ts).
 */

const SEED_PLAN_ID = 'experimental'

interface SeededFeedback {
  id: string
  userId: string
  userEmail: string
  rating: number
  message: string
  actionTaken: 'pending' | 'upgrade_modal' | 'upgrade_organic' | 'declined'
}

async function seedFeedback(opts: {
  rating: number
  message: string
  actionTaken: SeededFeedback['actionTaken']
  sentimentScore?: number | null
  sentimentLabel?: string | null
}): Promise<SeededFeedback> {
  const user = await createTestUser({ role: 'user', planId: SEED_PLAN_ID })
  const supabase = getTestSupabase()
  const { data, error } = await supabase
    .from('feedbacks')
    .insert({
      user_id: user.id,
      rating: opts.rating,
      message: opts.message,
      plan_id: SEED_PLAN_ID,
      action_taken: opts.actionTaken,
      sentiment_score: opts.sentimentScore ?? null,
      sentiment_label: opts.sentimentLabel ?? null,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`[e2e] seedFeedback falhou: ${error?.message}`)
  }
  return {
    id: (data as { id: string }).id,
    userId: user.id,
    userEmail: user.email,
    rating: opts.rating,
    message: opts.message,
    actionTaken: opts.actionTaken,
  }
}

async function deleteFeedback(id: string): Promise<void> {
  const supabase = getTestSupabase()
  await supabase.from('feedbacks').delete().eq('id', id)
}

async function disableSonnerPointerEvents(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toaster], [data-sonner-toast]')
      .forEach((el) => ((el as HTMLElement).style.pointerEvents = 'none'))
  })
}

test.describe('console feedbacks (admin)', () => {
  test.setTimeout(90_000)

  test('master ve pagina de feedbacks com header e 4 cards de metricas', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    await page.goto('/console/feedbacks')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { level: 1, name: /feedback intelligence/i })).toBeVisible()
    await expect(page.getByText(/analise o sentimento dos usuários e otimize a conversão/i)).toBeVisible()

    // 4 labels de metricas
    await expect(page.getByText(/^satisfação$/i)).toBeVisible()
    await expect(page.getByText(/^conversão$/i)).toBeVisible()
    await expect(page.getByText(/^upgrades$/i)).toBeVisible()
    await expect(page.getByText(/^churn$/i)).toBeVisible()

    // Heading da lista
    await expect(page.getByRole('heading', { name: /depoimentos recentes/i })).toBeVisible()
  })

  test('feedback com action upgrade_modal e mensagem aparece na lista com badge UPGRADE', async ({ page, context }, testInfo) => {
    await loginAsMasterViaCookie(context)

    const uniqueMsg = `e2e-feedback-upgrade ${makeE2eId('msg')}`
    const seeded = await seedFeedback({
      rating: 5,
      message: uniqueMsg,
      actionTaken: 'upgrade_modal',
    })

    try {
      await page.goto('/console/feedbacks')
      await page.waitForLoadState('networkidle')

      if (testInfo.project.name === 'mobile') {
        await disableSonnerPointerEvents(page)
      }

      // Mensagem renderizada entre aspas
      await expect(page.getByText(new RegExp(uniqueMsg))).toBeVisible()

      // Card contem o email do user seedado
      await expect(page.getByText(seeded.userEmail).first()).toBeVisible()

      // Badge UPGRADE no card que contem a mensagem unica
      const card = page.locator('div', { hasText: uniqueMsg }).filter({ has: page.getByText(/^UPGRADE$/) }).first()
      await expect(card).toBeVisible()

      // Link mailto: presente
      const mailLink = page.locator(`a[href="mailto:${seeded.userEmail}"]`).first()
      await expect(mailLink).toBeVisible()
    } finally {
      await deleteFeedback(seeded.id)
    }
  })

  test('feedback com action declined exibe badge CANCELADO', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    const uniqueMsg = `e2e-feedback-declined ${makeE2eId('msg')}`
    const seeded = await seedFeedback({
      rating: 2,
      message: uniqueMsg,
      actionTaken: 'declined',
    })

    try {
      await page.goto('/console/feedbacks')
      await page.waitForLoadState('networkidle')

      await expect(page.getByText(new RegExp(uniqueMsg))).toBeVisible()

      const card = page.locator('div', { hasText: uniqueMsg }).filter({ has: page.getByText(/^CANCELADO$/) }).first()
      await expect(card).toBeVisible()
    } finally {
      await deleteFeedback(seeded.id)
    }
  })

  test('feedback com action pending exibe badge PENDENTE', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    const uniqueMsg = `e2e-feedback-pending ${makeE2eId('msg')}`
    const seeded = await seedFeedback({
      rating: 3,
      message: uniqueMsg,
      actionTaken: 'pending',
    })

    try {
      await page.goto('/console/feedbacks')
      await page.waitForLoadState('networkidle')

      await expect(page.getByText(new RegExp(uniqueMsg))).toBeVisible()

      const card = page.locator('div', { hasText: uniqueMsg }).filter({ has: page.getByText(/^PENDENTE$/) }).first()
      await expect(card).toBeVisible()
    } finally {
      await deleteFeedback(seeded.id)
    }
  })

  test('metricas refletem feedbacks seedados (Upgrades e Churn incrementam)', async ({ page, context }) => {
    await loginAsMasterViaCookie(context)

    // Captura totais antes
    const supabase = getTestSupabase()
    const { data: beforeRows } = await supabase.from('feedbacks').select('action_taken')
    const before = (beforeRows ?? []) as Array<{ action_taken: string }>
    const beforeUpgrades = before.filter(
      (r) => r.action_taken === 'upgrade_modal' || r.action_taken === 'upgrade_organic',
    ).length
    const beforeChurn = before.filter((r) => r.action_taken === 'declined').length

    const upgrade = await seedFeedback({
      rating: 5,
      message: `e2e-metric-upgrade ${makeE2eId('m')}`,
      actionTaken: 'upgrade_organic',
    })
    const churn = await seedFeedback({
      rating: 1,
      message: `e2e-metric-churn ${makeE2eId('m')}`,
      actionTaken: 'declined',
    })

    try {
      await page.goto('/console/feedbacks')
      await page.waitForLoadState('networkidle')

      // Card "Upgrades" tem valor numerico >= beforeUpgrades + 1
      const upgradesLabel = page.getByText(/^upgrades$/i).first()
      const upgradesCard = upgradesLabel.locator('xpath=ancestor::*[contains(@class,"pt-5")][1]')
      const upgradesValue = upgradesCard.locator('p.text-2xl').first()
      await expect(upgradesValue).toBeVisible()
      const upgradesText = (await upgradesValue.textContent()) ?? ''
      const upgradesNum = Number(upgradesText.trim())
      expect(upgradesNum).toBeGreaterThanOrEqual(beforeUpgrades + 1)

      const churnLabel = page.getByText(/^churn$/i).first()
      const churnCard = churnLabel.locator('xpath=ancestor::*[contains(@class,"pt-5")][1]')
      const churnValue = churnCard.locator('p.text-2xl').first()
      await expect(churnValue).toBeVisible()
      const churnText = (await churnValue.textContent()) ?? ''
      const churnNum = Number(churnText.trim())
      expect(churnNum).toBeGreaterThanOrEqual(beforeChurn + 1)
    } finally {
      await deleteFeedback(upgrade.id)
      await deleteFeedback(churn.id)
    }
  })
})
