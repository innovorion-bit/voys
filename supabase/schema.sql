-- ==============================================================================
-- Voys Supabase Database Schema & RLS Policies (Idempotent / Tekrar Çalıştırılabilir)
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Profiles Table (Auth Users Extension)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  display_name text,
  avatar_url text,
  game text default '',
  substatus text default 'Çevrimiçi',
  status text default 'online',
  email text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Backward compatibility columns
alter table public.profiles add column if not exists email text;
drop index if exists public.profiles_username_tag_idx;
alter table public.profiles drop column if exists tag;

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" 
  on public.profiles for select using (true);

drop policy if exists "Users can insert/update their own profile." on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" 
  on public.profiles for insert 
  to authenticated 
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" 
  on public.profiles for update 
  to authenticated 
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Trigger to automatically create a profile for new auth.users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_user_name text;
begin
  raw_user_name := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'kullanici');
  
  insert into public.profiles (id, username, display_name, avatar_url, email)
  values (
    new.id,
    raw_user_name,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', raw_user_name),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Channels Table
create table if not exists public.channels (
  id text primary key,
  name text not null,
  type text not null check (type in ('text', 'voice')),
  is_home boolean default false,
  created_by uuid references auth.users on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.channels enable row level security;

drop policy if exists "Channels are viewable by everyone." on public.channels;
drop policy if exists "Channels are viewable by everyone" on public.channels;
create policy "Channels are viewable by everyone" 
  on public.channels for select using (true);

drop policy if exists "Authenticated users can create channels." on public.channels;
drop policy if exists "Authenticated users can create channels" on public.channels;
create policy "Authenticated users can create channels" 
  on public.channels for insert 
  to authenticated 
  with check ((select auth.uid()) = created_by or created_by is null);

-- Insert default home and sesli sohbet channels if empty
insert into public.channels (id, name, type, is_home)
values 
  ('home', 'Home', 'text', true),
  ('voice-sesli-sohbet', 'SESLİ SOHBET', 'voice', false)
on conflict (id) do nothing;

-- 3. Channel Members Table
create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id text references public.channels(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('admin', 'moderator', 'member')) default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  unique (channel_id, user_id)
);

alter table public.channel_members enable row level security;

drop policy if exists "Channel members are viewable by everyone." on public.channel_members;
drop policy if exists "Channel members are viewable by everyone" on public.channel_members;
create policy "Channel members are viewable by everyone" 
  on public.channel_members for select using (true);

drop policy if exists "Anyone can insert channel members." on public.channel_members;
drop policy if exists "Authenticated users can join channels" on public.channel_members;
create policy "Authenticated users can join channels" 
  on public.channel_members for insert 
  to authenticated 
  with check ((select auth.uid()) = user_id);

drop policy if exists "Anyone can delete channel members." on public.channel_members;
drop policy if exists "Users can leave channels" on public.channel_members;
create policy "Users can leave channels" 
  on public.channel_members for delete 
  to authenticated 
  using ((select auth.uid()) = user_id);

-- 4. Channel Messages Table
create table if not exists public.channel_messages (
  id text primary key,
  channel_id text references public.channels(id) on delete cascade not null,
  sender_id text not null,
  sender_name text not null,
  sender_avatar text,
  color text default '#90ba3c',
  has_crown boolean default false,
  lines jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  parent_id text,
  reply_to jsonb,
  reactions jsonb default '[]'::jsonb,
  timestamp_text text,
  sent_at bigint default (extract(epoch from now()) * 1000)::bigint,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.channel_messages enable row level security;

drop policy if exists "Channel messages are viewable by everyone." on public.channel_messages;
drop policy if exists "Channel messages are viewable by everyone" on public.channel_messages;
create policy "Channel messages are viewable by everyone" 
  on public.channel_messages for select using (true);

drop policy if exists "Anyone can insert channel messages." on public.channel_messages;
drop policy if exists "Authenticated users can insert channel messages" on public.channel_messages;
create policy "Authenticated users can insert channel messages" 
  on public.channel_messages for insert 
  to authenticated 
  with check ((select auth.uid())::text = sender_id);

drop policy if exists "Anyone can update reactions on channel messages." on public.channel_messages;
drop policy if exists "Authenticated users can update reactions" on public.channel_messages;
create policy "Authenticated users can update reactions" 
  on public.channel_messages for update 
  to authenticated 
  using (true) 
  with check (true);

-- 5. Direct Messages (DM) Table
create table if not exists public.direct_messages (
  id text primary key,
  room_id text not null,
  sender_id text not null,
  receiver_id text not null,
  sender_name text not null,
  sender_avatar text,
  color text default '#90ba3c',
  has_crown boolean default false,
  lines jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  parent_id text,
  reply_to jsonb,
  reactions jsonb default '[]'::jsonb,
  timestamp_text text,
  sent_at bigint default (extract(epoch from now()) * 1000)::bigint,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.direct_messages enable row level security;

drop policy if exists "Direct messages are viewable by participants." on public.direct_messages;
drop policy if exists "Direct messages are viewable by participants" on public.direct_messages;
create policy "Direct messages are viewable by participants" 
  on public.direct_messages for select 
  to authenticated 
  using ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id);

drop policy if exists "Direct messages can be inserted." on public.direct_messages;
drop policy if exists "Direct messages can be inserted" on public.direct_messages;
create policy "Direct messages can be inserted" 
  on public.direct_messages for insert 
  to authenticated 
  with check ((select auth.uid())::text = sender_id);

drop policy if exists "Direct messages reactions can be updated." on public.direct_messages;
drop policy if exists "Direct messages reactions can be updated" on public.direct_messages;
create policy "Direct messages reactions can be updated" 
  on public.direct_messages for update 
  to authenticated 
  using ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id)
  with check ((select auth.uid())::text = sender_id or (select auth.uid())::text = receiver_id);

-- 6. Friendships Table
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  friend_id uuid references auth.users on delete cascade not null,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'blocked')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id, friend_id)
);

alter table public.friendships enable row level security;

drop policy if exists "Friendships are viewable by everyone." on public.friendships;
drop policy if exists "Friendships are viewable by participants" on public.friendships;
create policy "Friendships are viewable by participants" 
  on public.friendships for select 
  to authenticated 
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

drop policy if exists "Users can insert friendship requests." on public.friendships;
drop policy if exists "Users can insert friendship requests" on public.friendships;
create policy "Users can insert friendship requests" 
  on public.friendships for insert 
  to authenticated 
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update friendship status." on public.friendships;
drop policy if exists "Users can update friendship status" on public.friendships;
create policy "Users can update friendship status" 
  on public.friendships for update 
  to authenticated 
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id)
  with check ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

drop policy if exists "Users can delete friendship." on public.friendships;
drop policy if exists "Users can delete friendship" on public.friendships;
create policy "Users can delete friendship" 
  on public.friendships for delete 
  to authenticated 
  using ((select auth.uid()) = user_id or (select auth.uid()) = friend_id);

-- 7. Enable Realtime Replication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channels'
  ) then
    alter publication supabase_realtime add table public.channels;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channel_members'
  ) then
    alter publication supabase_realtime add table public.channel_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channel_messages'
  ) then
    alter publication supabase_realtime add table public.channel_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

-- 8. Storage Bucket for Chat Attachments
insert into storage.buckets (id, name, public) 
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can read chat attachments." on storage.objects;
drop policy if exists "Chat attachments are viewable by everyone" on storage.objects;
create policy "Chat attachments are viewable by everyone" 
  on storage.objects for select using (bucket_id = 'chat-attachments');

drop policy if exists "Anyone can upload chat attachments." on storage.objects;
drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments" 
  on storage.objects for insert 
  to authenticated 
  with check (bucket_id = 'chat-attachments');

-- 9. Storage Bucket for User Avatars
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can read avatars." on storage.objects;
drop policy if exists "Avatars are viewable by everyone" on storage.objects;
create policy "Avatars are viewable by everyone" 
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Anyone can upload avatars." on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars" 
  on storage.objects for insert 
  to authenticated 
  with check (bucket_id = 'avatars');

drop policy if exists "Anyone can update avatars." on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
create policy "Authenticated users can update avatars" 
  on storage.objects for update 
  to authenticated 
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

-- Performance indexes for DM/channel lookups and membership filtering
create index if not exists idx_direct_messages_room_id_sent_at on public.direct_messages (room_id, sent_at asc);
create index if not exists idx_direct_messages_sender_receiver_sent_at on public.direct_messages (sender_id, receiver_id, sent_at asc);
create index if not exists idx_channel_members_user_id on public.channel_members (user_id);
create index if not exists idx_channel_messages_channel_id_sent_at on public.channel_messages (channel_id, sent_at asc);
create index if not exists idx_friendships_user_id on public.friendships (user_id);
create index if not exists idx_friendships_friend_id on public.friendships (friend_id);

-- Helper RPC for Edge Function admin-delete-user (service_role only)
create or replace function public.admin_get_user_storage_objects(p_user_id uuid)
returns table (
  bucket_id text,
  object_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_admin_id constant uuid := 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a'::uuid;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Forbidden: service_role required';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_user_id = c_admin_id then
    raise exception 'Forbidden: primary admin cannot be deleted';
  end if;

  return query
  select distinct sub.bucket_id, sub.object_name
  from (
    select
      o.bucket_id::text as bucket_id,
      o.name::text as object_name
    from storage.objects o
    where o.owner = p_user_id
       or o.owner_id = p_user_id::text
       or (o.bucket_id = 'avatars' and o.name like p_user_id::text || '/%')

    union all

    select
      'avatars'::text as bucket_id,
      regexp_replace(split_part(p.avatar_url, '/storage/v1/object/public/avatars/', 2), '[\?#].*$', '') as object_name
    from public.profiles p
    where p.id = p_user_id
      and p.avatar_url like '%/storage/v1/object/public/avatars/%'

    union all

    select
      'chat-attachments'::text as bucket_id,
      regexp_replace(split_part(att->>'url', '/storage/v1/object/public/chat-attachments/', 2), '[\?#].*$', '') as object_name
    from public.channel_messages cm,
         lateral jsonb_array_elements(
           case when jsonb_typeof(cm.attachments) = 'array' then cm.attachments else '[]'::jsonb end
         ) as att
    where cm.sender_id = p_user_id::text
      and (att->>'url') like '%/storage/v1/object/public/chat-attachments/%'

    union all

    select
      'chat-attachments'::text as bucket_id,
      regexp_replace(split_part(att->>'url', '/storage/v1/object/public/chat-attachments/', 2), '[\?#].*$', '') as object_name
    from public.direct_messages dm,
         lateral jsonb_array_elements(
           case when jsonb_typeof(dm.attachments) = 'array' then dm.attachments else '[]'::jsonb end
         ) as att
    where (dm.sender_id = p_user_id::text or dm.receiver_id = p_user_id::text)
      and (att->>'url') like '%/storage/v1/object/public/chat-attachments/%'
  ) sub
  where sub.object_name is not null
    and sub.object_name <> '';
end;
$$;

revoke all on function public.admin_get_user_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_user_storage_objects(uuid) to service_role;

