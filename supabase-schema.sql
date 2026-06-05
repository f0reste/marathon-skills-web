create extension if not exists pgcrypto;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  first_name text not null,
  last_name text not null,
  gender text not null check (gender in ('Мужской', 'Женский')),
  birth_date date not null,
  email text not null,
  phone text not null,
  country text not null,
  height_cm numeric(5, 1) not null check (height_cm between 80 and 250),
  weight_kg numeric(5, 1) not null check (weight_kg between 20 and 300),
  bmi numeric(6, 3) not null,
  calories integer not null,
  photo_name text,
  photo_data_url text,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_user_id_idx on participants (user_id);
create index if not exists participants_last_name_lower_idx on participants (lower(last_name));

create or replace view telegram_lookup as
select
  last_name as surname,
  concat('ИМТ ', round(bmi::numeric, 1), ', калории ', calories, ' ккал') as value
from participants;
