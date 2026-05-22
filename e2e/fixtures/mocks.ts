import type { Page } from '@playwright/test'

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
