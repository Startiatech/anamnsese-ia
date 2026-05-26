-- Expande o CHECK constraint de notifications.type para incluir 'credit_injected'
-- (usado para notificar usuario quando o master injeta creditos cortesia)

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['info'::text, 'feature'::text, 'warning'::text, 'credit_injected'::text]));
