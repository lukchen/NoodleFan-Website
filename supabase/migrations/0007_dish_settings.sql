-- 菜品的「当天状态」—— 由后台「菜单」标签维护。
--
-- 为什么不直接改 menu.js:那份是菜品目录(名字、价格、图、选项),改它要改代码、
-- 走部署,五分钟起步。而「今天烧饼卖完了」这种事需要在厨房里三十秒内生效。
-- 所以目录留在代码里,随时会变的状态放数据库。
--
-- 三个开关各管一件事,别合并:
--   listed       = 上架/彻底下架。下架的菜菜单上直接没有(比如季节菜、不做了的菜)
--   sold_out_on  = 「今日售罄」的日期。菜还在菜单上但置灰不能点 ——
--                  比「凭空消失」好:客人知道这家有这道菜,明天再来。
--                  存日期而不是布尔值,是为了第二天自动恢复 ——
--                  靠人记得第二天来关掉,迟早有一天忘了,白白少卖一天。
--   run_cap      = 每班团餐这道菜备多少份。默认 15,后台可调。
--                  到店自取现做现卖,不受这个限制。
create table if not exists dish_settings (
  dish_id    integer primary key,
  listed     boolean not null default true,
  sold_out_on date,
  run_cap    integer not null default 15 check (run_cap >= 0),
  updated_at timestamptz not null default now()
);

-- 这张表只由 service role 读写(menu-settings / create-checkout 两个 edge function)。
-- 不开 anon 直读:公开读走 menu-settings,那边只吐这三个字段,
-- 将来这张表加了成本、备注之类的列也不会跟着漏出去。
alter table dish_settings enable row level security;

comment on table dish_settings is '菜品当天状态:上架/今日售罄/每班备料数。目录本身在代码里的 menu.js。';
