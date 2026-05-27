import type { Page } from '@playwright/test'

/**
 * Injeta um mock de `navigator.mediaDevices.getUserMedia` que retorna um
 * MediaStream sintético (via AudioContext + createMediaStreamDestination),
 * cujo audio track suporta addEventListener/dispatchEvent nativamente.
 *
 * O stream é exposto em `window.__lastMediaStream` para que o teste possa
 * disparar eventos 'ended' na track e simular interrupção de gravação.
 *
 * Deve ser chamado antes de qualquer navegação para a página que usa a API.
 */
export async function mockMediaDevices(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalGetUserMedia =
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)

    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      writable: true,
      value: async function (constraints: MediaStreamConstraints) {
        // Tenta criar stream sintético via AudioContext para que a track
        // seja um objeto real que suporte dispatchEvent('ended').
        try {
          const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext; __lastMediaStream?: MediaStream }
          const AudioCtx = win.AudioContext || win.webkitAudioContext
          if (AudioCtx) {
            const ctx = new AudioCtx()
            const osc = ctx.createOscillator()
            const dest = ctx.createMediaStreamDestination()
            osc.connect(dest)
            osc.start()
            const stream = dest.stream
            // Expõe para o teste
            win.__lastMediaStream = stream
            return stream
          }
        } catch (_) {
          // fallback abaixo
        }

        // Fallback: tenta getUserMedia real (pode falhar em headless)
        if (originalGetUserMedia) {
          const stream = await originalGetUserMedia(constraints)
          ;(window as unknown as { __lastMediaStream?: MediaStream }).__lastMediaStream = stream
          return stream
        }

        throw new DOMException('Microfone não disponível', 'NotAllowedError')
      },
    })
  })
}

// Shapes reais das APIs (inspecionadas em src/app/api/{transcribe,anamnesis,anamnesis/refine}/route.ts):
//
// - POST /api/transcribe
//     Request: multipart/form-data (audio: File, patientId: string)
//     Response: text/plain stream — chunks de texto + marcador final "__DONE__\n"
//               (em caso de erro, "__ERROR__:<mensagem>\n")
//
// - POST /api/anamnesis
//     Request: { transcript, sections, patientId? }
//     Response: { sections: [{ title, content }] }
//
// - POST /api/anamnesis/refine
//     Request: { sections, instruction, patientId }
//     Response: { sections: [{ title, content }], refinementCount: number }

const MOCK_TRANSCRIPT =
  'Paciente refere dor lombar ha 3 dias, sem irradiacao. Nega febre.'

const MOCK_SECTIONS = [
  { title: 'Queixa Principal', content: 'Dor lombar ha 3 dias.' },
  {
    title: 'Historia da Doenca Atual',
    content:
      'Iniciada ha 3 dias, sem irradiacao, sem febre. Sem fatores de melhora ou piora identificados.',
  },
  { title: 'Antecedentes', content: 'Nao informado na consulta.' },
  { title: 'Exame Fisico', content: 'Nao informado na consulta.' },
  { title: 'Hipotese Diagnostica', content: 'Lombalgia mecanica.' },
  {
    title: 'Conduta',
    content: 'Repouso relativo, analgesico simples, reavaliacao em 7 dias.',
  },
]

export async function mockAiEndpoints(page: Page): Promise<void> {
  // /api/transcribe — streaming text/plain, terminado com __DONE__
  await page.route('**/api/transcribe', async (route) => {
    const body = `${MOCK_TRANSCRIPT}\n__DONE__\n`
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body,
    })
  })

  // /api/anamnesis — JSON { sections: [{ title, content }] }
  await page.route('**/api/anamnesis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sections: MOCK_SECTIONS }),
    })
  })

  // /api/anamnesis/refine — JSON { sections: [...], refinementCount: number }
  await page.route('**/api/anamnesis/refine', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sections: MOCK_SECTIONS, refinementCount: 1 }),
    })
  })
}
