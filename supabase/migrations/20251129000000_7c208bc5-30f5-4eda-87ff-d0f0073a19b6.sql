create table if not exists public.petty_cash (
    id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    item_name text not null,
    description text,
    amount numeric not null,
    bill_url text,
    date date not null,
    status text not null default 'pending',
    submitted_by uuid not null references profiles(id),
    approved_by uuid references profiles(id),
    rejection_reason text,
    
    constraint petty_cash_pkey primary key (id),
    constraint petty_cash_status_check check (status in ('pending', 'approved', 'rejected'))
);

-- Enable RLS
alter table public.petty_cash enable row level security;

-- Policies

-- Lead can insert
create policy "Lead can insert petty cash"
on public.petty_cash
for insert
to authenticated
with check (
    exists (
        select 1 from public.user_roles
        where user_id = auth.uid()
        and role = 'lead'
    )
    and submitted_by = auth.uid()
);

-- Lead can view their own
create policy "Lead can view their own petty cash"
on public.petty_cash
for select
to authenticated
using (
    submitted_by = auth.uid()
    or
    exists (
        select 1 from public.user_roles
        where user_id = auth.uid()
        and role in ('treasurer', 'accountant')
    )
);

-- Treasurer can update (approve/reject)
create policy "Treasurer can update petty cash"
on public.petty_cash
for update
to authenticated
using (
    exists (
        select 1 from public.user_roles
        where user_id = auth.uid()
        and role = 'treasurer'
    )
);

-- Accountant can view all (covered by select policy above)
