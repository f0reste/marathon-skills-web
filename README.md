# Marathon Skills Web

Веб-версия WPF-приложения Marathon Skills на Next.js с Google OAuth и облачной базой Supabase PostgreSQL.

## Возможности

- вход только через Google;
- защищенная главная страница с именем и фото пользователя;
- регистрация, редактирование и удаление участников;
- загрузка фотографии с проверкой типа и размера;
- расчет BMI и калорий с учетом пола и возраста;
- поиск, фильтрация и сортировка участников;
- хранение данных в Supabase PostgreSQL через защищенные API-маршруты.

## Архитектура

- `auth.js` настраивает Google OAuth и добавляет Google `sub` в `session.user.id`;
- `proxy.js` защищает главную страницу от неавторизованных пользователей;
- `app/api/participants` содержит Serverless API Vercel;
- каждый SQL-запрос обязательно содержит проверку `user_id = session.user.id`;
- `lib/domain.js` содержит бизнес-логику без обращений к интерфейсу;
- `supabase-schema.sql` создает таблицу PostgreSQL.

## Настройка Supabase

1. Создайте бесплатный проект на Supabase.
2. Откройте SQL Editor и выполните файл `supabase-schema.sql`.
3. В разделе Connect скопируйте строку Transaction pooler для serverless-функций.

## Переменные окружения

Создайте `.env.local` для локального запуска и добавьте те же значения в Vercel:

```env
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

Для Vercel установите `NEXTAUTH_URL=https://marathon-skills-web-three.vercel.app`.

В Google Cloud Console добавьте разрешенные redirect URI:

```text
http://localhost:3000/api/auth/callback/google
https://marathon-skills-web-three.vercel.app/api/auth/callback/google
```

## Запуск

```bash
npm install
npm run dev
```
