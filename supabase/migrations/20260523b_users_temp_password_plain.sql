-- Armazena senha temporaria em texto plano enquanto password_is_temp=true.
-- Permite que master consulte credenciais (Ver credenciais) sem precisar
-- regerar a senha — evita resetar acidentalmente um usuario que ja trocou.
--
-- A coluna eh setada em /api/admin/create-user e LIMPADA em
-- /api/users/me PATCH no momento em que o usuario troca a senha.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS temp_password_plain text;
