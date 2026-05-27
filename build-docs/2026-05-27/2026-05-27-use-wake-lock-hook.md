# 2026-05-27 — Hook de Wake Lock

## Tarefa
Task 4: `use-wake-lock` — mantém a tela ativa durante gravação de áudio.

## Arquivos alterados
- `src/hooks/use-wake-lock.ts` — implementação do hook
- `src/hooks/use-wake-lock.test.ts` — testes (4 casos)

## Comportamento
- `acquire()` — solicita `navigator.wakeLock.request('screen')`; degradação graciosa se API indisponível
- `release()` — libera o sentinel e limpa a ref
- Cleanup no `useEffect` libera o sentinel no unmount
- `visibilitychange` re-adquire o lock ao retornar ao primeiro plano (browser libera automaticamente ao esconder a aba)

## Testes
```
Test Files  1 passed (1)
Tests       4 passed (4)
```

## Commit
`3bad32a` feat(audio): hook de wake lock para manter tela ativa na gravacao
