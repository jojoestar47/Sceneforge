-- Scene folders for organizing scenes within a campaign
create table scene_folders (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  name         text not null,
  order_index  integer not null default 0,
  created_at   timestamptz default now()
);

alter table scene_folders enable row level security;

create policy "Users manage own folders" on scene_folders
  for all
  using  (campaign_id in (select id from campaigns where user_id = auth.uid()))
  with check (campaign_id in (select id from campaigns where user_id = auth.uid()));

-- Add folder_id to scenes; null = unfiled
alter table scenes add column if not exists folder_id uuid references scene_folders(id) on delete set null;

create index if not exists scene_folders_campaign_order_idx on scene_folders(campaign_id, order_index);
create index if not exists scenes_folder_id_idx on scenes(folder_id);
