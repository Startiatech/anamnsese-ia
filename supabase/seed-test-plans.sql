-- Seed dos planos no banco de teste (anamnese-ia-com-claude-code--teste).
-- Necessario porque varias rotas (ex: /api/admin/create-user) inserem usuarios
-- com plan_id='experimental' (FK para plans.id). Sem este seed, INSERT em users
-- estoura FK violation -> HTTP 500.
--
-- Aplicar UMA VEZ no banco de TESTE. Producao ja tem.

INSERT INTO public.plans (id, name, description, price, quota, active, features, sort_order)
VALUES
  (
    'experimental',
    'Experimental',
    'Conheça o poder da IA na sua rotina clínica.',
    0,
    5,
    true,
    '[{"id":"f1","label":"5 Crédito(s) para teste(s)","active":true},{"id":"f2","label":"Envio de Arquivos Áudio","active":true},{"id":"f3","label":"Inteligência Clínica Avançada (Raciocínio & Conduta)","active":true},{"id":"f4","label":"Transcrição de Alta Precisão (Whisper V3)","active":true},{"id":"f5","label":"Até 2 tentativas de envio por áudio","limit":2,"active":true},{"id":"f6","label":"Até 3 refinamentos de IA por anamnese","limit":3,"active":true},{"id":"f7","label":"Exportação Clínica Profissional (PDF/DOCX)","active":true},{"id":"f8","label":"Histórico Completo de Atendimentos","active":true},{"id":"f9","label":"Segurança de Dados & Conformidade LGPD","active":true},{"id":"f10","label":"Privacidade Transiente (Zero-Persistence Cloud)","active":true},{"id":"f11","label":"Suporte VIP via WhatsApp","active":true}]'::jsonb,
    1
  ),
  (
    'profissional',
    'Profissional',
    'Para profissionais com volume moderado de atendimentos.',
    97,
    50,
    false,
    '[{"id":"f1","label":"50 atendimentos/mês","active":true},{"id":"f2","label":"Envio de Arquivos Áudio","active":true},{"id":"f3","label":"Inteligência Clínica Avançada (Raciocínio & Conduta)","active":true},{"id":"f4","label":"Transcrição de Alta Precisão (Whisper V3)","active":true},{"id":"f5","label":"Tentativas ilimitadas de envio por áudio","limit":null,"active":true},{"id":"f6","label":"Refinamentos ilimitados de IA por anamnese","limit":null,"active":true},{"id":"f7","label":"Exportação Clínica Profissional (PDF/DOCX)","active":true},{"id":"f8","label":"Histórico Completo de Atendimentos","active":true},{"id":"f9","label":"Segurança de Dados & Conformidade LGPD","active":true},{"id":"f10","label":"Suporte VIP via WhatsApp","active":true}]'::jsonb,
    2
  )
ON CONFLICT (id) DO NOTHING;
