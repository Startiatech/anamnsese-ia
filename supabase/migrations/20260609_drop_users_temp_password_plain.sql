-- Remove o armazenamento de senha temporaria em texto plano.
--
-- Substituido pelo fluxo "Reenviar credenciais" (POST /api/admin/requests/[id]/
-- view-credentials): em vez de guardar a senha recuperavel, geramos uma nova
-- senha temporaria (CSPRNG), persistimos apenas o hash e devolvemos o texto
-- plano uma unica vez na resposta. Nenhuma credencial recuperavel fica no banco.
--
-- Boas praticas (OWASP ASVS): senhas nunca devem ser armazenadas de forma
-- reversivel — apenas hash unidirecional.

ALTER TABLE public.users
DROP COLUMN IF EXISTS temp_password_plain;
