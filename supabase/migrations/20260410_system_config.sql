create table if not exists system_config (
  key   text primary key,
  value text not null
);

insert into system_config (key, value)
values ('default_credits', '5')
on conflict (key) do nothing;
