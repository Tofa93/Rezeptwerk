create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  title text not null,
  note text,
  category text not null default '',
  time_minutes integer not null default 0,
  servings integer not null default 1,
  difficulty text not null default 'Einfach',
  prep_time_minutes integer not null default 0,
  cook_time_minutes integer not null default 0,
  ingredients text[] not null default '{}',
  steps text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes alter column user_id drop not null;
alter table public.recipes add column if not exists is_public boolean not null default true;
alter table public.recipes alter column is_public set default true;
alter table public.recipes alter column category set default '';
alter table public.recipes add column if not exists updated_at timestamptz not null default now();
alter table public.recipes enable row level security;

create index if not exists recipes_user_id_idx on public.recipes(user_id);
create index if not exists recipes_public_created_idx on public.recipes(is_public, created_at desc);

drop policy if exists "Users can read their own recipes" on public.recipes;
drop policy if exists "Users can read visible recipes" on public.recipes;
create policy "Users can read visible recipes"
  on public.recipes
  for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can create their own recipes" on public.recipes;
create policy "Users can create their own recipes"
  on public.recipes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own recipes" on public.recipes;
create policy "Users can update their own recipes"
  on public.recipes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recipes" on public.recipes;
create policy "Users can delete their own recipes"
  on public.recipes
  for delete
  using (auth.uid() = user_id);

create table if not exists public.recipe_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.recipe_favorites enable row level security;

create index if not exists recipe_favorites_recipe_id_idx on public.recipe_favorites(recipe_id);
create index if not exists recipe_favorites_created_idx on public.recipe_favorites(user_id, created_at desc);

drop policy if exists "Users can read their favorites" on public.recipe_favorites;
create policy "Users can read their favorites"
  on public.recipe_favorites
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their favorites" on public.recipe_favorites;
create policy "Users can create their favorites"
  on public.recipe_favorites
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their favorites" on public.recipe_favorites;
create policy "Users can delete their favorites"
  on public.recipe_favorites
  for delete
  using (auth.uid() = user_id);

insert into public.recipes (
  id,
  user_id,
  is_public,
  title,
  note,
  category,
  time_minutes,
  servings,
  difficulty,
  prep_time_minutes,
  cook_time_minutes,
  ingredients,
  steps
) values
  (
    '11111111-1111-4111-8111-111111111111',
    null,
    true,
    'Grüne Pasta mit Zitrone',
    'Frisch, cremig und gut für volle Wochentage.',
    'Schnell',
    22,
    2,
    'Einfach',
    8,
    14,
    array['Pasta', 'Spinat', 'Zitrone', 'Parmesan'],
    'Pasta kochen. Spinat mit Zitronensaft und etwas Pastawasser kurz cremig mixen. Alles mit Parmesan vermengen und abschmecken.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    null,
    true,
    'Ofengemüse mit Feta',
    'Ein Blech, wenig Abwasch, viel Farbe.',
    'Vegetarisch',
    40,
    3,
    'Einfach',
    15,
    25,
    array['Süßkartoffel', 'Paprika', 'Feta', 'Kichererbsen'],
    'Gemüse grob schneiden und mit Öl, Salz und Gewürzen mischen. Auf einem Blech backen, Feta am Ende darüber bröseln.'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    null,
    true,
    'Tomatenreis für alle',
    'Mild, sättigend und gut vorzubereiten.',
    'Familie',
    35,
    4,
    'Einfach',
    10,
    25,
    array['Reis', 'Tomaten', 'Erbsen', 'Kräuter'],
    'Reis mit Tomaten und Brühe garen. Erbsen kurz vor Ende zugeben. Mit frischen Kräutern und etwas Öl servieren.'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    null,
    true,
    'Couscous-Box',
    'Kalt genauso stark wie warm.',
    'Meal Prep',
    18,
    2,
    'Einfach',
    12,
    6,
    array['Couscous', 'Gurke', 'Tomate', 'Joghurt'],
    'Couscous quellen lassen. Gemüse würfeln. Joghurt mit Salz, Zitrone und Kräutern verrühren. Alles in Boxen schichten.'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    null,
    true,
    'Pilzpfanne mit Kartoffeln',
    'Rustikal, herzhaft und unkompliziert.',
    'Vegetarisch',
    45,
    2,
    'Mittel',
    15,
    30,
    array['Kartoffeln', 'Champignons', 'Zwiebeln', 'Petersilie'],
    'Kartoffeln vorkochen und anbraten. Pilze und Zwiebeln separat kräftig rösten. Zusammenführen und mit Petersilie abschließen.'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    null,
    true,
    'Schnelle Linsensuppe',
    'Wärmend und in einem Topf fertig.',
    'Schnell',
    28,
    3,
    'Einfach',
    8,
    20,
    array['Rote Linsen', 'Karotte', 'Kokosmilch', 'Curry'],
    'Karotte anschwitzen, Linsen und Curry zugeben. Mit Brühe garen, Kokosmilch einrühren und cremig abschmecken.'
  )
on conflict (id) do update set
  is_public = excluded.is_public,
  title = excluded.title,
  note = excluded.note,
  category = excluded.category,
  time_minutes = excluded.time_minutes,
  servings = excluded.servings,
  difficulty = excluded.difficulty,
  prep_time_minutes = excluded.prep_time_minutes,
  cook_time_minutes = excluded.cook_time_minutes,
  ingredients = excluded.ingredients,
  steps = excluded.steps;

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload recipe images" on storage.objects;
create policy "Users can upload recipe images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Recipe images are public" on storage.objects;
create policy "Recipe images are public"
  on storage.objects
  for select
  using (bucket_id = 'recipe-images');

drop policy if exists "Users can update their own recipe images" on storage.objects;
create policy "Users can update their own recipe images"
  on storage.objects
  for update
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own recipe images" on storage.objects;
create policy "Users can delete their own recipe images"
  on storage.objects
  for delete
  using (
    bucket_id = 'recipe-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
